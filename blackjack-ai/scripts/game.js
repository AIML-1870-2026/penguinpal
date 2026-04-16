class Deck {
  constructor() { this.cards = []; this.reset(); }

  reset() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    this.cards = [];
    for (const suit of suits)
      for (const rank of ranks)
        this.cards.push({ rank, suit, value: this._val(rank), red: suit === '♥' || suit === '♦' });
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw() { return this.cards.pop(); }

  _val(rank) {
    if (rank === 'A') return 11;
    if (['J','Q','K'].includes(rank)) return 10;
    return parseInt(rank);
  }
}

class Hand {
  constructor() { this.cards = []; }

  addCard(card) { this.cards.push(card); }
  clear() { this.cards = []; }

  getValue() {
    let total = 0, aces = 0;
    for (const c of this.cards) {
      if (c.rank === 'A') { aces++; total += 11; }
      else total += c.value;
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }

  isBusted()    { return this.getValue() > 21; }
  isBlackjack() { return this.cards.length === 2 && this.getValue() === 21; }
  canSplit()    { return this.cards.length === 2 && this.cards[0].rank === this.cards[1].rank; }
  canDouble()   { return this.cards.length === 2; }
}

const gameState = {
  deck: null,
  playerHand: null,
  dealerHand: null,
  balance: 1000,
  currentBet: 0,
  phase: 'betting',
  gameCount: 0,
  history: [],
  apiKey: null,

  init() {
    this.deck = new Deck();
    this.deck.shuffle();
    this.playerHand = new Hand();
    this.dealerHand = new Hand();
  },

  resetHands() {
    this.playerHand.clear();
    this.dealerHand.clear();
    if (this.deck.cards.length < 15) {
      this.deck.reset();
      this.deck.shuffle();
      Logger.info('Deck reshuffled');
    }
  }
};

window.addEventListener('beforeunload', () => {
  gameState.apiKey = null;
});
