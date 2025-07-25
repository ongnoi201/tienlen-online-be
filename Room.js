const GameEngine = require('./GameEngine');
const { createDeck, shuffle, deal, sortHand } = require('./utils');
const User = require('./models/User');

class Room {
    constructor(id) {
        this.id = id;
        this.players = [];
        this.engine = new GameEngine();
        this.currentTurn = 0;
        this.lastPlay = null;
        this.started = false;
        this.passedPlayers = new Set();
        this.lastWinnerId = null;
        this._lastGameWinnerId = null;
    }

    addPlayer(player) {
        if (this.players.length < 4 && !this.started) {
            player.roomId = this.id;
            this.players.push(player);
        }
    }

    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
        this.resetRoom();
    }

    async getPublicPlayers() {
        const playerInfos = await Promise.all(this.players.map(async p => {
            let score = 0;
            let image = '';
            try {
                const user = await User.findOne({ $or: [{ _id: p.id }, { idPlayer: p.id }] });
                if (user) {
                    if (typeof user.score === 'number') score = user.score;
                    if (user.image) image = user.image;
                }
            } catch (e) {}
            return {
                id: p.id,
                name: p.name,
                isReady: p.isReady,
                cardCount: p.hand.length,
                score,
                image
            };
        }));
        return playerInfos;
    }

    setReady(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (player) player.isReady = true;
    }

    allReady() {
        return this.players.length >= 2 && this.players.every(p => p.isReady);
    }

    isFull() {
        return this.players.length >= 4;
    }

    async startGame() {
        if (!this.allReady()) return;

        this.started = true;
        this.lastPlay = null;
        this.passedPlayers.clear();
        this.lastWinnerId = null;

        const deck = shuffle(createDeck());
        const hands = deal(deck, this.players.length);

        this.players.forEach((player, idx) => {
            player.hand = sortHand(hands[idx]);
            player.finished = false;
        });

        let firstIdx = 0;
        if (this._lastGameWinnerId) {
            const found = this.players.findIndex(p => p.id === this._lastGameWinnerId);
            if (found !== -1) firstIdx = found;
            else {
                for (let i = 0; i < this.players.length; i++) {
                    if (this.players[i].hand.some(c => c.value === 3 && c.suit === '♠')) {
                        firstIdx = i;
                        break;
                    }
                }
            }
        } else {
            for (let i = 0; i < this.players.length; i++) {
                if (this.players[i].hand.some(c => c.value === 3 && c.suit === '♠')) {
                    firstIdx = i;
                    break;
                }
            }
        }
        this.currentTurn = firstIdx;

        const publicPlayers = await this.getPublicPlayers();

        this.players.forEach(player => {
            player.send('start_game', {
                hand: player.hand,
                players: publicPlayers,
                currentTurn: this.players[this.currentTurn].id
            });
        });

        this.broadcast('your_turn', { playerId: this.players[this.currentTurn].id });
    }

    async playCard(playerId, cards) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || this.passedPlayers.has(playerId)) return;

        if (!this.engine.isValidMove(cards)) {
            player.send('invalid_move', { message: 'Lượt đi không hợp lệ.' });
            return;
        }

        if (this.lastPlay && !this.engine.isStronger(cards, this.lastPlay)) {
            player.send('invalid_move', { message: 'Bài yếu hơn lượt trước.' });
            return;
        }

        player.hand = player.hand.filter(
            c => !cards.some(card => card.value === c.value && card.suit === c.suit)
        );

        const prevLastPlay = this.lastPlay;
        const prevLastPlayPlayerId = this.lastPlayPlayerId;

        this.lastPlay = cards;
        this.lastPlayPlayerId = playerId;

        this.broadcast('play_card', { playerId, cards });

        const publicPlayers = await this.getPublicPlayers();
        this.broadcast('update_players', {
            players: publicPlayers
        });

        if (prevLastPlay && prevLastPlayPlayerId && this.engine.isStronger(cards, prevLastPlay)) {
            const comboType = this.engine.getComboType(cards);
            const lastType = this.engine.getComboType(prevLastPlay);
            let score = 0;
            // Chặt đơn 2
            if (lastType === 'single' && prevLastPlay[0].value === 15) {
                if (comboType === 'four' || comboType === 'threePairsSeq' || comboType === 'fourPairsSeq') score = 5;
            }
            // Chặt đôi 2
            if (lastType === 'pair' && prevLastPlay[0].value === 15) {
                if (comboType === 'four' || comboType === 'fourPairsSeq') score = 10;
            }
            // 4 quý chặt 3 đôi thông
            if (lastType === 'threePairsSeq' && comboType === 'four') score = 5;
            // 4 đôi thông chặt 4 quý
            if (lastType === 'four' && comboType === 'fourPairsSeq') score = 10;
            // 3 đôi thông lớn chặt nhỏ
            if (lastType === 'threePairsSeq' && comboType === 'threePairsSeq') {
                const sortedPlay = [...cards].sort((a, b) => a.value - b.value);
                const sortedLast = [...prevLastPlay].sort((a, b) => a.value - b.value);
                if (sortedPlay[5].value > sortedLast[5].value) score = 5;
            }
            // 4 đôi thông lớn chặt nhỏ
            if (lastType === 'fourPairsSeq' && comboType === 'fourPairsSeq') {
                const sortedPlay = [...cards].sort((a, b) => a.value - b.value);
                const sortedLast = [...prevLastPlay].sort((a, b) => a.value - b.value);
                if (sortedPlay[7].value > sortedLast[7].value) score = 20;
            }
            // 4 quý lớn chặt nhỏ
            if (lastType === 'four' && comboType === 'four') {
                const sortedPlay = [...cards].sort((a, b) => a.value - b.value);
                const sortedLast = [...prevLastPlay].sort((a, b) => a.value - b.value);
                if (sortedPlay[3].value > sortedLast[3].value) score = 10;
            }
            if (score > 0) {
                // Cộng điểm cho người chặt
                await this.addScore(player.id, score);
                player.send('score_update', { scoreDelta: score });
                // Trừ điểm người bị chặt
                await this.addScore(prevLastPlayPlayerId, -score);
                const loser = this.players.find(p => p.id === prevLastPlayPlayerId);
                if (loser) loser.send('score_update', { scoreDelta: -score });
            }
        }

        if (player.hand.length === 0) {
            player.finished = true;
            this.broadcast('player_finished', { playerId });

            if (!this.lastWinnerId) {
                this.lastWinnerId = playerId;
            }
        }

        const remaining = this.players.filter(p => !p.finished);
        if (remaining.length === 1) {
            remaining[0].finished = true;
            this.broadcast('player_finished', { playerId: remaining[0].id });

            // Tính điểm xếp hạng
            const ranking = await this.calcRankingScore();

            // Gửi thứ tự xếp hạng cho client
            this.broadcast('game_over', { 
                loserId: remaining[0].id,
                ranking
            });

            // Gán người thắng ván này cho ván sau
            if (this.lastWinnerId) {
                this._lastGameWinnerId = this.lastWinnerId;
            } else {
                const winner = this.players.find(p => p.finished && p.hand.length === 0);
                if (winner) this._lastGameWinnerId = winner.id;
            }

            this.resetRoom();
            return;
        }

        this.advanceTurn();
        this.broadcast('your_turn', { playerId: this.players[this.currentTurn].id });
    }

    async calcRankingScore() {
        let finishedOrder = [];
        const winner = this.players.find(p => p.finished && p.hand.length === 0);
        if (winner) {
            finishedOrder.push(winner.id);
        }
        this.players.forEach(p => {
            if (p.finished && (!winner || p.id !== winner.id)) finishedOrder.push(p.id);
        });
        const unfinished = this.players.filter(p => !p.finished).map(p => p.id);
        const ranking = [...finishedOrder, ...unfinished];
        const n = this.players.length;
        for (let i = 0; i < ranking.length; i++) {
            let score = 0;
            if (n === 2) {
                score = i === 0 ? 10 : 0;
            } else if (n === 3) {
                score = i === 0 ? 10 : (i === 1 ? 5 : 0);
            } else if (n === 4) {
                score = i === 0 ? 10 : (i === 1 ? 5 : 0);
            }
            await this.addScore(ranking[i], score);
            const player = this.players.find(p => p.id === ranking[i]);
            if (player) {
                const newScore = await this.getUserScore(player.id);
                player.send('score_update', { scoreDelta: score, score: newScore });
            }
        }
        return ranking;
    }

    async addScore(playerId, delta) {
        try {
            await User.findOneAndUpdate(
                { $or: [{ _id: playerId }, { idPlayer: playerId }] },
                { $inc: { score: delta } }
            );
        } catch (e) {
            console.error('Error updating score:', e);
        }
    }

    async getUserScore(playerId) {
        try {
            const user = await User.findOne({ $or: [{ _id: playerId }, { idPlayer: playerId }] });
            if (user && typeof user.score === 'number') return user.score;
        } catch (e) {}
        return 0;
    }

    passTurn(playerId) {
        if (this.passedPlayers.has(playerId)) return;

        this.passedPlayers.add(playerId);
        this.broadcast('pass_turn', { playerId });

        const activePlayers = this.players.filter(
            p => !this.passedPlayers.has(p.id) && !p.finished
        );

        if (activePlayers.length === 1) {
            this.lastPlay = null;
            this.lastPlayPlayerId = null;
            this.passedPlayers.clear();
            this.currentTurn = this.players.findIndex(p => p.id === activePlayers[0].id);

            this.broadcast('new_round', {
                currentTurn: this.players[this.currentTurn].id
            });

            return;
        }

        this.advanceTurn();
        this.broadcast('your_turn', { playerId: this.players[this.currentTurn].id });
    }

    advanceTurn() {
        const total = this.players.length;
        let next = this.currentTurn;

        for (let i = 0; i < total; i++) {
            next = (next - 1 + total) % total;
            const p = this.players[next];
            if (!this.passedPlayers.has(p.id) && !p.finished) {
                this.currentTurn = next;
                return;
            }
        }
    }

    async resetRoom() {
        this.started = false;
        this.lastPlay = null;
        this.lastPlayPlayerId = null;
        this.passedPlayers.clear();
        this.players.forEach(p => {
            p.isReady = false;
            p.finished = false;
            p.hand = [];
        });
        if (this.players.length === 0) {
            this.lastWinnerId = null;
            this._lastGameWinnerId = null;
        }
        const publicPlayers = await this.getPublicPlayers();
        this.broadcast('joined_room', {
            roomId: this.id,
            players: publicPlayers
        });
    }

    broadcast(event, data) {
        this.players.forEach(p => p.send(event, data));
    }
}

module.exports = Room;

