function createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = Array.from({ length: 13 }, (_, i) => i + 3);
    const deck = [];

    for (const suit of suits) {
        for (const value of values) {
            deck.push({ suit, value });
        }
    }

    return deck;
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function deal(deck, playersCount = 4) {
    const hands = Array.from({ length: playersCount }, () => []);
    for (let p = 0; p < playersCount; p++) {
        hands[p] = deck.slice(p * 13, (p + 1) * 13);
    }
    return hands;
}

function sortHand(hand) {
    return hand.sort((a, b) => a.value - b.value || a.suit.localeCompare(b.suit));
}

module.exports = {
    createDeck,
    shuffle,
    deal,
    sortHand,
};
