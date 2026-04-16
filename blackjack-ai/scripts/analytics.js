const analytics = {
  sessionStats: {
    handsPlayed: 0, handsWon: 0, handsLost: 0, handsPushed: 0,
    blackjacks: 0, busts: 0, totalWagered: 0, totalWinnings: 0,
    peakBalance: 1000, lowestBalance: 1000
  },
  aiPerformance: {
    recommendationsFollowed: 0, recommendationsIgnored: 0,
    correctPredictions: 0, incorrectPredictions: 0,
    totalResponseTime: 0, calls: 0
  },
  handHistory: [],
  balanceHistory: [{ hand: 0, balance: 1000 }],

  recordHand(result, bet, payout, playerFollowedAI, aiWasRight, blackjack, bust) {
    const s = this.sessionStats;
    s.handsPlayed++;
    s.totalWagered += bet;
    s.totalWinnings += payout;
    if (result === 'win')  { s.handsWon++;    if (blackjack) s.blackjacks++; }
    if (result === 'lose') { s.handsLost++;   if (bust) s.busts++; }
    if (result === 'push') s.handsPushed++;

    const balance = gameState.balance;
    if (balance > s.peakBalance)   s.peakBalance   = balance;
    if (balance < s.lowestBalance) s.lowestBalance = balance;

    this.balanceHistory.push({ hand: s.handsPlayed, balance });

    if (playerFollowedAI !== null) {
      if (playerFollowedAI) s.recommendationsFollowed++; else s.recommendationsIgnored++;
      if (aiWasRight !== null) {
        if (aiWasRight) s.correctPredictions++; else s.incorrectPredictions++;
      }
    }

    this.handHistory.unshift({ hand: s.handsPlayed, result, bet, payout, balance });
    if (this.handHistory.length > 50) this.handHistory.pop();

    this.updateDashboard();
    this.updateBalanceChart();
    this.updateHandHistory();
  },

  recordAICall(responseTime) {
    this.aiPerformance.calls++;
    this.aiPerformance.totalResponseTime += responseTime;
  },

  winRate() {
    return this.sessionStats.handsPlayed > 0
      ? (this.sessionStats.handsWon / this.sessionStats.handsPlayed * 100).toFixed(1)
      : '0.0';
  },

  aiAccuracy() {
    const total = this.aiPerformance.correctPredictions + this.aiPerformance.incorrectPredictions;
    return total > 0 ? (this.aiPerformance.correctPredictions / total * 100).toFixed(1) : '0.0';
  },

  avgBet() {
    return this.sessionStats.handsPlayed > 0
      ? (this.sessionStats.totalWagered / this.sessionStats.handsPlayed).toFixed(0)
      : '0';
  },

  updateDashboard() {
    const s = this.sessionStats;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('stat-hands', s.handsPlayed);
    set('stat-wins', s.handsWon);
    set('stat-win-rate', this.winRate() + '%');
    set('stat-net', (s.totalWinnings >= 0 ? '+' : '') + '$' + s.totalWinnings);
    set('stat-blackjacks', s.blackjacks);
    set('stat-busts', s.busts);
    set('stat-avg-bet', '$' + this.avgBet());
    set('stat-peak', '$' + s.peakBalance);

    const accuracy = parseFloat(this.aiAccuracy());
    const fill = document.getElementById('accuracy-fill');
    const label = document.getElementById('accuracy-label');
    if (fill)  fill.style.width = accuracy + '%';
    if (label) label.textContent = accuracy + '% AI accuracy';
  },

  updateHandHistory() {
    const el = document.getElementById('hand-history');
    if (!el) return;
    el.innerHTML = this.handHistory.map(h => `
      <div class="history-row">
        <span>#${h.hand}</span>
        <span class="${h.result}">${h.result.toUpperCase()}</span>
        <span>Bet $${h.bet}</span>
        <span>${h.payout >= 0 ? '+' : ''}$${h.payout}</span>
        <span>Bal $${h.balance}</span>
      </div>`
    ).join('');
  },

  updateBalanceChart() {
    const canvas = document.getElementById('balance-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const data = this.balanceHistory;
    const w = canvas.offsetWidth || 300;
    const h = canvas.offsetHeight || 80;
    canvas.width = w;
    canvas.height = h;

    if (data.length < 2) return;
    ctx.clearRect(0, 0, w, h);

    const min = Math.min(...data.map(d => d.balance));
    const max = Math.max(...data.map(d => d.balance));
    const range = max - min || 1;
    const pad = 8;

    const xOf = i => pad + (i / (data.length - 1)) * (w - pad * 2);
    const yOf = b => h - pad - ((b - min) / range) * (h - pad * 2);

    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(data[0].balance));
    for (let i = 1; i < data.length; i++) ctx.lineTo(xOf(i), yOf(data[i].balance));

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#A8E6CF');
    grad.addColorStop(1, '#A855F7');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineTo(xOf(data.length - 1), h);
    ctx.lineTo(xOf(0), h);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, 0, 0, h);
    fill.addColorStop(0, 'rgba(168,230,207,0.3)');
    fill.addColorStop(1, 'rgba(168,230,207,0)');
    ctx.fillStyle = fill;
    ctx.fill();
  }
};
