class GameEngine {
    constructor() {
        this.lastPlay = null;
    }

    isValidMove(play) {
        if (!Array.isArray(play) || play.length === 0) return false;
        if (play.length === 1) return true; 
        if (play.length === 2 && play[0].value === play[1].value) return true;
        if (play.length === 3 && play.every(c => c.value === play[0].value)) return true;
        if (play.length === 4 && play.every(c => c.value === play[0].value)) return true;
        if (play.length === 6) {
            const sorted = [...play].sort((a, b) => a.value - b.value);
            let ok = true;
            for (let i = 0; i < 6; i += 2) {
                if (sorted[i].value !== sorted[i + 1].value) ok = false;
                if (i > 0 && sorted[i].value !== sorted[i - 2].value + 1) ok = false;
            }
            if (ok) return true;
        }

        if (play.length === 8) {
            const sorted = [...play].sort((a, b) => a.value - b.value);
            let ok = true;
            for (let i = 0; i < 8; i += 2) {
                if (sorted[i].value !== sorted[i + 1].value) ok = false;
                if (i > 0 && sorted[i].value !== sorted[i - 2].value + 1) ok = false;
            }
            if (ok) return true;
        }

        if (play.length >= 3) {
            const sorted = [...play].sort((a, b) => a.value - b.value);
            for (let i = 1; i < sorted.length; i++) {
                if (sorted[i].value !== sorted[i - 1].value + 1) return false;
            }
            if (sorted.some(c => c.value === 15)) return false;
            return true;
        }
        return false;
    }

    getComboType(play) {
        if (play.length === 1) return 'single';
        if (play.length === 2 && play[0].value === play[1].value) return 'pair';
        if (play.length === 3 && play.every(c => c.value === play[0].value)) return 'triple';
        if (play.length === 4 && play.every(c => c.value === play[0].value)) return 'four';
        if (play.length === 6) {
            const sorted = [...play].sort((a, b) => a.value - b.value);
            let ok = true;
            for (let i = 0; i < 6; i += 2) {
                if (sorted[i].value !== sorted[i + 1].value) ok = false;
                if (i > 0 && sorted[i].value !== sorted[i - 2].value + 1) ok = false;
            }
            if (ok) return 'threePairsSeq';
        }
        if (play.length === 8) {
            const sorted = [...play].sort((a, b) => a.value - b.value);
            let ok = true;
            for (let i = 0; i < 8; i += 2) {
                if (sorted[i].value !== sorted[i + 1].value) ok = false;
                if (i > 0 && sorted[i].value !== sorted[i - 2].value + 1) ok = false;
            }
            if (ok) return 'fourPairsSeq';
        }
        if (play.length >= 3) {
            const sorted = [...play].sort((a, b) => a.value - b.value);
            if (sorted.some(c => c.value === 15)) return 'other';
            let ok = true;
            for (let i = 1; i < sorted.length; i++) {
                if (sorted[i].value !== sorted[i - 1].value + 1) ok = false;
            }
            if (ok) return 'straight';
        }
        return 'other';
    }

    isStronger(play, lastPlay) {
        if (!lastPlay) return true;
        const playType = this.getComboType(play);
        const lastType = this.getComboType(lastPlay);
        if (lastType === 'single' && lastPlay[0].value === 15) {
            if (playType === 'four' || playType === 'threePairsSeq' || playType === 'fourPairsSeq') return true;
        }
        if (lastType === 'pair' && lastPlay[0].value === 15) {
            if (playType === 'four' || playType === 'fourPairsSeq') return true;
        }
        if (lastType === 'threePairsSeq') {
            if (playType === 'four' || playType === 'fourPairsSeq') return true;
            if (playType === 'threePairsSeq') {
                const sortedPlay = [...play].sort((a, b) => a.value - b.value);
                const sortedLast = [...lastPlay].sort((a, b) => a.value - b.value);
                return sortedPlay[5].value > sortedLast[5].value;
            }
        }
        if (lastType === 'four') {
            if (playType === 'fourPairsSeq') return true;
            if (playType === 'four') {
                const sortedPlay = [...play].sort((a, b) => a.value - b.value);
                const sortedLast = [...lastPlay].sort((a, b) => a.value - b.value);
                return sortedPlay[3].value > sortedLast[3].value;
            }
        }
        if (lastType === 'fourPairsSeq') {
            if (playType === 'fourPairsSeq') {
                const sortedPlay = [...play].sort((a, b) => a.value - b.value);
                const sortedLast = [...lastPlay].sort((a, b) => a.value - b.value);
                return sortedPlay[7].value > sortedLast[7].value;
            }
        }
        if (play.length !== lastPlay.length || playType !== lastType) return false;
        const suitOrder = { '♥': 4, '♦': 3, '♣': 2, '♠': 1 };
        const sortedPlay = [...play].sort((a, b) => a.value - b.value || suitOrder[a.suit] - suitOrder[b.suit]);
        const sortedLast = [...lastPlay].sort((a, b) => a.value - b.value || suitOrder[a.suit] - suitOrder[b.suit]);
        const highestCard = sortedPlay[sortedPlay.length - 1];
        const lastCard = sortedLast[sortedLast.length - 1];
        if (highestCard.value > lastCard.value) return true;
        if (highestCard.value < lastCard.value) return false;
        return suitOrder[highestCard.suit] > suitOrder[lastCard.suit];
    }

    checkWin(player) {
        return player.hand.length === 0;
    }
}

module.exports = GameEngine;
