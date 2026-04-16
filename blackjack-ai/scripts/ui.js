// ── State ──────────────────────────────────────────────────────────────────
let lastRecommendation = null;
let playerFollowedAI = null;
let autoPlayAgent = null;
let debugVisible = false;

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  gameState.init();
  updateBalanceDisplay();
  setPhase('betting');
  bindEvents();
  Logger.info('Blackjack AI Garden initialized');
});

// ── Event Binding ──────────────────────────────────────────────────────────
function bindEvents() {
  // API key
  document.getElementById('save-key-btn').addEventListener('click', handlePastedKey);
  document.getElementById('api-key-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handlePastedKey();
  });

  // Bet chips
  document.querySelectorAll('.chip').forEach(chip =>
    chip.addEventListener('click', () => {
      const v = parseInt(chip.dataset.value);
      const inp = document.getElementById('bet-amount');
      inp.value = Math.min(gameState.balance, (parseInt(inp.value) || 0) + v);
    }));
  document.getElementById('clear-bet-btn').addEventListener('click', () =>
    document.getElementById('bet-amount').value = 0);

  // Deal
  document.getElementById('deal-btn').addEventListener('click', startHand);

  // Game actions
  document.getElementById('hit-btn').addEventListener('click', playerHit);
  document.getElementById('stand-btn').addEventListener('click', playerStand);
  document.getElementById('double-btn').addEventListener('click', playerDouble);
  document.getElementById('split-btn').addEventListener('click', playerSplit);

  // AI
  document.getElementById('ask-ai-btn').addEventListener('click', fetchAIRecommendation);

  // Auto-play
  document.getElementById('start-autoplay-btn').addEventListener('click', startAutoPlay);
  document.getElementById('stop-autoplay-btn').addEventListener('click', stopAutoPlay);

  // Result overlay
  document.getElementById('next-hand-btn').addEventListener('click', () => {
    document.getElementById('result-overlay').classList.remove('visible');
    setPhase('betting');
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      document.querySelectorAll(`.tab-btn[data-group="${group}"]`).forEach(b => b.classList.remove('active'));
      document.querySelectorAll(`.tab-pane[data-group="${group}"]`).forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const pane = document.getElementById(btn.dataset.tab);
      if (pane) { pane.classList.add('active'); if (btn.dataset.tab === 'tab-heatmap') renderStrategyHeatmap(); }
    }));

  // Debug panel
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      debugVisible = !debugVisible;
      document.getElementById('debug-panel').classList.toggle('hidden', !debugVisible);
    }
  });
  document.getElementById('clear-logs-btn').addEventListener('click', () => Logger.clear());
  document.getElementById('export-logs-btn').addEventListener('click', () => Logger.export());
  document.getElementById('log-level-select').addEventListener('change', e => {
    Logger.currentLevel = parseInt(e.target.value);
  });
}

// ── API Key Handling ───────────────────────────────────────────────────────
function handlePastedKey() {
  const input = document.getElementById('api-key-input');
  const key = input.value.trim();
  if (!key) { showMessage('Please paste your API key.', 'error'); return; }
  if (!key.startsWith('sk-')) { showMessage('API key should start with sk-', 'error'); return; }
  gameState.apiKey = key;
  input.value = '';
  document.getElementById('api-status').innerHTML = '<span class="status-badge loaded">✅ API Key Loaded</span>';
  Logger.info('API configured', { hasKey: true, keyLength: key.length });
  showMessage('API key saved!', 'success');
}

// ── Game Flow ──────────────────────────────────────────────────────────────
function startHand() {
  const bet = parseInt(document.getElementById('bet-amount').value) || 0;
  if (bet <= 0)              { showMessage('Please enter a bet amount.', 'error'); return; }
  if (bet > gameState.balance) { showMessage('Bet exceeds balance!', 'error'); return; }

  gameState.currentBet = bet;
  gameState.balance -= bet;
  gameState.resetHands();
  lastRecommendation = null;
  playerFollowedAI = null;
  updateBalanceDisplay();

  const deck = gameState.deck;
  gameState.playerHand.addCard(deck.draw());
  gameState.dealerHand.addCard(deck.draw());
  gameState.playerHand.addCard(deck.draw());
  gameState.dealerHand.addCard(deck.draw());

  Logger.info('Hand dealt', {
    playerHand: gameState.playerHand.cards.map(c => c.rank + c.suit),
    dealerUpcard: gameState.dealerHand.cards[0].rank
  });

  renderHands(false);
  setPhase('player-turn');

  if (gameState.playerHand.isBlackjack()) {
    setTimeout(() => resolveHand(), 600);
    return;
  }

  updateActionButtons();
  if (gameState.apiKey) fetchAIRecommendation();
}

async function playerHit() {
  if (lastRecommendation) playerFollowedAI = lastRecommendation.action === 'hit';
  const card = gameState.deck.draw();
  gameState.playerHand.addCard(card);
  Logger.info('Player hit', { card: card.rank + card.suit, total: gameState.playerHand.getValue() });
  renderHands(false);
  lastRecommendation = null;
  clearAIPanel();

  if (gameState.playerHand.isBusted()) {
    setTimeout(() => resolveHand(), 400);
    return;
  }
  updateActionButtons();
  if (gameState.apiKey) fetchAIRecommendation();
}

function playerStand() {
  if (lastRecommendation) playerFollowedAI = lastRecommendation.action === 'stand';
  Logger.info('Player stands', { total: gameState.playerHand.getValue() });
  runDealerTurn();
}

function playerDouble() {
  if (gameState.balance < gameState.currentBet) { showMessage("Not enough balance to double!", 'error'); return; }
  if (lastRecommendation) playerFollowedAI = lastRecommendation.action === 'double';
  gameState.balance -= gameState.currentBet;
  gameState.currentBet *= 2;
  updateBalanceDisplay();
  const card = gameState.deck.draw();
  gameState.playerHand.addCard(card);
  Logger.info('Player doubled', { card: card.rank + card.suit, total: gameState.playerHand.getValue(), bet: gameState.currentBet });
  renderHands(false);
  if (gameState.playerHand.isBusted()) { setTimeout(() => resolveHand(), 400); return; }
  runDealerTurn();
}

function playerSplit() {
  showMessage('Split is not yet implemented in this version.', 'info');
}

async function runDealerTurn() {
  setPhase('dealer-turn');
  renderHands(true);
  await delay(600);

  while (gameState.dealerHand.getValue() < 17) {
    const card = gameState.deck.draw();
    gameState.dealerHand.addCard(card);
    Logger.debug('Dealer draws', { card: card.rank + card.suit, total: gameState.dealerHand.getValue() });
    renderHands(true);
    await delay(500);
  }

  resolveHand();
}

function resolveHand() {
  const p = gameState.playerHand.getValue();
  const d = gameState.dealerHand.getValue();
  const playerBJ = gameState.playerHand.isBlackjack();
  const dealerBJ = gameState.dealerHand.isBlackjack();

  let result, payout, message;

  if (gameState.playerHand.isBusted()) {
    result = 'lose'; payout = -gameState.currentBet; message = '💔 Busted!';
  } else if (dealerBJ && !playerBJ) {
    result = 'lose'; payout = -gameState.currentBet; message = '🃏 Dealer Blackjack!';
  } else if (playerBJ && !dealerBJ) {
    payout = Math.floor(gameState.currentBet * 1.5);
    result = 'win'; message = '🌷 Blackjack! +$' + payout;
    gameState.balance += gameState.currentBet + payout;
    spawnPetals();
  } else if (gameState.dealerHand.isBusted()) {
    result = 'win'; payout = gameState.currentBet; message = '🌸 Dealer Busts! +$' + payout;
    gameState.balance += gameState.currentBet * 2;
    spawnPetals();
  } else if (p > d) {
    result = 'win'; payout = gameState.currentBet; message = '✨ You Win! +$' + payout;
    gameState.balance += gameState.currentBet * 2;
    spawnPetals();
  } else if (d > p) {
    result = 'lose'; payout = -gameState.currentBet; message = '🥀 Dealer Wins.';
  } else {
    result = 'push'; payout = 0; message = '🌼 Push — Bet Returned';
    gameState.balance += gameState.currentBet;
  }

  gameState.gameCount++;
  updateBalanceDisplay();
  renderHands(true);
  setPhase('game-over');

  const aiWasRight = lastRecommendation
    ? (result === 'win' && playerFollowedAI) || (result === 'lose' && !playerFollowedAI) ? true : false
    : null;

  analytics.recordHand(result, gameState.currentBet, payout,
    playerFollowedAI, aiWasRight,
    playerBJ, gameState.playerHand.isBusted());

  if (lastRecommendation) analytics.recordAICall(lastRecommendation.responseTime || 0);

  Logger.info('Hand resolved', { result, payout, balance: gameState.balance });
  showResultOverlay(message, payout);
}

// ── Rendering ──────────────────────────────────────────────────────────────
function renderHands(revealDealer) {
  renderCardRow('dealer-cards', gameState.dealerHand.cards, revealDealer ? null : 1);
  renderCardRow('player-cards', gameState.playerHand.cards, null);

  const pv = gameState.playerHand.getValue();
  const dv = revealDealer ? gameState.dealerHand.getValue() : '?';

  const pEl = document.getElementById('player-total');
  pEl.textContent = `Total: ${pv}`;
  pEl.className = 'hand-total' + (gameState.playerHand.isBusted() ? ' busted' : (gameState.playerHand.isBlackjack() ? ' blackjack' : ''));

  document.getElementById('dealer-total').textContent = revealDealer ? `Total: ${dv}` : `Showing: ${gameState.dealerHand.cards[0]?.rank || '?'}`;
}

function renderCardRow(containerId, cards, hiddenIndex) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  cards.forEach((card, i) => {
    const div = document.createElement('div');
    if (hiddenIndex !== null && i === hiddenIndex) {
      div.className = 'playing-card card-hidden animate-deal';
      div.innerHTML = `<div class="card-watermark">🌷</div>`;
    } else {
      div.className = `playing-card${card.red ? ' card-red' : ''} animate-deal`;
      div.style.animationDelay = `${i * 80}ms`;
      div.innerHTML = `
        <span class="card-rank">${card.rank}</span>
        <span class="card-suit">${card.suit}</span>
        <span class="card-rank-bottom">${card.rank}</span>
        <span class="card-watermark">🌷</span>`;
    }
    container.appendChild(div);
  });
}

// ── AI Panel ───────────────────────────────────────────────────────────────
async function fetchAIRecommendation() {
  if (!gameState.apiKey) { showMessage('Please upload your .env file first.', 'error'); return; }
  const panel = document.getElementById('ai-panel');
  panel.classList.add('thinking');
  document.getElementById('ai-content').innerHTML = '<div class="animate-thinking" style="text-align:center;padding:1rem;font-size:0.9rem;color:var(--text-secondary)">🌷 Thinking...</div>';

  try {
    const rec = await getAIRecommendation(gameState, gameState.apiKey);
    lastRecommendation = rec;
    renderAIRecommendation(rec);
    renderWhatIfPanel(gameState, rec);
    Logger.info('AI recommendation', { action: rec.action, confidence: rec.confidence, responseTime: rec.responseTime });
  } catch (err) {
    Logger.error('AI error', { message: err.message });
    if (err.code === 'auth') {
      gameState.apiKey = null;
      document.getElementById('api-status').innerHTML = '<span class="status-badge missing">❌ Invalid Key</span>';
    }
    const playerTotal = gameState.playerHand.getValue();
    const dealerUpcard = gameState.dealerHand.cards[0]?.value || 7;
    const fallback = getFallbackStrategy(playerTotal, dealerUpcard, gameState.playerHand.canDouble(), gameState.playerHand.canSplit(), gameState.playerHand);
    lastRecommendation = fallback;
    renderAIRecommendation(fallback);
    showMessage('AI unavailable — using basic strategy.', 'info');
  } finally {
    panel.classList.remove('thinking');
  }
}

function renderAIRecommendation(rec) {
  const confidence = ((rec.confidence || 0) * 100).toFixed(0);
  const alts = (rec.alternativeActions || []).map(a =>
    `<div class="alt-action"><span>${a.action?.toUpperCase()}</span> <span style="color:var(--text-secondary);font-size:0.75rem">EV ${(a.expectedValue ?? 0).toFixed(2)} | ${((a.confidence||0)*100).toFixed(0)}%</span></div>`
  ).join('');

  document.getElementById('ai-content').innerHTML = `
    <div class="ai-header">
      <span style="font-weight:600;color:var(--text-secondary)">Recommended:</span>
      <span class="ai-action-badge">${(rec.action || 'N/A').toUpperCase()}</span>
      ${rec.source === 'fallback' ? '<span style="font-size:0.75rem;color:var(--text-secondary)">(Basic Strategy)</span>' : ''}
    </div>
    <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.3rem">${confidence}% confidence | EV ${(rec.expectedValue ?? 0).toFixed(2)} | Risk: ${rec.riskAssessment || 'N/A'}</div>
    <div class="confidence-meter"><div class="confidence-fill" style="width:${confidence}%"></div></div>
    <p class="reasoning-text">${rec.reasoning || ''}</p>
    ${alts ? `<div class="alternatives">${alts}</div>` : ''}`;
}

function clearAIPanel() {
  document.getElementById('ai-content').innerHTML = '<p style="color:var(--text-secondary);font-size:0.9rem;text-align:center;padding:0.5rem">Hit the AI button for a recommendation</p>';
}

// ── Phase & Buttons ────────────────────────────────────────────────────────
function setPhase(phase) {
  gameState.phase = phase;
  const isBetting = phase === 'betting';
  const isPlayer = phase === 'player-turn';

  document.getElementById('bet-section').style.display = isBetting ? 'flex' : 'none';
  document.getElementById('deal-btn').style.display   = isBetting ? 'inline-block' : 'none';
  document.getElementById('game-controls').style.display = isPlayer ? 'flex' : 'none';
  document.getElementById('ask-ai-btn').style.display    = isPlayer ? 'inline-block' : 'none';

  if (isBetting) clearAIPanel();
}

function updateActionButtons() {
  document.getElementById('double-btn').disabled = !gameState.playerHand.canDouble() || gameState.balance < gameState.currentBet;
  document.getElementById('split-btn').disabled  = !gameState.playerHand.canSplit();
}

function updateBalanceDisplay() {
  document.getElementById('balance-display').textContent = `💰 $${gameState.balance}`;
  document.getElementById('current-bet-display').textContent = gameState.currentBet > 0 ? `Bet: $${gameState.currentBet}` : '';
}

// ── Result Overlay ─────────────────────────────────────────────────────────
function showResultOverlay(message, payout) {
  const overlay = document.getElementById('result-overlay');
  document.getElementById('result-title').textContent = message;
  const amountEl = document.getElementById('result-amount');
  if (payout !== 0) {
    amountEl.textContent = (payout > 0 ? '+' : '') + '$' + payout;
    amountEl.className = 'result-amount ' + (payout > 0 ? 'win' : 'lose');
  } else {
    amountEl.textContent = 'Bet returned';
    amountEl.className = 'result-amount';
  }
  document.getElementById('result-balance').textContent = `Balance: $${gameState.balance}`;
  overlay.classList.add('visible');
}

// ── Auto-Play ──────────────────────────────────────────────────────────────
function startAutoPlay() {
  if (!gameState.apiKey) { showMessage('Auto-play requires an API key.', 'error'); return; }
  const settings = {
    betSize: parseInt(document.getElementById('auto-bet').value) || 50,
    stopOnBankroll: parseInt(document.getElementById('stop-loss').value) || 500,
    stopOnProfit: parseInt(document.getElementById('stop-profit').value) || 2000,
    maxHands: parseInt(document.getElementById('max-hands').value) || 100,
    delayBetweenHands: 2500
  };

  autoPlayAgent = new AutoPlayAgent(settings);
  document.getElementById('start-autoplay-btn').disabled = true;
  document.getElementById('stop-autoplay-btn').disabled = false;
  document.getElementById('autoplay-status').textContent = 'Running...';
  Logger.info('Auto-play started', settings);
  autoPlayAgent.start();
}

function stopAutoPlay() {
  if (autoPlayAgent) autoPlayAgent.stop();
  document.getElementById('start-autoplay-btn').disabled = false;
  document.getElementById('stop-autoplay-btn').disabled = true;
  document.getElementById('autoplay-status').textContent = 'Stopped';
  Logger.info('Auto-play stopped');
}

class AutoPlayAgent {
  constructor(settings) {
    this.settings = settings;
    this.isRunning = false;
    this.handsPlayed = 0;
  }

  async start() {
    this.isRunning = true;
    while (this.isRunning && this.shouldContinue()) {
      await this.playHand();
      this.handsPlayed++;
      document.getElementById('autoplay-status').textContent = `Hand ${this.handsPlayed}...`;
      await delay(this.settings.delayBetweenHands);
    }
    if (this.isRunning) {
      this.stop();
      showMessage('Auto-play finished.', 'info');
    }
  }

  stop() {
    this.isRunning = false;
    document.getElementById('start-autoplay-btn').disabled = false;
    document.getElementById('stop-autoplay-btn').disabled = true;
    document.getElementById('autoplay-status').textContent = 'Idle';
  }

  shouldContinue() {
    return gameState.balance > this.settings.stopOnBankroll &&
           gameState.balance < this.settings.stopOnProfit &&
           this.handsPlayed < this.settings.maxHands;
  }

  async playHand() {
    const bet = Math.min(this.settings.betSize, gameState.balance);
    document.getElementById('bet-amount').value = bet;
    startHand();
    await delay(1000);

    while (gameState.phase === 'player-turn') {
      let action;
      if (lastRecommendation) {
        action = lastRecommendation.action;
      } else {
        const dv = gameState.dealerHand.cards[0]?.value || 7;
        const rec = getFallbackStrategy(gameState.playerHand.getValue(), dv, gameState.playerHand.canDouble(), gameState.playerHand.canSplit(), gameState.playerHand);
        action = rec.action;
      }

      if (action === 'hit')    { playerHit(); }
      else if (action === 'double' && !document.getElementById('double-btn').disabled) { playerDouble(); }
      else { playerStand(); }

      await delay(800);
    }

    await delay(1500);
    document.getElementById('result-overlay').classList.remove('visible');
  }
}

// ── Petals ─────────────────────────────────────────────────────────────────
function spawnPetals() {
  for (let i = 0; i < 12; i++) {
    setTimeout(() => {
      const petal = document.createElement('div');
      petal.className = 'petal';
      petal.textContent = ['🌷','🌸','✨','🌺'][Math.floor(Math.random()*4)];
      petal.style.left = Math.random() * 100 + 'vw';
      petal.style.top = '-2rem';
      petal.style.animationDuration = (1.5 + Math.random() * 2) + 's';
      document.body.appendChild(petal);
      petal.addEventListener('animationend', () => petal.remove());
    }, i * 120);
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────
function showMessage(text, type) {
  const banner = document.getElementById('message-banner');
  banner.textContent = text;
  banner.className = type;
  clearTimeout(banner._timeout);
  banner._timeout = setTimeout(() => { banner.className = ''; }, 4000);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
