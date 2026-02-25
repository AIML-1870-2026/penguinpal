'use strict';

// ============================================================
// CONSTANTS
// ============================================================

// Beach-themed suits: 🌊 wave & ⭐ star = blue; 🐚 shell & 🌺 hibiscus = pink
const SUITS  = ['🌊', '🐚', '🌺', '⭐'];
const RANKS  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const VALUES = { A:11, '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10, J:10, Q:10, K:10 };

const CHIP_DENOMS = [500, 250, 100, 50, 25, 10];

const DEFAULT_STATS = {
  games: 0, wins: 0, losses: 0, pushes: 0,
  blackjacks: 0, bestWin: 0, currentStreak: 0, pnl: 0
};
const DEFAULT_SETTINGS = { sfx: true, volume: 70 };

// ============================================================
// STATE
// ============================================================

let state = {
  deck:            [],
  playerHand:      [],
  dealerHand:      [],
  balance:         1000,
  currentBet:      0,
  phase:           'betting',   // 'betting' | 'playing' | 'result'
  roundNumber:     0,
  stats:           { ...DEFAULT_STATS },
  history:         [],
  settings:        { ...DEFAULT_SETTINGS },
  holeHidden:      true,        // dealer's second card is face-down
};

// ============================================================
// AUDIO  (Web Audio API — synthesised tones, no files needed)
// ============================================================

let _audioCtx = null;

function ctx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || /** @type {any} */ (window).webkitAudioContext)();
  return _audioCtx;
}

function tone(freq, type, dur, vol = 0.28, delay = 0) {
  if (!state.settings.sfx) return;
  try {
    const c = ctx();
    const osc  = c.createOscillator();
    const gain = c.createGain();
    const v    = vol * (state.settings.volume / 100);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime + delay);
    gain.gain.setValueAtTime(v, c.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur);
    osc.start(c.currentTime + delay);
    osc.stop(c.currentTime + delay + dur);
  } catch (_) { /* audio not supported */ }
}

const SFX = {
  deal:      () => { tone(700,'sine',.10,.20); tone(500,'sine',.08,.15,.06); },
  chip:      () => tone(1400,'sine',.07,.22),
  click:     () => tone(600,'sine',.06,.15),
  win:       () => [523,659,784,1047].forEach((f,i) => tone(f,'sine',.30,.30,i*.10)),
  lose:      () => [380,280,180].forEach((f,i) => tone(f,'sawtooth',.20,.20,i*.12)),
  push:      () => tone(440,'sine',.35,.20),
  bust:      () => [320,220,160].forEach((f,i) => tone(f,'square',.18,.20,i*.12)),
  blackjack: () => [523,659,784,1047,1319,1047,784,659,523].forEach((f,i) => tone(f,'sine',.22,.38,i*.08)),
};

// ============================================================
// DECK
// ============================================================

function buildDeck() {
  const deck = [];
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ suit, rank });
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ============================================================
// HAND MATH
// ============================================================

function cardValue(rank) { return VALUES[rank]; }

function handTotal(hand) {
  let total = 0, aces = 0;
  for (const c of hand) {
    total += cardValue(c.rank);
    if (c.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isBust(hand)       { return handTotal(hand) > 21; }
function isBlackjack(hand)  { return hand.length === 2 && handTotal(hand) === 21; }
function isPink(card)       { return card.suit === '🐚' || card.suit === '🌺'; }

// ============================================================
// CARD RENDERING — pip layout
// ============================================================

// [x%, y%, rotate180] within the pip area for each rank
const PIP_POSITIONS = {
  'A':  [[50,50,0]],
  '2':  [[50,18,0],[50,82,1]],
  '3':  [[50,14,0],[50,50,0],[50,86,1]],
  '4':  [[28,18,0],[72,18,0],[28,82,1],[72,82,1]],
  '5':  [[28,18,0],[72,18,0],[50,50,0],[28,82,1],[72,82,1]],
  '6':  [[28,14,0],[72,14,0],[28,50,0],[72,50,0],[28,86,1],[72,86,1]],
  '7':  [[28,12,0],[72,12,0],[50,30,0],[28,52,0],[72,52,0],[28,76,1],[72,76,1]],
  '8':  [[28,10,0],[72,10,0],[50,28,0],[28,50,0],[72,50,0],[50,68,1],[28,86,1],[72,86,1]],
  '9':  [[28,9,0],[72,9,0],[28,30,0],[72,30,0],[50,50,0],[28,68,1],[72,68,1],[28,89,1],[72,89,1]],
  '10': [[28,8,0],[72,8,0],[50,24,0],[28,42,0],[72,42,0],[28,58,1],[72,58,1],[50,74,1],[28,90,1],[72,90,1]],
};

function makePipHtml(rank, suit) {
  const positions = PIP_POSITIONS[rank];
  if (!positions) {
    // Face card (J, Q, K) — centered letter + suit
    return `<div class="card-face-area"><span class="card-face-letter">${rank}</span><span class="card-face-suit">${suit}</span></div>`;
  }
  const n   = positions.length;
  const cls = n === 1 ? 'pip-ace' : n <= 4 ? 'pip-lg' : n <= 7 ? 'pip-md' : 'pip-sm';
  const pips = positions.map(([x, y, r]) =>
    `<span class="pip ${cls}${r ? ' pip-r' : ''}" style="left:${x}%;top:${y}%">${suit}</span>`
  ).join('');
  return `<div class="card-pips">${pips}</div>`;
}

function makeCardEl(card, faceDown = false) {
  const el = document.createElement('div');
  el.classList.add('card', isPink(card) ? 'pink' : 'blue');
  if (faceDown) el.classList.add('face-down');

  el.innerHTML = `
    <div class="card-inner">
      <div class="card-front">
        <span class="card-rank-top">${card.rank}<br><span class="suit-icon">${card.suit}</span></span>
        ${makePipHtml(card.rank, card.suit)}
        <span class="card-rank-bottom"><span class="suit-icon">${card.suit}</span><br>${card.rank}</span>
      </div>
      <div class="card-back">🐚</div>
    </div>`;
  return el;
}

function renderHand(containerId, hand, hideLast = false) {
  const wrap = document.getElementById(containerId);
  wrap.innerHTML = '';
  hand.forEach((card, i) => {
    const faceDown = hideLast && i === hand.length - 1;
    const el = makeCardEl(card, faceDown);
    el.style.animationDelay = (i * 0.14) + 's';
    wrap.appendChild(el);
  });
}

// Flip the face-down dealer card to reveal it
function revealHoleCard() {
  const wrap = document.getElementById('dealer-cards');
  const faceDown = wrap.querySelector('.card.face-down');
  if (faceDown) {
    // Removing face-down triggers the CSS flip transition
    faceDown.classList.remove('face-down');
  }
}

// ============================================================
// UI HELPERS
// ============================================================

function updateBalance() {
  document.getElementById('balance').textContent = state.balance.toLocaleString();
}

function updateBetDisplay() {
  document.getElementById('current-bet').textContent = state.currentBet.toLocaleString();
  renderChipStack();
}

function renderChipStack() {
  const wrap = document.getElementById('chip-stack');
  wrap.innerHTML = '';
  if (!state.currentBet) return;

  let rem = state.currentBet;
  for (const d of CHIP_DENOMS) {
    while (rem >= d) {
      const chip = document.createElement('div');
      chip.classList.add('chip-mini', `chip-${d}`);
      chip.textContent = d >= 1000 ? d/1000+'k' : d;
      wrap.appendChild(chip);
      rem -= d;
    }
  }
}

function updateHandValues() {
  // Player
  const pTotal = handTotal(state.playerHand);
  const pEl    = document.getElementById('player-value');
  pEl.textContent = state.playerHand.length ? pTotal : '--';
  pEl.className   = 'hand-value-badge';
  if (state.playerHand.length) {
    if (pTotal > 21)            pEl.classList.add('bust');
    else if (isBlackjack(state.playerHand)) pEl.classList.add('blackjack');
  }

  // Dealer (only show visible card values while hole hidden)
  const dEl = document.getElementById('dealer-value');
  if (!state.dealerHand.length) { dEl.textContent = '--'; dEl.className = 'hand-value-badge'; return; }

  if (state.holeHidden) {
    // Show value of all cards except the last (hole) card
    const visible = state.dealerHand.slice(0, state.dealerHand.length - 1);
    dEl.textContent = visible.length ? handTotal(visible) + '?' : '?';
    dEl.className   = 'hand-value-badge';
  } else {
    const dTotal = handTotal(state.dealerHand);
    dEl.textContent = dTotal;
    dEl.className   = 'hand-value-badge';
    if (dTotal > 21) dEl.classList.add('bust');
  }
}

function updateStats() {
  const s  = state.stats;
  const wr = s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0;

  document.getElementById('s-games').textContent   = s.games;
  document.getElementById('s-wins').textContent    = s.wins;
  document.getElementById('s-losses').textContent  = s.losses;
  document.getElementById('s-pushes').textContent  = s.pushes;
  document.getElementById('s-winrate').textContent = wr + '%';
  document.getElementById('winrate-fill').style.width = wr + '%';
  document.getElementById('s-bj').textContent      = s.blackjacks;
  document.getElementById('s-best').textContent    = '$' + s.bestWin;

  const streak = s.currentStreak;
  const streakEl = document.getElementById('s-streak');
  if (streak > 0)       streakEl.textContent = '🔥' + streak;
  else if (streak < 0)  streakEl.textContent = '❄️' + Math.abs(streak);
  else                  streakEl.textContent = '0';

  const pnlEl = document.getElementById('s-pnl');
  pnlEl.textContent = (s.pnl >= 0 ? '+$' : '-$') + Math.abs(s.pnl);
  pnlEl.className   = 'stat-num ' + (s.pnl >= 0 ? 'green' : 'red');
}

function showPhase(phase) {
  document.getElementById('betting-controls').classList.toggle('hidden', phase !== 'betting');
  document.getElementById('playing-controls').classList.toggle('hidden', phase !== 'playing');
  document.getElementById('result-controls').classList.toggle('hidden', phase !== 'result');
}

function showResult(text, type) {
  const banner = document.getElementById('result-banner');
  banner.className = 'result-banner ' + type;
  document.getElementById('result-text').textContent = text;
  banner.classList.remove('hidden');
}

function hideResult() {
  document.getElementById('result-banner').classList.add('hidden');
}

// ============================================================
// GAME FLOW
// ============================================================

function startRound() {
  if (state.balance <= 0) { showModal('gameover-modal'); return; }

  state.phase       = 'betting';
  state.playerHand  = [];
  state.dealerHand  = [];
  state.currentBet  = 0;
  state.holeHidden  = true;

  document.getElementById('player-cards').innerHTML = '';
  document.getElementById('dealer-cards').innerHTML = '';
  updateHandValues();
  updateBetDisplay();
  hideResult();
  showPhase('betting');
  document.getElementById('double-btn').classList.add('hidden');

  state.deck = shuffle(buildDeck());
}

// ── Betting ──────────────────────────────────────────────────

function addChip(amount) {
  if (state.phase !== 'betting') return;
  const maxBet = Math.min(state.balance, 1000);
  state.currentBet = Math.min(state.currentBet + amount, maxBet);
  SFX.chip();
  updateBetDisplay();
}

function clearBet() {
  if (state.phase !== 'betting') return;
  state.currentBet = 0;
  SFX.click();
  updateBetDisplay();
}

function deal() {
  if (state.phase !== 'betting') return;
  if (state.currentBet < 10) { shakeBet(); return; }
  if (state.currentBet > state.balance) { state.currentBet = state.balance; updateBetDisplay(); return; }

  state.balance -= state.currentBet;
  updateBalance();

  state.phase = 'playing';
  state.roundNumber++;
  state.deck = shuffle(buildDeck());

  // Deal 2 to player, 2 to dealer (dealer's last card is hole card)
  state.playerHand = [state.deck.pop(), state.deck.pop()];
  state.dealerHand = [state.deck.pop(), state.deck.pop()];

  renderHand('player-cards', state.playerHand);
  renderHand('dealer-cards', state.dealerHand, true); // hide last dealer card
  SFX.deal();

  setTimeout(() => {
    updateHandValues();
    const pBJ = isBlackjack(state.playerHand);
    const dBJ = isBlackjack(state.dealerHand);

    if (pBJ || dBJ) {
      // Immediate resolution
      state.holeHidden = false;
      revealHoleCard();
      setTimeout(() => {
        updateHandValues();
        if (pBJ && dBJ) endRound('push');
        else if (pBJ)   endRound('blackjack');
        else             endRound('loss');
      }, 650);
    } else {
      showPhase('playing');
      updateDoubleBtn();
    }
  }, 450);
}

function updateDoubleBtn() {
  const canDouble = state.playerHand.length === 2 && state.currentBet <= state.balance;
  document.getElementById('double-btn').classList.toggle('hidden', !canDouble);
}

function shakeBet() {
  const el = document.getElementById('current-bet');
  el.style.animation = 'none';
  requestAnimationFrame(() => { el.style.animation = 'shake 0.4s ease'; });
  setTimeout(() => { el.style.animation = ''; }, 420);
}

// ── Player actions ───────────────────────────────────────────

function hit() {
  if (state.phase !== 'playing') return;
  state.playerHand.push(state.deck.pop());
  renderHand('player-cards', state.playerHand);
  SFX.deal();
  document.getElementById('double-btn').classList.add('hidden');
  updateHandValues();

  if (isBust(state.playerHand)) {
    SFX.bust();
    state.holeHidden = false;
    revealHoleCard();
    setTimeout(() => { updateHandValues(); endRound('loss'); }, 600);
  }
}

function stand() {
  if (state.phase !== 'playing') return;
  SFX.click();
  state.holeHidden = false;
  revealHoleCard();
  setTimeout(() => { updateHandValues(); dealerPlay(); }, 650);
}

function doubleDown() {
  if (state.phase !== 'playing' || state.playerHand.length !== 2) return;

  const extra = Math.min(state.currentBet, state.balance);
  state.balance    -= extra;
  state.currentBet += extra;
  updateBalance();
  updateBetDisplay();
  SFX.chip();

  state.playerHand.push(state.deck.pop());
  renderHand('player-cards', state.playerHand);
  SFX.deal();
  document.getElementById('double-btn').classList.add('hidden');
  updateHandValues();

  setTimeout(() => {
    state.holeHidden = false;
    revealHoleCard();
    setTimeout(() => {
      updateHandValues();
      if (isBust(state.playerHand)) { SFX.bust(); endRound('loss'); }
      else dealerPlay();
    }, 650);
  }, 350);
}

// ── Dealer auto-play ─────────────────────────────────────────

function dealerPlay() {
  const next = () => {
    const dv = handTotal(state.dealerHand);
    if (dv < 17) {
      state.dealerHand.push(state.deck.pop());
      renderHand('dealer-cards', state.dealerHand);
      SFX.deal();
      updateHandValues();
      setTimeout(next, 620);
    } else {
      resolveRound();
    }
  };
  next();
}

function resolveRound() {
  const pv = handTotal(state.playerHand);
  const dv = handTotal(state.dealerHand);

  if      (isBust(state.dealerHand)) endRound('win');
  else if (pv > dv)                  endRound('win');
  else if (dv > pv)                  endRound('loss');
  else                               endRound('push');
}

// ── Round settlement ─────────────────────────────────────────

function endRound(outcome) {
  state.phase = 'result';
  state.stats.games++;

  let payout    = 0;
  let resultTxt = '';
  let resultCls = '';

  switch (outcome) {
    case 'blackjack':
      payout    = Math.floor(state.currentBet * 2.5); // bet back + 1.5× profit
      resultTxt = '⭐ BLACKJACK! ⭐';
      resultCls = 'blackjack';
      state.stats.wins++;
      state.stats.blackjacks++;
      SFX.blackjack();
      confetti(80);
      break;
    case 'win':
      payout    = state.currentBet * 2;               // bet back + 1× profit
      resultTxt = '🎉 You Win!';
      resultCls = 'win';
      state.stats.wins++;
      SFX.win();
      confetti(32);
      break;
    case 'loss':
      payout    = 0;
      resultTxt = isBust(state.playerHand) ? '💥 Bust!' : '😔 Dealer Wins';
      resultCls = 'loss';
      state.stats.losses++;
      SFX.lose();
      break;
    case 'push':
      payout    = state.currentBet;                   // bet returned
      resultTxt = '🤝 Push!';
      resultCls = 'push';
      state.stats.pushes++;
      SFX.push();
      break;
  }

  state.balance += payout;
  updateBalance();

  // Net change for history & stats
  const net = payout - state.currentBet;
  if (net > state.stats.bestWin) state.stats.bestWin = net;
  state.stats.pnl += net;

  // Streak
  if (outcome === 'win' || outcome === 'blackjack') {
    state.stats.currentStreak = Math.max(1, state.stats.currentStreak + 1);
  } else if (outcome === 'loss') {
    state.stats.currentStreak = Math.min(-1, state.stats.currentStreak - 1);
  } else {
    state.stats.currentStreak = 0;
  }

  addHistory(outcome, net);
  updateStats();
  showResult(resultTxt, resultCls);
  showPhase('result');
  save();

  if (state.balance <= 0) {
    document.getElementById('gameover-summary').textContent =
      `You played ${state.stats.games} rounds. Try again!`;
    setTimeout(() => showModal('gameover-modal'), 1800);
  }
}

// ============================================================
// HISTORY
// ============================================================

function addHistory(outcome, net) {
  state.history.unshift({ round: state.roundNumber, bet: state.currentBet, outcome, net });
  if (state.history.length > 20) state.history.pop();
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('history-list');
  if (!state.history.length) { list.innerHTML = '<p class="history-empty">No rounds played yet!</p>'; return; }

  const icons = { win: '✅', loss: '❌', push: '🤝', blackjack: '⭐' };
  list.innerHTML = state.history.map(e => {
    const sign = e.net > 0 ? '+' : '';
    return `<div class="history-entry ${e.outcome}">
      <span class="history-round">#${e.round}</span>
      <span class="history-result">${icons[e.outcome] ?? '?'} ${e.bet}</span>
      <span class="history-amount">${sign}${e.net}</span>
    </div>`;
  }).join('');
}

// ============================================================
// CONFETTI
// ============================================================

function confetti(count = 30) {
  const wrap   = document.getElementById('confetti-container');
  const colors = ['#FF1493','#FFD700','#32CD32','#00BFFF','#9370DB','#FF69B4','#00FF7F'];
  const shapes = ['■','●','▲','★','♥','♦'];

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const p       = document.createElement('div');
      p.classList.add('confetti-piece');
      p.textContent = shapes[Math.floor(Math.random() * shapes.length)];
      p.style.left           = Math.random() * 100 + 'vw';
      p.style.color          = colors[Math.floor(Math.random() * colors.length)];
      p.style.fontSize       = (Math.random() * 14 + 8) + 'px';
      p.style.animationDuration = (Math.random() * 2 + 1.5) + 's';
      p.style.animationDelay    = (Math.random() * 0.5) + 's';
      wrap.appendChild(p);
      setTimeout(() => p.remove(), 3500);
    }, i * 28);
  }
}

// ============================================================
// MODALS
// ============================================================

function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function hideModal(id) { document.getElementById(id).classList.add('hidden'); }

// ============================================================
// PERSISTENCE
// ============================================================

function save() {
  try {
    localStorage.setItem('bj_stats',    JSON.stringify(state.stats));
    localStorage.setItem('bj_balance',  String(state.balance));
    localStorage.setItem('bj_history',  JSON.stringify(state.history));
    localStorage.setItem('bj_settings', JSON.stringify(state.settings));
    localStorage.setItem('bj_round',    String(state.roundNumber));
  } catch (_) {}
}

function load() {
  try {
    const stats    = localStorage.getItem('bj_stats');
    const balance  = localStorage.getItem('bj_balance');
    const history  = localStorage.getItem('bj_history');
    const settings = localStorage.getItem('bj_settings');
    const round    = localStorage.getItem('bj_round');
    if (stats)    state.stats       = { ...DEFAULT_STATS,    ...JSON.parse(stats) };
    if (balance)  state.balance     = Math.max(0, parseInt(balance, 10));
    if (history)  state.history     = JSON.parse(history);
    if (settings) state.settings    = { ...DEFAULT_SETTINGS, ...JSON.parse(settings) };
    if (round)    state.roundNumber = parseInt(round, 10);
  } catch (e) { console.warn('Could not load saved state:', e); }
}

function resetGame() {
  state.balance     = 1000;
  state.stats       = { ...DEFAULT_STATS };
  state.history     = [];
  state.roundNumber = 0;
  save();
  updateBalance();
  updateStats();
  renderHistory();
  startRound();
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function bindEvents() {
  // Chip buttons
  document.querySelectorAll('.chip[data-amount]').forEach(btn =>
    btn.addEventListener('click', () => addChip(+btn.dataset.amount)));

  // Bet controls
  document.getElementById('clear-bet').addEventListener('click', clearBet);
  document.getElementById('deal-btn').addEventListener('click', deal);

  // Play controls
  document.getElementById('hit-btn').addEventListener('click', hit);
  document.getElementById('stand-btn').addEventListener('click', stand);
  document.getElementById('double-btn').addEventListener('click', doubleDown);

  // Next round
  document.getElementById('next-round-btn').addEventListener('click', startRound);

  // Footer
  document.getElementById('new-game-btn').addEventListener('click',   () => showModal('newgame-modal'));
  document.getElementById('rules-btn').addEventListener('click',      () => showModal('rules-modal'));
  document.getElementById('howtoplay-btn').addEventListener('click',  () => showModal('welcome-modal'));

  // Settings button — sync inputs before showing
  document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('sfx-on').checked = state.settings.sfx;
    document.getElementById('volume').value   = state.settings.volume;
    showModal('settings-modal');
  });

  // How-to-play modal close buttons
  document.getElementById('welcome-close').addEventListener('click', () => hideModal('welcome-modal'));
  document.getElementById('welcome-skip').addEventListener('click',  () => hideModal('welcome-modal'));

  // Modal close buttons
  document.getElementById('rules-close').addEventListener('click', () => hideModal('rules-modal'));

  document.getElementById('settings-close').addEventListener('click', () => {
    state.settings.sfx    = document.getElementById('sfx-on').checked;
    state.settings.volume = +document.getElementById('volume').value;
    save();
    hideModal('settings-modal');
  });

  document.getElementById('gameover-restart').addEventListener('click', () => {
    hideModal('gameover-modal');
    resetGame();
  });

  document.getElementById('newgame-cancel').addEventListener('click', ()  => hideModal('newgame-modal'));
  document.getElementById('newgame-confirm').addEventListener('click', () => { hideModal('newgame-modal'); resetGame(); });

  // Close modal when clicking the backdrop
  document.querySelectorAll('.modal-overlay').forEach(overlay =>
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); }));

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (state.phase === 'playing') {
      if (e.key === 'h' || e.key === 'H') hit();
      if (e.key === 's' || e.key === 'S') stand();
      if (e.key === 'd' || e.key === 'D') doubleDown();
    }
    if (state.phase === 'result' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      startRound();
    }
  });
}

// ============================================================
// INIT
// ============================================================

function init() {
  load();

  // Guard: if saved balance is 0, start fresh
  if (state.balance <= 0) {
    state.balance = 1000;
    state.roundNumber = 0;
  }

  // Apply saved settings to UI
  document.getElementById('sfx-on').checked = state.settings.sfx;
  document.getElementById('volume').value   = state.settings.volume;

  updateBalance();
  updateStats();
  renderHistory();
  bindEvents();
  startRound();
}

document.addEventListener('DOMContentLoaded', init);
