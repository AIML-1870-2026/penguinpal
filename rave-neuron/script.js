/* ========================================================
   Rave Decision Neuron – Doomscroll, Sleep, or Study?
   3-class softmax with time-zone biases
   ======================================================== */

// ── DOM refs ──
const $ = (s) => document.querySelector(s);

const sliderTime = $('#slider-time');
const sliderSpiciness = $('#slider-spiciness');
const sliderResponsibility = $('#slider-responsibility');
const sliderEnergy = $('#slider-energy');
const sliderFomo = $('#slider-fomo');
const sliderBias = $('#slider-bias');
const sliderSpeed = $('#slider-speed');

const valTime = $('#val-time');
const valSpiciness = $('#val-spiciness');
const valResponsibility = $('#val-responsibility');
const valEnergy = $('#val-energy');
const valFomo = $('#val-fomo');
const valBias = $('#val-bias');

const decisionText = $('#decision-text');
const decisionEmoji = $('#decision-emoji');
const probBarSleep = $('#prob-bar-sleep');
const probBarScroll = $('#prob-bar-scroll');
const probBarWork = $('#prob-bar-work');
const pctSleep = $('#pct-sleep');
const pctScroll = $('#pct-scroll');
const pctWork = $('#pct-work');
const mathText = $('#math-text');
const weightTimeEl = $('#weight-time');
const timeMessage = $('#time-message');
const timeGroup = $('#time-group');

const btnStep = $('#btn-step');
const btnTrain = $('#btn-train');
const btnReset = $('#btn-reset');
const btnLabelScroll = $('#btn-label-scroll');
const btnLabelSleep = $('#btn-label-sleep');
const btnLabelWork = $('#btn-label-work');

const statSteps = $('#stat-steps');
const statAccuracy = $('#stat-accuracy');
const weightsDisplay = $('#weights-display');

const bgCanvas = $('#bg-canvas');
const neuronCanvas = $('#neuron-canvas');
const plotCanvas = $('#plot-canvas');

const bgCtx = bgCanvas.getContext('2d');
const neuronCtx = neuronCanvas.getContext('2d');
const plotCtx = plotCanvas.getContext('2d');

// ── Classes: 0=scroll, 1=sleep, 2=work ──
const CLASS_SCROLL = 0;
const CLASS_SLEEP = 1;
const CLASS_WORK = 2;
const CLASS_NAMES = ['Scroll', 'Sleep', 'Work'];
const CLASS_COLORS = ['#00ffff', '#b080ff', '#00ff00'];
const CLASS_COLORS_RGB = [[0,255,255], [160,80,255], [0,255,0]];

// ── 3-class neuron weights (5 inputs each + bias) ──
// Inputs: [time/24, spiciness, responsibility, energy, fomo]
const initialWeights = [
  // Scroll: loves spiciness, fomo, energy; dislikes responsibility
  [0.3, 1.2, -0.8, 0.7, 0.9],
  // Sleep: dislikes spiciness, fomo; likes responsibility (go to bed!)
  [0.1, -0.6, 0.8, -0.9, -0.5],
  // Work: likes responsibility, moderate energy; dislikes spiciness, fomo
  [-0.2, -0.5, 1.0, 0.5, -0.7]
];
const initialBiases = [0.3, 0.0, 0.0];

let weights = initialWeights.map(row => [...row]);
let biases = [...initialBiases];

// ── Time zone: returns [scrollBoost, sleepBoost, workBoost] ──
function getTimeBoosts(t) {
  // Normalize to 0-24
  const h = ((t % 24) + 24) % 24;
  if ((h >= 20) || (h < 2.5)) {
    // 8 PM – 2:30 AM → doomscroll zone
    return [1.5, -0.5, -1.0];
  } else if (h >= 2.5 && h < 7) {
    // 2:30 AM – 7 AM → sleep zone
    return [-0.5, 1.5, -1.0];
  } else {
    // 7 AM – 8 PM → schoolwork zone
    return [-0.8, -0.5, 1.5];
  }
}

function getTimeZone(t) {
  const h = ((t % 24) + 24) % 24;
  if ((h >= 20) || (h < 2.5)) return 'scroll';
  if (h >= 2.5 && h < 7) return 'sleep';
  return 'work';
}

// ── Training state ──
let trainingPoints = [];   // { x: time (0-24), y: spiciness (0-1), label: 0|1|2 }
let pendingLabel = null;    // 0=scroll, 1=sleep, 2=work
let pendingClick = null;
let trainSteps = 0;
let autoTraining = false;
let autoTrainInterval = null;
let celebrationDone = false;

// ── Background particles ──
let stars = [];
let orbs = [];
const STAR_COUNT = 150;
const ORB_COUNT = 12;
const BPM = 120;
let beatPhase = 0;

// ── Helpers ──
function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map(z => Math.exp(z - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sum);
}

function formatHour(h) {
  const hour24 = ((h % 24) + 24) % 24;
  const hh = Math.floor(hour24);
  const mm = Math.round((hour24 - hh) * 60);
  const suffix = hh < 12 ? 'AM' : 'PM';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${String(mm).padStart(2, '0')} ${suffix}`;
}

function fmtW(v) { return (v >= 0 ? '+' : '') + v.toFixed(2); }

// ── Compute 3-class output ──
function computeLogits(time, spiciness, responsibility, energy, fomo, gremlinBias) {
  const inputs = [time / 24, spiciness, responsibility, energy, fomo];
  const boosts = getTimeBoosts(time);
  const logits = [0, 0, 0];

  for (let c = 0; c < 3; c++) {
    let z = biases[c] + boosts[c];
    for (let i = 0; i < 5; i++) {
      z += weights[c][i] * inputs[i];
    }
    // Gremlin bias slider adds to scroll class
    if (c === CLASS_SCROLL) z += gremlinBias;
    logits[c] = z;
  }
  return logits;
}

function computeOutput() {
  const time = parseFloat(sliderTime.value);
  const spiciness = parseFloat(sliderSpiciness.value);
  const responsibility = parseFloat(sliderResponsibility.value);
  const energy = parseFloat(sliderEnergy.value);
  const fomo = parseFloat(sliderFomo.value);
  const gremlinBias = parseFloat(sliderBias.value);

  const logits = computeLogits(time, spiciness, responsibility, energy, fomo, gremlinBias);
  const probs = softmax(logits);
  const winner = probs.indexOf(Math.max(...probs));

  return { logits, probs, winner, time, spiciness, responsibility, energy, fomo, gremlinBias };
}

// ── Update UI ──
function update() {
  const { logits, probs, winner, time, spiciness, responsibility, energy, fomo, gremlinBias } = computeOutput();

  // Slider value labels
  valTime.textContent = formatHour(time);
  valSpiciness.textContent = spiciness.toFixed(2);
  valResponsibility.textContent = responsibility.toFixed(2);
  valEnergy.textContent = energy.toFixed(2);
  valFomo.textContent = fomo.toFixed(2);
  valBias.textContent = fmtW(gremlinBias);

  // Time zone indicator
  const zone = getTimeZone(time);
  timeGroup.classList.remove('zone-scroll', 'zone-sleep', 'zone-work');
  timeGroup.classList.add('zone-' + zone);

  const boosts = getTimeBoosts(time);
  weightTimeEl.textContent = `zone: ${zone}`;
  if (zone === 'scroll') {
    timeMessage.textContent = "Peak doomscroll hours! (8 PM - 2:30 AM)";
    timeMessage.style.color = '#00ffff';
  } else if (zone === 'sleep') {
    timeMessage.textContent = "Go to bed! (2:30 AM - 7 AM)";
    timeMessage.style.color = '#b080ff';
  } else {
    timeMessage.textContent = "Time to be productive! (7 AM - 8 PM)";
    timeMessage.style.color = '#00ff00';
  }

  // Probability bars
  probBarScroll.style.width = (probs[0] * 100).toFixed(1) + '%';
  probBarSleep.style.width = (probs[1] * 100).toFixed(1) + '%';
  probBarWork.style.width = (probs[2] * 100).toFixed(1) + '%';
  pctScroll.textContent = (probs[0] * 100).toFixed(0) + '%';
  pctSleep.textContent = (probs[1] * 100).toFixed(0) + '%';
  pctWork.textContent = (probs[2] * 100).toFixed(0) + '%';

  // Decision text
  decisionText.classList.remove('scroll', 'sleep', 'work', 'uncertain');
  if (winner === CLASS_SCROLL) {
    decisionText.textContent = 'KEEP SCROLLING!';
    decisionText.classList.add('scroll');
    decisionEmoji.textContent = '\u{1F4F1}\u2728';
  } else if (winner === CLASS_SLEEP) {
    decisionText.textContent = 'GO TO BED!';
    decisionText.classList.add('sleep');
    decisionEmoji.textContent = '\u{1F634}\u{1F319}';
  } else {
    decisionText.textContent = 'DO SCHOOLWORK!';
    decisionText.classList.add('work');
    decisionEmoji.textContent = '\u{1F4DA}\u270F\uFE0F';
  }

  // Math display
  const inputs = [time / 24, spiciness, responsibility, energy, fomo];
  let mathStr = '';
  for (let c = 0; c < 3; c++) {
    const name = CLASS_NAMES[c];
    let terms = [];
    for (let i = 0; i < 5; i++) {
      terms.push(`(${fmtW(weights[c][i])} x ${inputs[i].toFixed(2)})`);
    }
    const extra = c === CLASS_SCROLL ? ` + gremlin(${fmtW(gremlinBias)})` : '';
    mathStr += `z_${name} = ${terms.join(' + ')} + bias(${fmtW(biases[c])}) + zone(${fmtW(boosts[c])})${extra}\n`;
    mathStr += `       = ${logits[c].toFixed(3)}\n`;
  }
  mathStr += `\nsoftmax → Scroll: ${(probs[0]*100).toFixed(1)}%  Sleep: ${(probs[1]*100).toFixed(1)}%  Work: ${(probs[2]*100).toFixed(1)}%`;
  mathStr += `\nDecision: ${CLASS_NAMES[winner]} ${winner === 0 ? '\u{1F4F1}' : winner === 1 ? '\u{1F634}' : '\u{1F4DA}'}`;
  mathText.textContent = mathStr;

  // Weights display
  updateWeightsDisplay();
  saveState();
}

function updateWeightsDisplay() {
  const inputLabels = ['Time', 'Spicy', 'Resp', 'Energy', 'FOMO'];
  let html = '';
  for (let c = 0; c < 3; c++) {
    html += `<span class="w-item" style="color:${CLASS_COLORS[c]};font-weight:700">${CLASS_NAMES[c]}:</span> `;
    for (let i = 0; i < 5; i++) {
      const v = weights[c][i];
      const arrow = v >= 0 ? '\u2191' : '\u2193';
      html += `<span class="w-item">${inputLabels[i]}:${fmtW(v)}${arrow}</span>`;
    }
    html += `<span class="w-item">b:${fmtW(biases[c])}</span> `;
  }
  weightsDisplay.innerHTML = html;
}

// ── LocalStorage ──
function saveState() {
  const state = {
    sliders: {
      time: sliderTime.value,
      spiciness: sliderSpiciness.value,
      responsibility: sliderResponsibility.value,
      energy: sliderEnergy.value,
      fomo: sliderFomo.value,
      bias: sliderBias.value
    }
  };
  localStorage.setItem('rave-neuron-state', JSON.stringify(state));
}

function loadState() {
  try {
    const state = JSON.parse(localStorage.getItem('rave-neuron-state'));
    if (state && state.sliders) {
      sliderTime.value = state.sliders.time;
      sliderSpiciness.value = state.sliders.spiciness;
      sliderResponsibility.value = state.sliders.responsibility;
      sliderEnergy.value = state.sliders.energy;
      sliderFomo.value = state.sliders.fomo;
      sliderBias.value = state.sliders.bias;
    }
  } catch (e) { /* ignore */ }
}

// ── Slider listeners ──
[sliderTime, sliderSpiciness, sliderResponsibility, sliderEnergy, sliderFomo, sliderBias].forEach(s => {
  s.addEventListener('input', update);
});

// ── Background stars ──
const STAR_COLORS = [
  [0, 255, 255], [255, 0, 255], [0, 255, 0],
  [255, 20, 147], [100, 100, 255], [255, 230, 0],
  [200, 180, 255]
];

function initStars() {
  stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const color = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
    stars.push({
      x: Math.random() * bgCanvas.width,
      y: Math.random() * bgCanvas.height,
      r: Math.random() * 2 + 0.3,
      speed: Math.random() * 0.3 + 0.05,
      phase: Math.random() * Math.PI * 2,
      color
    });
  }
  orbs = [];
  for (let i = 0; i < ORB_COUNT; i++) {
    const color = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
    orbs.push({
      x: Math.random() * bgCanvas.width,
      y: Math.random() * bgCanvas.height,
      r: Math.random() * 40 + 20,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.3,
      phase: Math.random() * Math.PI * 2,
      color
    });
  }
}

function resizeBgCanvas() {
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
  initStars();
}

function drawBackground(t) {
  const W = bgCanvas.width, H = bgCanvas.height;
  bgCtx.clearRect(0, 0, W, H);

  // Subtle gradient background pulse
  const bgPulse = 0.5 + 0.5 * Math.sin(t * 0.0005);
  const grad = bgCtx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
  grad.addColorStop(0, `rgba(20, 5, 40, ${0.3 + bgPulse * 0.1})`);
  grad.addColorStop(0.5, `rgba(10, 2, 25, ${0.15 + bgPulse * 0.05})`);
  grad.addColorStop(1, 'rgba(2, 0, 8, 0)');
  bgCtx.fillStyle = grad;
  bgCtx.fillRect(0, 0, W, H);

  // Floating orbs (large soft glowing blobs)
  for (const o of orbs) {
    o.x += o.vx;
    o.y += o.vy;
    if (o.x < -o.r) o.x = W + o.r;
    if (o.x > W + o.r) o.x = -o.r;
    if (o.y < -o.r) o.y = H + o.r;
    if (o.y > H + o.r) o.y = -o.r;

    const pulse = 0.4 + 0.3 * Math.sin(t * 0.001 + o.phase);
    const [r, g, b] = o.color;
    const og = bgCtx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
    og.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${pulse * 0.12})`);
    og.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${pulse * 0.04})`);
    og.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    bgCtx.fillStyle = og;
    bgCtx.fillRect(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
  }

  // Neon grid (subtle perspective grid at the bottom)
  const gridY = H * 0.65;
  const gridAlpha = 0.06 + 0.03 * Math.sin(t * 0.001);
  bgCtx.strokeStyle = `rgba(0, 255, 255, ${gridAlpha})`;
  bgCtx.lineWidth = 0.5;
  const gridSpacing = 50;
  const gridScroll = (t * 0.02) % gridSpacing;
  // Horizontal lines
  for (let y = gridY; y < H; y += gridSpacing) {
    const alpha = gridAlpha * (1 - (y - gridY) / (H - gridY)) * 2;
    bgCtx.strokeStyle = `rgba(0, 255, 255, ${Math.max(0, alpha)})`;
    bgCtx.beginPath();
    bgCtx.moveTo(0, y + gridScroll);
    bgCtx.lineTo(W, y + gridScroll);
    bgCtx.stroke();
  }
  // Vertical lines (converging toward center)
  for (let x = 0; x < W; x += gridSpacing) {
    bgCtx.strokeStyle = `rgba(255, 0, 255, ${gridAlpha * 0.5})`;
    bgCtx.beginPath();
    bgCtx.moveTo(x, gridY);
    bgCtx.lineTo(x, H);
    bgCtx.stroke();
  }

  // Stars (colorful twinkling)
  for (const s of stars) {
    const flicker = 0.4 + 0.6 * Math.sin(t * 0.001 * s.speed * 10 + s.phase);
    const [r, g, b] = s.color;
    bgCtx.beginPath();
    bgCtx.arc(s.x, s.y, s.r * (0.8 + flicker * 0.4), 0, Math.PI * 2);
    bgCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${flicker * 0.8})`;
    bgCtx.fill();

    // Tiny glow on brighter stars
    if (s.r > 1.2 && flicker > 0.7) {
      const sg = bgCtx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
      sg.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${flicker * 0.15})`);
      sg.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      bgCtx.fillStyle = sg;
      bgCtx.fillRect(s.x - s.r * 4, s.y - s.r * 4, s.r * 8, s.r * 8);
    }
  }
}

// ── Neuron visualization (3 output nodes) ──
function drawNeuron(t) {
  const ctx = neuronCtx;
  const W = neuronCanvas.width;
  const H = neuronCanvas.height;
  const cx = W / 2, cy = H / 2;
  ctx.clearRect(0, 0, W, H);

  const { probs, winner } = computeOutput();
  beatPhase = (t / (60000 / BPM)) % 1;
  const beatPulse = 0.5 + 0.5 * Math.sin(beatPhase * Math.PI * 2);

  // Input nodes (left side)
  const inputAngles = [-Math.PI * 0.7, -Math.PI * 0.45, -Math.PI * 0.2, Math.PI * 0.05, Math.PI * 0.3];
  const inputRadius = 115;
  const inputPositions = inputAngles.map(a => ({
    x: cx + Math.cos(a + Math.PI) * inputRadius,
    y: cy + Math.sin(a) * inputRadius * 0.8
  }));

  // Output nodes (right side)
  const outputPositions = [
    { x: cx + 80, y: cy - 55 },  // scroll
    { x: cx + 80, y: cy },        // sleep
    { x: cx + 80, y: cy + 55 }   // work
  ];

  // Draw connections from inputs to center
  for (let i = 0; i < 5; i++) {
    const ip = inputPositions[i];
    ctx.beginPath();
    ctx.moveTo(ip.x, ip.y);
    ctx.lineTo(cx - 15, cy);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `rgba(150, 120, 200, ${0.2 + beatPulse * 0.15})`;
    ctx.stroke();

    // Input node circle
    ctx.beginPath();
    ctx.arc(ip.x, ip.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(150, 120, 200, 0.5)`;
    ctx.fill();
    ctx.strokeStyle = '#a080d0';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw connections from center to output nodes
  for (let c = 0; c < 3; c++) {
    const op = outputPositions[c];
    const alpha = 0.2 + probs[c] * 0.6 + (c === winner ? beatPulse * 0.2 : 0);
    ctx.beginPath();
    ctx.moveTo(cx + 15, cy);
    ctx.lineTo(op.x, op.y);
    ctx.lineWidth = 1 + probs[c] * 4;
    const [r, g, b] = CLASS_COLORS_RGB[c];
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.stroke();
  }

  // Central neuron body
  const glowSize = 28 + beatPulse * 5;
  const [wr, wg, wb] = CLASS_COLORS_RGB[winner];
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowSize + 15);
  gradient.addColorStop(0, `rgba(${wr}, ${wg}, ${wb}, ${0.5 + beatPulse * 0.3})`);
  gradient.addColorStop(0.5, `rgba(${wr}, ${wg}, ${wb}, 0.1)`);
  gradient.addColorStop(1, `rgba(${wr}, ${wg}, ${wb}, 0)`);
  ctx.beginPath();
  ctx.arc(cx, cy, glowSize + 15, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, glowSize, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10, 5, 25, 0.9)';
  ctx.strokeStyle = CLASS_COLORS[winner];
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();

  ctx.font = '700 18px Orbitron';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = CLASS_COLORS[winner];
  ctx.fillText('SM', cx, cy); // softmax

  // Output nodes
  for (let c = 0; c < 3; c++) {
    const op = outputPositions[c];
    const size = 14 + probs[c] * 10 + (c === winner ? beatPulse * 4 : 0);
    const [r, g, b] = CLASS_COLORS_RGB[c];

    // Glow
    const og = ctx.createRadialGradient(op.x, op.y, 0, op.x, op.y, size + 8);
    og.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.3 + probs[c] * 0.4})`);
    og.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.beginPath();
    ctx.arc(op.x, op.y, size + 8, 0, Math.PI * 2);
    ctx.fillStyle = og;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(op.x, op.y, size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.15 + probs[c] * 0.3})`;
    ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.lineWidth = c === winner ? 2.5 : 1;
    ctx.fill();
    ctx.stroke();

    ctx.font = '600 10px Orbitron';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillText((probs[c] * 100).toFixed(0) + '%', op.x, op.y);
  }
}

// ── Decision boundary plot (3-class heatmap) ──
function drawPlot() {
  const ctx = plotCtx;
  const W = plotCanvas.width;
  const H = plotCanvas.height;
  const pad = 40;
  const pw = W - pad * 2;
  const ph = H - pad * 2;

  ctx.clearRect(0, 0, W, H);

  const resp = parseFloat(sliderResponsibility.value);
  const energy = parseFloat(sliderEnergy.value);
  const fomo = parseFloat(sliderFomo.value);
  const gremlinBias = parseFloat(sliderBias.value);

  // Heatmap: color by winning class
  const step = 4;
  for (let px = 0; px < pw; px += step) {
    for (let py = 0; py < ph; py += step) {
      const timeVal = (px / pw) * 24;
      const spicyVal = 1 - (py / ph);

      const logits = computeLogits(timeVal, spicyVal, resp, energy, fomo, gremlinBias);
      const probs = softmax(logits);
      const winner = probs.indexOf(Math.max(...probs));
      const confidence = probs[winner];

      const [r, g, b] = CLASS_COLORS_RGB[winner];
      const alpha = 0.08 + (confidence - 0.33) * 0.6;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.max(0.05, alpha)})`;
      ctx.fillRect(pad + px, pad + py, step, step);
    }
  }

  // Grid lines
  ctx.strokeStyle = 'rgba(100, 80, 160, 0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const x = pad + (pw / 4) * i;
    ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, pad + ph); ctx.stroke();
    const y = pad + (ph / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + pw, y); ctx.stroke();
  }

  // Decision boundaries (draw where winner changes)
  ctx.lineWidth = 2;
  ctx.shadowBlur = 10;
  const bStep = 2;
  for (let px = 0; px < pw - bStep; px += bStep) {
    for (let py = 0; py < ph - bStep; py += bStep) {
      const t1 = (px / pw) * 24, s1 = 1 - (py / ph);
      const t2 = ((px + bStep) / pw) * 24, s2 = 1 - ((py + bStep) / ph);

      const l1 = computeLogits(t1, s1, resp, energy, fomo, gremlinBias);
      const p1 = softmax(l1);
      const w1 = p1.indexOf(Math.max(...p1));

      // Check right neighbor
      const lr = computeLogits(t2, s1, resp, energy, fomo, gremlinBias);
      const pr = softmax(lr);
      const wr = pr.indexOf(Math.max(...pr));

      // Check bottom neighbor
      const lb = computeLogits(t1, s2, resp, energy, fomo, gremlinBias);
      const pb = softmax(lb);
      const wb = pb.indexOf(Math.max(...pb));

      if (w1 !== wr || w1 !== wb) {
        ctx.shadowColor = '#ff00ff';
        ctx.fillStyle = 'rgba(255, 0, 255, 0.6)';
        ctx.fillRect(pad + px, pad + py, bStep, bStep);
      }
    }
  }
  ctx.shadowBlur = 0;

  // Training points
  for (const pt of trainingPoints) {
    const px = pad + (pt.x / 24) * pw;
    const py = pad + (1 - pt.y) * ph;
    const [r, g, b] = CLASS_COLORS_RGB[pt.label];

    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
    ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    // Check if misclassified
    const logits = computeLogits(pt.x, pt.y, resp, energy, fomo, gremlinBias);
    const probs = softmax(logits);
    const pred = probs.indexOf(Math.max(...probs));
    if (pred !== pt.label) {
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 50, 50, 0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Current point (from sliders)
  const curTime = parseFloat(sliderTime.value);
  const curSpicy = parseFloat(sliderSpiciness.value);
  const cpx = pad + (curTime / 24) * pw;
  const cpy = pad + (1 - curSpicy) * ph;
  const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.005);
  ctx.beginPath();
  ctx.arc(cpx, cpy, 6 + pulse * 3, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + pulse * 0.4})`;
  ctx.fill();
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Axis labels
  ctx.font = '600 11px Rajdhani';
  ctx.fillStyle = '#8070a0';
  ctx.textAlign = 'center';
  for (let i = 0; i <= 4; i++) {
    const x = pad + (pw / 4) * i;
    const h = (i / 4) * 24;
    ctx.fillText(formatHour(h), x, H - 8);
  }
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = pad + (ph / 4) * i;
    const v = (1 - i / 4).toFixed(1);
    ctx.fillText(v, pad - 6, y + 4);
  }

  // Time zone threshold markers
  const zones = [
    { h: 2.5, label: '2:30 AM', color: '#b080ff' },
    { h: 7, label: '7 AM', color: '#00ff00' },
    { h: 20, label: '8 PM', color: '#00ffff' }
  ];
  for (const z of zones) {
    const x = pad + (z.h / 24) * pw;
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(x, pad);
    ctx.lineTo(x, pad + ph);
    ctx.strokeStyle = z.color + '66';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '600 9px Rajdhani';
    ctx.fillStyle = z.color;
    ctx.textAlign = 'center';
    ctx.fillText(z.label, x, pad - 6);
  }

  // Legend
  ctx.font = '600 10px Orbitron';
  for (let c = 0; c < 3; c++) {
    const lx = pad + 8 + c * 75;
    const ly = pad + 14;
    ctx.fillStyle = CLASS_COLORS[c];
    ctx.fillRect(lx, ly - 5, 8, 8);
    ctx.textAlign = 'left';
    ctx.fillText(CLASS_NAMES[c], lx + 12, ly + 2);
  }
}

// ── Plot click → add pending point ──
plotCanvas.addEventListener('click', (e) => {
  const rect = plotCanvas.getBoundingClientRect();
  const scaleX = plotCanvas.width / rect.width;
  const scaleY = plotCanvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;

  const pad = 40;
  const pw = plotCanvas.width - pad * 2;
  const ph = plotCanvas.height - pad * 2;

  const timeVal = ((mx - pad) / pw) * 24;
  const spicyVal = 1 - ((my - pad) / ph);

  if (timeVal < 0 || timeVal > 24 || spicyVal < 0 || spicyVal > 1) return;

  pendingClick = { x: timeVal, y: spicyVal };

  if (pendingLabel !== null) {
    trainingPoints.push({ x: pendingClick.x, y: pendingClick.y, label: pendingLabel });
    pendingClick = null;
    drawPlot();
  }
});

function clearLabelButtons() {
  btnLabelScroll.classList.remove('active');
  btnLabelSleep.classList.remove('active');
  btnLabelWork.classList.remove('active');
}

btnLabelScroll.addEventListener('click', () => {
  pendingLabel = CLASS_SCROLL;
  clearLabelButtons();
  btnLabelScroll.classList.add('active');
  if (pendingClick) {
    trainingPoints.push({ ...pendingClick, label: CLASS_SCROLL });
    pendingClick = null;
    drawPlot();
  }
});

btnLabelSleep.addEventListener('click', () => {
  pendingLabel = CLASS_SLEEP;
  clearLabelButtons();
  btnLabelSleep.classList.add('active');
  if (pendingClick) {
    trainingPoints.push({ ...pendingClick, label: CLASS_SLEEP });
    pendingClick = null;
    drawPlot();
  }
});

btnLabelWork.addEventListener('click', () => {
  pendingLabel = CLASS_WORK;
  clearLabelButtons();
  btnLabelWork.classList.add('active');
  if (pendingClick) {
    trainingPoints.push({ ...pendingClick, label: CLASS_WORK });
    pendingClick = null;
    drawPlot();
  }
});

// ── Training (gradient descent with cross-entropy for softmax) ──
function trainStep() {
  if (trainingPoints.length === 0) return;

  const lr = 0.05;
  const resp = parseFloat(sliderResponsibility.value);
  const energy = parseFloat(sliderEnergy.value);
  const fomo = parseFloat(sliderFomo.value);
  const gremlinBias = parseFloat(sliderBias.value);

  for (const pt of trainingPoints) {
    const inputs = [pt.x / 24, pt.y, resp, energy, fomo];
    const logits = computeLogits(pt.x, pt.y, resp, energy, fomo, gremlinBias);
    const probs = softmax(logits);

    // For each class, gradient = (prob - target) where target is 1 for correct class, 0 otherwise
    for (let c = 0; c < 3; c++) {
      const target = (c === pt.label) ? 1 : 0;
      const error = probs[c] - target; // gradient of cross-entropy loss

      for (let i = 0; i < 5; i++) {
        weights[c][i] -= lr * error * inputs[i];
      }
      biases[c] -= lr * error;
    }
  }

  trainSteps++;
  statSteps.textContent = trainSteps;

  // Accuracy
  let correct = 0;
  for (const pt of trainingPoints) {
    const logits = computeLogits(pt.x, pt.y, resp, energy, fomo, gremlinBias);
    const probs = softmax(logits);
    const pred = probs.indexOf(Math.max(...probs));
    if (pred === pt.label) correct++;
  }
  const acc = trainingPoints.length > 0 ? (correct / trainingPoints.length) * 100 : 0;
  statAccuracy.textContent = acc.toFixed(0) + '%';
  statAccuracy.className = 'stat-value ' + (acc < 60 ? 'low' : acc < 80 ? 'mid' : 'high');

  if (acc >= 90 && !celebrationDone && trainingPoints.length >= 4) {
    celebrationDone = true;
    spawnConfetti();
  }

  document.querySelectorAll('.w-item').forEach(el => {
    el.classList.add('updating');
    setTimeout(() => el.classList.remove('updating'), 400);
  });

  update();
  drawPlot();
}

btnStep.addEventListener('click', trainStep);

btnTrain.addEventListener('click', () => {
  if (autoTraining) {
    stopAutoTrain();
  } else {
    autoTraining = true;
    btnTrain.textContent = '\u23F8 Stop';
    const speed = parseInt(sliderSpeed.value);
    autoTrainInterval = setInterval(trainStep, Math.max(50, 500 / speed));
  }
});

sliderSpeed.addEventListener('input', () => {
  if (autoTraining) {
    clearInterval(autoTrainInterval);
    const speed = parseInt(sliderSpeed.value);
    autoTrainInterval = setInterval(trainStep, Math.max(50, 500 / speed));
  }
});

function stopAutoTrain() {
  autoTraining = false;
  btnTrain.textContent = '\u{1F389} Train';
  clearInterval(autoTrainInterval);
}

btnReset.addEventListener('click', () => {
  stopAutoTrain();
  weights = initialWeights.map(row => [...row]);
  biases = [...initialBiases];
  trainingPoints = [];
  trainSteps = 0;
  celebrationDone = false;
  statSteps.textContent = '0';
  statAccuracy.textContent = '--';
  statAccuracy.className = 'stat-value';
  pendingLabel = null;
  pendingClick = null;
  clearLabelButtons();
  update();
  drawPlot();
});

// ── Confetti celebration ──
function spawnConfetti() {
  let confettiCanvas = document.getElementById('confetti-canvas');
  if (!confettiCanvas) {
    confettiCanvas = document.createElement('canvas');
    confettiCanvas.id = 'confetti-canvas';
    document.body.appendChild(confettiCanvas);
  }
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
  const cCtx = confettiCanvas.getContext('2d');

  const particles = [];
  const colors = ['#00ffff', '#ff00ff', '#00ff00', '#ff1493', '#0066ff', '#ffcc00'];
  for (let i = 0; i < 150; i++) {
    particles.push({
      x: Math.random() * confettiCanvas.width,
      y: -20 - Math.random() * 200,
      w: Math.random() * 8 + 4,
      h: Math.random() * 6 + 2,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.2
    });
  }

  let frame = 0;
  function drawConfetti() {
    cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    let alive = false;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.rotation += p.rotSpeed;
      if (p.y < confettiCanvas.height + 20) alive = true;

      cCtx.save();
      cCtx.translate(p.x, p.y);
      cCtx.rotate(p.rotation);
      cCtx.fillStyle = p.color;
      cCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      cCtx.restore();
    }
    frame++;
    if (alive && frame < 300) {
      requestAnimationFrame(drawConfetti);
    } else {
      confettiCanvas.remove();
    }
  }
  requestAnimationFrame(drawConfetti);
}

// ── Main animation loop ──
function animate(t) {
  drawBackground(t);
  drawNeuron(t);
  drawPlot();
  requestAnimationFrame(animate);
}

// ── Init ──
function init() {
  resizeBgCanvas();
  window.addEventListener('resize', resizeBgCanvas);
  loadState();
  update();
  requestAnimationFrame(animate);
}

init();
