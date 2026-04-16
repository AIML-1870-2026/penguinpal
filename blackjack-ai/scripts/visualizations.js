function renderStrategyHeatmap() {
  const canvas = document.getElementById('strategy-heatmap');
  if (!canvas) return;

  const dealerCards = ['2','3','4','5','6','7','8','9','10','A'];
  const playerTotals = [21,20,19,18,17,16,15,14,13,12,11,10,9,8];

  const cellSize = 28;
  const labelW = 30;
  const labelH = 24;
  const cols = dealerCards.length;
  const rows = playerTotals.length;

  canvas.width  = labelW + cols * cellSize;
  canvas.height = labelH + rows * cellSize;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#718096';
  ctx.textAlign = 'center';
  dealerCards.forEach((c, i) => ctx.fillText(c, labelW + i * cellSize + cellSize / 2, 14));
  ctx.textAlign = 'right';
  playerTotals.forEach((t, i) => ctx.fillText(t, labelW - 4, labelH + i * cellSize + cellSize / 2 + 4));

  const colors = { stand: '#68D391', hit: '#F6AD55', double: '#63B3ED', split: '#FC8181' };

  playerTotals.forEach((pt, row) => {
    dealerCards.forEach((dc, col) => {
      const dv = dc === 'A' ? 11 : (dc === '10' ? 10 : parseInt(dc));
      const action = basicStrategyLookup(pt, dv);
      ctx.fillStyle = colors[action] || '#E2E8F0';
      ctx.fillRect(labelW + col * cellSize + 1, labelH + row * cellSize + 1, cellSize - 2, cellSize - 2);
      ctx.fillStyle = '#2D3748';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(action[0].toUpperCase(), labelW + col * cellSize + cellSize / 2, labelH + row * cellSize + cellSize / 2 + 3);
    });
  });

  const legend = [['S','stand','#68D391'],['H','hit','#F6AD55'],['D','double','#63B3ED'],['P','split','#FC8181']];
  let lx = labelW;
  const ly = labelH + rows * cellSize + 4;
  ctx.font = '10px sans-serif';
  legend.forEach(([lbl, , color]) => {
    ctx.fillStyle = color;
    ctx.fillRect(lx, ly, 14, 10);
    ctx.fillStyle = '#2D3748';
    ctx.textAlign = 'left';
    ctx.fillText('=' + lbl, lx + 16, ly + 9);
    lx += 56;
  });
  canvas.height = ly + 18;
}

function basicStrategyLookup(playerTotal, dealerUpcard) {
  const d = dealerUpcard;
  if (playerTotal >= 17) return 'stand';
  if (playerTotal >= 13 && playerTotal <= 16) return d <= 6 ? 'stand' : 'hit';
  if (playerTotal === 12) return (d >= 4 && d <= 6) ? 'stand' : 'hit';
  if (playerTotal === 11) return 'double';
  if (playerTotal === 10) return d <= 9 ? 'double' : 'hit';
  if (playerTotal === 9)  return (d >= 3 && d <= 6) ? 'double' : 'hit';
  return 'hit';
}

function renderWhatIfPanel(state, recommendation) {
  const container = document.getElementById('what-if-result');
  if (!container) return;

  const playerTotal = state.playerHand.getValue();
  const bustProb = calculateBustProbability(playerTotal);

  container.innerHTML = `
    <div class="probability-table">
      <table>
        <thead><tr><th>Outcome</th><th>If HIT</th><th>If STAND</th></tr></thead>
        <tbody>
          <tr><td>Win</td><td>${(recommendation.action === 'hit' ? recommendation.confidence * 100 : (1 - recommendation.confidence) * 60).toFixed(0)}%</td><td>${(recommendation.action === 'stand' ? recommendation.confidence * 100 : (1 - recommendation.confidence) * 40).toFixed(0)}%</td></tr>
          <tr><td>Bust</td><td>${bustProb.toFixed(0)}%</td><td>0%</td></tr>
          <tr><td>Push</td><td>~8%</td><td>~12%</td></tr>
        </tbody>
      </table>
    </div>`;
}

function calculateBustProbability(playerTotal) {
  if (playerTotal >= 21) return 100;
  if (playerTotal <= 10) return 0;
  const safe = 21 - playerTotal;
  const safeCards = Math.min(safe, 10);
  return Math.max(0, ((10 - safeCards) / 13 * 100));
}
