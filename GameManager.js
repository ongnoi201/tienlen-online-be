const Room = require('./Room');
const Player = require('./Player');
const { v4: uuidv4 } = require('uuid');

class GameManager {
    constructor(io) {
        this.io = io;
        this.rooms = {};
        this.players = {};
    }

    handleConnection(socket) {
        // Lấy userId từ auth (nếu có)
        const userId = socket.handshake.auth?.userId;
        const playerId = userId || socket.id;
        let player = null;

        // === Get available rooms ===
        socket.on('get_rooms', async () => {
            const roomsList = await Promise.all(
                Object.values(this.rooms).map(async room => ({
                    roomId: room.id,
                    playerCount: room.players.length,
                    started: room.started,
                    players: await room.getPublicPlayers()
                }))
            );
            socket.emit('rooms_list', roomsList);
        });

        // === Create a new room ===
        socket.on('create_room', async ({ name }) => {
            player = new Player(playerId, socket, name);
            this.players[playerId] = player;

            const roomId = uuidv4();
            const room = new Room(roomId);
            room.addPlayer(player);
            this.rooms[roomId] = room;

            player.send('room_created', {
                roomId,
                players: await room.getPublicPlayers()
            });

            await this.updateRoomsList();
        });

        // === Join an existing room ===
        socket.on('join_room', async ({ roomId, name }) => {
            const room = this.rooms[roomId];
            if (!room) {
                socket.emit('error', { message: 'Phòng không tồn tại.' });
                return;
            }

            player = new Player(playerId, socket, name);
            this.players[playerId] = player;

            room.addPlayer(player);

            // Notify all in room
            await this.broadcastToRoom(room, 'joined_room', {
                roomId,
                players: await room.getPublicPlayers()
            });

            await this.updateRoomsList();

            if (room.isFull()) {
                await room.startGame();
            }
        });

        // === Player ready ===
        socket.on('ready', async () => {
            if (!player?.roomId) return;

            const room = this.rooms[player.roomId];
            if (!room) return;

            room.setReady(playerId);

            // Gửi riêng sự kiện ready cho tất cả
            await this.broadcastToRoom(room, 'player_ready', { playerId });

            // Gửi lại danh sách người chơi cập nhật trạng thái
            await this.broadcastToRoom(room, 'joined_room', {
                roomId: room.id,
                players: await room.getPublicPlayers()
            });

            if (room.allReady()) {
                await room.startGame();
            }

            await this.updateRoomsList();
        });

        // === Player leaves room ===
        socket.on('leave_room', async () => {
            await this.removePlayerFromRoom(playerId);
        });

        // === Play card ===
        socket.on('play_card', async ({ cards }) => {
            const room = this.rooms[player?.roomId];
            if (room) {
                await room.playCard(playerId, cards);
            }
        });

        // === Pass turn ===
        socket.on('pass_turn', async () => {
            const room = this.rooms[player?.roomId];
            if (room) {
                await room.passTurn(playerId);
            }
        });

        // === Disconnect ===
        socket.on('disconnect', async () => {
            await this.removePlayerFromRoom(playerId);
            delete this.players[playerId];
            console.log(`Player ${playerId} disconnected`);
        });
    }

    async removePlayerFromRoom(playerId) {
        const player = this.players[playerId];
        const roomId = player?.roomId;
        if (!roomId) return;

        const room = this.rooms[roomId];
        if (!room) return;

        room.removePlayer(playerId);
        player.roomId = null;

        // Gửi thông báo rời phòng cho chính player
        player.send('left_room', { roomId, playerId });

        // Gửi cho các người còn lại
        await this.broadcastToRoom(room, 'left_room', { roomId, playerId });

        if (room.players.length === 0) {
            delete this.rooms[roomId];
        } else {
            await this.broadcastToRoom(room, 'joined_room', {
                roomId: room.id,
                players: await room.getPublicPlayers()
            });
        }

        await this.updateRoomsList();
    }

    async broadcastToRoom(room, event, data) {
        // Đảm bảo nếu data có players là Promise thì resolve
        if (data && data.players && typeof data.players.then === 'function') {
            data.players = await data.players;
        }
        room.players.forEach(p => p.send(event, data));
    }

    async updateRoomsList() {
        const roomsList = await Promise.all(
            Object.values(this.rooms).map(async room => ({
                roomId: room.id,
                playerCount: room.players.length,
                started: room.started,
                players: await room.getPublicPlayers()
            }))
        );
        this.io.emit('rooms_list', roomsList);
    }
}

module.exports = GameManager;
