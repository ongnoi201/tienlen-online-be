const Room = require('./Room');
const Player = require('./Player');
const { v4: uuidv4 } = require('uuid');

class GameManager {
    constructor(io) {
        this.io = io;
        this.rooms = {};
        this.players = {};
    }

    handleConnection(socket, authData) {
        const userId = authData?.userId;
        const playerId = userId || socket.id;
        let player = null;

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

        socket.on('join_room', async ({ roomId, name }) => {
            const room = this.rooms[roomId];
            if (!room) {
                socket.emit('error', { message: 'Phòng không tồn tại.' });
                return;
            }

            player = new Player(playerId, socket, name);
            this.players[playerId] = player;

            room.addPlayer(player);

            //thêm đoạn này
            room.players.forEach(p => {
                if (p.id !== playerId) {
                    p.send('new_peer', { peerId: playerId });
                    player.send('new_peer', { peerId: p.id });
                }
            });
            // kết thúc đoạn thêm

            await this.broadcastToRoom(room, 'joined_room', {
                roomId,
                players: await room.getPublicPlayers()
            });

            await this.updateRoomsList();

            if (room.isFull()) {
                await room.startGame();
            }
        });

        //Thêm đoạn này
        socket.on('signal', ({ targetId, data }) => {
            const targetPlayer = this.players[targetId];
            if (targetPlayer) {
                targetPlayer.send('signal', {
                    sourceId: playerId,
                    data
                });
            }
        });
        //Kết thúc đoạn thêm

        socket.on('ready', async () => {
            if (!player?.roomId) return;
            const room = this.rooms[player.roomId];
            if (!room) return;
            room.setReady(playerId);
            await this.broadcastToRoom(room, 'player_ready', { playerId });
            await this.broadcastToRoom(room, 'joined_room', {
                roomId: room.id,
                players: await room.getPublicPlayers()
            });
            if (room.allReady()) {
                await room.startGame();
            }
            await this.updateRoomsList();
        });

        socket.on('leave_room', async () => {
            await this.removePlayerFromRoom(playerId);
        });

        socket.on('play_card', async ({ cards }) => {
            const room = this.rooms[player?.roomId];
            if (room) {
                await room.playCard(playerId, cards);
            }
        });

        socket.on('pass_turn', async () => {
            const room = this.rooms[player?.roomId];
            if (room) {
                await room.passTurn(playerId);
            }
        });

        socket.on('disconnect', async () => {
            await this.removePlayerFromRoom(playerId);
            delete this.players[playerId];
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
        player.send('left_room', { roomId, playerId });

        if (room.players.length === 0) {
            delete this.rooms[roomId];
            this.io.emit('room_deleted', { roomId });
        } else {
            await this.broadcastToRoom(room, 'joined_room', {
                roomId: room.id,
                players: await room.getPublicPlayers()
            });

            await this.broadcastToRoom(room, 'left_room', { roomId, playerId });
        }
        await this.updateRoomsList();
    }

    async broadcastToRoom(room, event, data) {
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
