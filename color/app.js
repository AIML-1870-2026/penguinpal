/* ============================================
   Neon Rave RGB Color Studio - Application v3
   ============================================ */

// ─── Color Conversion ───────────────────────────

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return null;
  const n = parseInt(hex, 16);
  if (isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

// ─── Accessibility ──────────────────────────────

function relativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(c1, c2) {
  const l1 = relativeLuminance(c1.r, c1.g, c1.b);
  const l2 = relativeLuminance(c2.r, c2.g, c2.b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ─── Color Blindness ────────────────────────────

const cbMatrices = {
  protanopia:    [[0.567,0.433,0],[0.558,0.442,0],[0,0.242,0.758]],
  deuteranopia:  [[0.625,0.375,0],[0.7,0.3,0],[0,0.3,0.7]],
  tritanopia:    [[0.95,0.05,0],[0,0.433,0.567],[0,0.475,0.525]],
  protanomaly:   [[0.817,0.183,0],[0.333,0.667,0],[0,0.125,0.875]],
  deuteranomaly: [[0.8,0.2,0],[0.258,0.742,0],[0,0.142,0.858]],
  tritanomaly:   [[0.967,0.033,0],[0,0.733,0.267],[0,0.183,0.817]],
  achromatopsia: [[0.299,0.587,0.114],[0.299,0.587,0.114],[0.299,0.587,0.114]],
  achromatomaly: [[0.618,0.320,0.062],[0.163,0.775,0.062],[0.163,0.320,0.516]],
};

function simulateColorBlindness(r, g, b, type) {
  const m = cbMatrices[type];
  if (!m) return { r, g, b };
  return {
    r: Math.min(255, Math.max(0, Math.round(m[0][0]*r + m[0][1]*g + m[0][2]*b))),
    g: Math.min(255, Math.max(0, Math.round(m[1][0]*r + m[1][1]*g + m[1][2]*b))),
    b: Math.min(255, Math.max(0, Math.round(m[2][0]*r + m[2][1]*g + m[2][2]*b))),
  };
}

// ─── Palette Generation ─────────────────────────

function getHarmonyColors(h, s, l, type) {
  const wrap = v => ((v % 360) + 360) % 360;
  switch (type) {
    case 'complementary':
      return [
        { h, s, l }, { h: wrap(h + 180), s, l },
        { h, s: Math.max(s - 20, 10), l: Math.min(l + 20, 90) },
        { h: wrap(h + 180), s: Math.max(s - 20, 10), l: Math.min(l + 20, 90) },
        { h: wrap(h + 180), s, l: Math.max(l - 15, 10) },
      ];
    case 'analogous':
      return [
        { h: wrap(h - 30), s, l }, { h, s, l }, { h: wrap(h + 30), s, l },
        { h: wrap(h - 15), s: Math.max(s - 15, 10), l: Math.min(l + 15, 90) },
        { h: wrap(h + 15), s: Math.max(s - 15, 10), l: Math.min(l + 15, 90) },
      ];
    case 'triadic':
      return [
        { h, s, l }, { h: wrap(h + 120), s, l }, { h: wrap(h + 240), s, l },
        { h: wrap(h + 60), s: Math.max(s - 20, 10), l: Math.min(l + 20, 90) },
        { h: wrap(h + 180), s: Math.max(s - 20, 10), l: Math.min(l + 20, 90) },
      ];
    case 'tetradic':
      return [
        { h, s, l }, { h: wrap(h + 90), s, l }, { h: wrap(h + 180), s, l },
        { h: wrap(h + 270), s, l }, { h: wrap(h + 45), s: Math.max(s - 15, 10), l },
      ];
    case 'split-complementary':
      return [
        { h, s, l }, { h: wrap(h + 150), s, l }, { h: wrap(h + 210), s, l },
        { h, s: Math.max(s - 20, 10), l: Math.min(l + 25, 90) },
        { h: wrap(h + 180), s, l: Math.max(l - 20, 10) },
      ];
    case 'monochromatic':
      return [
        { h, s, l: Math.max(l - 30, 10) }, { h, s, l: Math.max(l - 15, 10) },
        { h, s, l },
        { h, s: Math.max(s - 20, 10), l: Math.min(l + 15, 90) },
        { h, s: Math.max(s - 30, 10), l: Math.min(l + 30, 95) },
      ];
    case 'neon-rave':
      return [
        { h, s: Math.min(s + 20, 100), l },
        { h: wrap(h + 60), s: 100, l: 55 },
        { h: wrap(h + 180), s: 100, l: 50 },
        { h: wrap(h + 270), s: 90, l: 60 },
        { h: wrap(h + 120), s: 95, l: 50 },
      ];
    default: return [{ h, s, l }];
  }
}

const usageLabels = ['Primary', 'Secondary', 'Accent', 'Background', 'Text'];

// ─── Particles ──────────────────────────────────

const particles = [];
let particleAnimating = false;

function spawnParticles(x, y, color, count = 30) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 5;
    particles.push({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 1, decay: 0.01 + Math.random() * 0.015,
      size: 2 + Math.random() * 4, color,
    });
  }
  if (!particleAnimating) { particleAnimating = true; requestAnimationFrame(particleLoop); }
}

function particleLoop() {
  const canvas = document.getElementById('particleCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.04; p.vx *= 0.99; p.life -= p.decay;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.globalAlpha = p.life * 0.8;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 15 * p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  if (particles.length > 0) requestAnimationFrame(particleLoop);
  else particleAnimating = false;
}

// ─── Rainbow Mouse Trail ────────────────────────

const trail = [];
let trailHue = 0;

function initTrail() {
  const canvas = document.getElementById('trailCanvas');
  const ctx = canvas.getContext('2d');
  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);

  document.addEventListener('mousemove', e => {
    trail.push({ x: e.clientX, y: e.clientY, life: 1, hue: trailHue });
    trailHue = (trailHue + 2) % 360;
    if (trail.length > 50) trail.shift();
  });

  function drawTrail() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = trail.length - 1; i >= 0; i--) {
      const p = trail[i];
      p.life -= 0.025;
      if (p.life <= 0) { trail.splice(i, 1); continue; }
      const size = 4 + p.life * 8;
      ctx.globalAlpha = p.life * 0.35;
      ctx.fillStyle = `hsl(${p.hue}, 100%, 60%)`;
      ctx.shadowColor = `hsl(${p.hue}, 100%, 60%)`;
      ctx.shadowBlur = 20 * p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    requestAnimationFrame(drawTrail);
  }
  requestAnimationFrame(drawTrail);
}

// ─── Toast ──────────────────────────────────────

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.classList.remove('show'), 2000);
}

// ─── App State ──────────────────────────────────

const state = {
  color: { r: 255, g: 0, b: 255 },
  palette: [],
  lockedColors: new Set(),
  harmonyType: 'neon-rave',
  raveMode: true,
  simType: 'protanopia',
  history: [],
  wheelLightness: 50,
  blobs: [],
  sampleX: 0.5,
  sampleY: 0.5,
};

// ─── Init ───────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const pCanvas = document.getElementById('particleCanvas');
  const resize = () => { pCanvas.width = window.innerWidth; pCanvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);

  initTrail();
  initColorWheel();
  initBlendCanvas();
  initExplorer();
  initPalette();
  initPaint();
  initSimulator();
  updateExplorerUI();
  generatePalette();
  updateSimulatorUI();
});

// ─── Navigation (single-page, no tabs) ──────────

// ─── Color Wheel ────────────────────────────────

let wheelCanvas, wheelCtx;

function initColorWheel() {
  wheelCanvas = document.getElementById('colorWheel');
  // Match canvas internal size to its CSS/attribute size
  wheelCanvas.width = wheelCanvas.getAttribute('width');
  wheelCanvas.height = wheelCanvas.getAttribute('height');
  wheelCtx = wheelCanvas.getContext('2d');
  drawWheel();

  let dragging = false;
  const pick = (e) => {
    const rect = wheelCanvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    const cx = rect.width / 2, cy = rect.height / 2;
    const dx = x - cx, dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const radius = rect.width / 2;
    if (dist > radius) return;

    const angle = Math.atan2(dy, dx);
    const hue = ((angle * 180 / Math.PI) + 360) % 360;
    const sat = Math.min(dist / radius, 1) * 100;

    const rgb = hslToRgb(Math.round(hue), Math.round(sat), state.wheelLightness);
    state.color = rgb;
    updateExplorerUI();

    // Move cursor
    const cursor = document.getElementById('wheelCursor');
    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
  };

  wheelCanvas.addEventListener('mousedown', e => { dragging = true; pick(e); });
  window.addEventListener('mousemove', e => { if (dragging) pick(e); });
  window.addEventListener('mouseup', () => { dragging = false; });
  wheelCanvas.addEventListener('touchstart', e => { e.preventDefault(); pick(e); }, { passive: false });
  wheelCanvas.addEventListener('touchmove', e => { e.preventDefault(); pick(e); }, { passive: false });

  document.getElementById('slider-lightness').addEventListener('input', e => {
    state.wheelLightness = parseInt(e.target.value);
    document.getElementById('lightness-val').textContent = state.wheelLightness;
    drawWheel();
  });
}

function drawWheel() {
  const w = wheelCanvas.width, h = wheelCanvas.height;
  const cx = w / 2, cy = h / 2, radius = w / 2;
  wheelCtx.clearRect(0, 0, w, h);

  const imageData = wheelCtx.createImageData(w, h);
  const data = imageData.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;

      const angle = Math.atan2(dy, dx);
      const hue = ((angle * 180 / Math.PI) + 360) % 360;
      const sat = (dist / radius) * 100;
      const rgb = hslToRgb(Math.round(hue), Math.round(sat), state.wheelLightness);

      const idx = (y * w + x) * 4;
      data[idx] = rgb.r;
      data[idx + 1] = rgb.g;
      data[idx + 2] = rgb.b;

      // Soft edge
      const edgeFade = dist > radius - 2 ? Math.max(0, (radius - dist) / 2) : 1;
      data[idx + 3] = Math.round(255 * edgeFade);
    }
  }

  wheelCtx.putImageData(imageData, 0, 0);
}

// ─── Blend Canvas (draggable color blobs) ───────

let blendCanvas, blendCtx;
let dragBlob = null, dragOffX = 0, dragOffY = 0;

function randomNeonColor() {
  const hue = Math.floor(Math.random() * 360);
  return hslToRgb(hue, 100, 55);
}

function createDefaultBlobs() {
  const s = 420;
  state.blobs = [
    { x: s * 0.30, y: s * 0.35, radius: 90, color: { r: 255, g: 0, b: 255 } },
    { x: s * 0.70, y: s * 0.35, radius: 90, color: { r: 0, g: 240, b: 255 } },
    { x: s * 0.50, y: s * 0.68, radius: 90, color: { r: 0, g: 255, b: 65 } },
  ];
}

function initBlendCanvas() {
  blendCanvas = document.getElementById('blendCanvas');
  blendCtx = blendCanvas.getContext('2d', { willReadFrequently: true });
  createDefaultBlobs();

  const container = blendCanvas.parentElement;

  // Get canvas-space coords from mouse event
  function canvasCoords(e) {
    const rect = blendCanvas.getBoundingClientRect();
    const scaleX = blendCanvas.width / rect.width;
    const scaleY = blendCanvas.height / rect.height;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function hitBlob(cx, cy) {
    // Search in reverse so top-drawn blobs are hit first
    for (let i = state.blobs.length - 1; i >= 0; i--) {
      const b = state.blobs[i];
      const dx = cx - b.x, dy = cy - b.y;
      if (dx * dx + dy * dy <= b.radius * b.radius) return b;
    }
    return null;
  }

  // Mouse down — start drag or sample
  container.addEventListener('mousedown', e => {
    const { x, y } = canvasCoords(e);
    const blob = hitBlob(x, y);
    if (blob) {
      dragBlob = blob;
      dragOffX = x - blob.x;
      dragOffY = y - blob.y;
    } else {
      // Sample color at click point
      sampleAt(x, y);
    }
  });

  window.addEventListener('mousemove', e => {
    if (!dragBlob) return;
    const { x, y } = canvasCoords(e);
    dragBlob.x = x - dragOffX;
    dragBlob.y = y - dragOffY;
    drawBlendCanvas();
    sampleAtCurrent();
  });

  window.addEventListener('mouseup', () => { dragBlob = null; });

  // Touch support
  container.addEventListener('touchstart', e => {
    e.preventDefault();
    const { x, y } = canvasCoords(e);
    const blob = hitBlob(x, y);
    if (blob) { dragBlob = blob; dragOffX = x - blob.x; dragOffY = y - blob.y; }
    else { sampleAt(x, y); }
  }, { passive: false });

  container.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!dragBlob) return;
    const { x, y } = canvasCoords(e);
    dragBlob.x = x - dragOffX;
    dragBlob.y = y - dragOffY;
    drawBlendCanvas();
    sampleAtCurrent();
  }, { passive: false });

  container.addEventListener('touchend', () => { dragBlob = null; });

  // Scroll to resize blob
  container.addEventListener('wheel', e => {
    e.preventDefault();
    const { x, y } = canvasCoords(e);
    const blob = hitBlob(x, y);
    if (blob) {
      blob.radius = Math.max(30, Math.min(180, blob.radius - e.deltaY * 0.3));
      drawBlendCanvas();
      sampleAtCurrent();
    }
  }, { passive: false });

  // Double-click to change blob color
  container.addEventListener('dblclick', e => {
    const { x, y } = canvasCoords(e);
    const blob = hitBlob(x, y);
    if (blob) {
      const nc = randomNeonColor();
      blob.color = nc;
      drawBlendCanvas();
      sampleAtCurrent();
    }
  });

  // Add / Reset buttons
  document.getElementById('btn-add-blob').addEventListener('click', () => {
    const nc = randomNeonColor();
    state.blobs.push({
      x: 100 + Math.random() * 220,
      y: 100 + Math.random() * 220,
      radius: 60 + Math.random() * 50,
      color: nc,
    });
    drawBlendCanvas();
    sampleAtCurrent();
  });

  document.getElementById('btn-reset-blobs').addEventListener('click', () => {
    createDefaultBlobs();
    state.sampleX = 0.5;
    state.sampleY = 0.5;
    drawBlendCanvas();
    sampleAtCurrent();
    updateCrosshairPosition();
  });

  drawBlendCanvas();
  sampleAtCurrent();
}

function drawBlendCanvas() {
  const w = blendCanvas.width, h = blendCanvas.height;
  blendCtx.clearRect(0, 0, w, h);

  // Dark background
  blendCtx.fillStyle = '#08080F';
  blendCtx.fillRect(0, 0, w, h);

  // Use 'screen' blending for additive-like light mixing
  blendCtx.globalCompositeOperation = 'screen';

  state.blobs.forEach(blob => {
    const { x, y, radius, color } = blob;
    const grad = blendCtx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 1)`);
    grad.addColorStop(0.4, `rgba(${color.r}, ${color.g}, ${color.b}, 0.7)`);
    grad.addColorStop(0.7, `rgba(${color.r}, ${color.g}, ${color.b}, 0.3)`);
    grad.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

    blendCtx.fillStyle = grad;
    blendCtx.beginPath();
    blendCtx.arc(x, y, radius, 0, Math.PI * 2);
    blendCtx.fill();
  });

  blendCtx.globalCompositeOperation = 'source-over';

  // Draw blob center indicators
  state.blobs.forEach(blob => {
    const lum = relativeLuminance(blob.color.r, blob.color.g, blob.color.b);
    const textColor = lum > 0.3 ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)';

    blendCtx.strokeStyle = `rgba(255,255,255,0.15)`;
    blendCtx.lineWidth = 1;
    blendCtx.beginPath();
    blendCtx.arc(blob.x, blob.y, 8, 0, Math.PI * 2);
    blendCtx.stroke();

    // Tiny ring to show it's draggable
    blendCtx.strokeStyle = `rgba(255,255,255,0.08)`;
    blendCtx.setLineDash([3, 4]);
    blendCtx.beginPath();
    blendCtx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
    blendCtx.stroke();
    blendCtx.setLineDash([]);
  });
}

function sampleAt(cx, cy) {
  state.sampleX = cx / blendCanvas.width;
  state.sampleY = cy / blendCanvas.height;
  updateCrosshairPosition();
  sampleAtCurrent();
}

function sampleAtCurrent() {
  const px = Math.round(state.sampleX * blendCanvas.width);
  const py = Math.round(state.sampleY * blendCanvas.height);
  const pixel = blendCtx.getImageData(px, py, 1, 1).data;
  state.color = { r: pixel[0], g: pixel[1], b: pixel[2] };
  updateExplorerUI();
}

function updateCrosshairPosition() {
  const crosshair = document.getElementById('blendCrosshair');
  crosshair.style.left = (state.sampleX * 100) + '%';
  crosshair.style.top = (state.sampleY * 100) + '%';
}

// ─── Color Explorer ─────────────────────────────

function initExplorer() {
  ['r', 'g', 'b'].forEach(ch => {
    document.getElementById(`slider-${ch}`).addEventListener('input', e => {
      state.color[ch] = parseInt(e.target.value);
      updateExplorerUI();
    });
  });

  document.getElementById('hex-input').addEventListener('change', e => {
    const rgb = hexToRgb(e.target.value);
    if (rgb) { Object.assign(state.color, rgb); updateExplorerUI(); }
  });

  document.querySelectorAll('.color-value-badge').forEach(badge => {
    badge.addEventListener('click', () => {
      navigator.clipboard.writeText(badge.textContent).then(() => showToast(`Copied ${badge.textContent}`));
    });
  });

  document.getElementById('btn-random').addEventListener('click', e => {
    state.color = { r: Math.floor(Math.random() * 256), g: Math.floor(Math.random() * 256), b: Math.floor(Math.random() * 256) };
    updateExplorerUI();
    addToHistory();
    const rect = e.currentTarget.getBoundingClientRect();
    spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, rgbToHex(state.color.r, state.color.g, state.color.b), 25);
  });

  // No tab switching needed — palette section is visible on the same page
}

function addToHistory() {
  const hex = rgbToHex(state.color.r, state.color.g, state.color.b);
  if (state.history.length > 0 && state.history[state.history.length - 1].hex === hex) return;
  state.history.push({ ...state.color, hex });
  if (state.history.length > 16) state.history.shift();
  renderHistory();
}

function renderHistory() {
  const strip = document.getElementById('history-strip');
  strip.innerHTML = '';
  state.history.forEach(c => {
    const dot = document.createElement('div');
    dot.className = 'history-dot';
    dot.style.backgroundColor = c.hex;
    dot.style.borderColor = c.hex + '44';
    dot.title = c.hex;
    dot.addEventListener('click', () => {
      state.color = { r: c.r, g: c.g, b: c.b };
      updateExplorerUI();
    });
    strip.appendChild(dot);
  });
}

function updateExplorerUI() {
  const { r, g, b } = state.color;
  const hex = rgbToHex(r, g, b);
  const hsl = rgbToHsl(r, g, b);

  // Live color preview swatch
  const liveSwatch = document.getElementById('live-swatch');
  if (liveSwatch) {
    liveSwatch.style.backgroundColor = hex;
    liveSwatch.style.boxShadow = `0 0 24px rgba(${r},${g},${b},0.5), 0 0 48px rgba(${r},${g},${b},0.2)`;
    liveSwatch.style.borderColor = `rgba(${r},${g},${b},0.6)`;
  }

  // Live preview container border glow
  const livePreview = document.querySelector('.live-color-preview');
  if (livePreview) {
    livePreview.style.borderColor = `rgba(${r},${g},${b},0.3)`;
    livePreview.style.boxShadow = `0 0 20px rgba(${r},${g},${b},0.08)`;
  }

  // Blend sampled hex label
  const sampledHex = document.getElementById('blend-sampled-hex');
  if (sampledHex) sampledHex.textContent = hex;

  // Blend crosshair glow matches active color
  const crosshair = document.getElementById('blendCrosshair');
  if (crosshair) {
    crosshair.style.borderColor = `rgba(${r},${g},${b},0.9)`;
    crosshair.style.boxShadow = `0 0 0 1px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(0,0,0,0.3), 0 0 16px rgba(${r},${g},${b},0.5)`;
  }

  // Paint active color
  const paintSwatch = document.getElementById('paint-active-swatch');
  if (paintSwatch) {
    paintSwatch.style.backgroundColor = hex;
    paintSwatch.style.boxShadow = `0 0 20px rgba(${r},${g},${b},0.3)`;
  }
  const paintHex = document.getElementById('paint-active-hex');
  if (paintHex) paintHex.textContent = hex;

  // Badges
  document.getElementById('val-hex').textContent = hex;
  document.getElementById('val-rgb').textContent = `rgb(${r}, ${g}, ${b})`;
  document.getElementById('val-hsl').textContent = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;

  // Sliders
  ['r', 'g', 'b'].forEach(ch => {
    document.getElementById(`slider-${ch}`).value = state.color[ch];
    document.getElementById(`val-${ch}`).textContent = state.color[ch];
  });

  // Channel bars
  document.getElementById('bar-r').style.width = (r / 255 * 100) + '%';
  document.getElementById('bar-g').style.width = (g / 255 * 100) + '%';
  document.getElementById('bar-b').style.width = (b / 255 * 100) + '%';

  document.getElementById('hex-input').value = hex;

  // Update wheel cursor position from HSL
  const wheelWrapper = document.querySelector('.wheel-wrapper');
  if (wheelWrapper) {
    const radius = wheelWrapper.offsetWidth / 2;
    const angleRad = hsl.h * Math.PI / 180;
    const dist = (hsl.s / 100) * radius;
    const cursor = document.getElementById('wheelCursor');
    cursor.style.left = (radius + Math.cos(angleRad) * dist) + 'px';
    cursor.style.top = (radius + Math.sin(angleRad) * dist) + 'px';
    cursor.style.boxShadow = `0 0 8px rgba(0,0,0,0.6), 0 0 16px rgba(${r},${g},${b},0.6)`;
  }
}

// ─── Palette Generator ──────────────────────────

function initPalette() {
  document.getElementById('harmony-select').addEventListener('change', e => {
    state.harmonyType = e.target.value;
    generatePalette();
  });

  document.getElementById('btn-generate').addEventListener('click', e => {
    generatePalette();
    const rect = e.currentTarget.getBoundingClientRect();
    spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, '#FF00FF', 25);
  });

  document.getElementById('rave-mode').addEventListener('change', e => {
    state.raveMode = e.target.checked;
    generatePalette();
  });

  document.getElementById('btn-export-css').addEventListener('click', () => exportPalette('css'));
  document.getElementById('btn-export-json').addEventListener('click', () => exportPalette('json'));
}

function generatePalette() {
  const { r, g, b } = state.color;
  const hsl = rgbToHsl(r, g, b);
  const type = state.raveMode ? 'neon-rave' : state.harmonyType;
  const hslColors = getHarmonyColors(hsl.h, hsl.s, hsl.l, type);

  state.palette = hslColors.map((c, i) => {
    if (state.lockedColors.has(i) && state.palette[i]) return state.palette[i];
    const rgb = hslToRgb(c.h, c.s, c.l);
    return { ...rgb, hex: rgbToHex(rgb.r, rgb.g, rgb.b), usage: usageLabels[i] || 'Accent' };
  });

  renderPalette();
  renderContrastMatrix();
}

function renderPalette() {
  const grid = document.getElementById('palette-grid');
  grid.innerHTML = '';

  state.palette.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'palette-card';
    const locked = state.lockedColors.has(i);

    card.innerHTML = `
      <div class="palette-card-swatch" style="background:${c.hex};"></div>
      <button class="lock-btn ${locked ? 'locked' : ''}" data-index="${i}" title="${locked ? 'Unlock' : 'Lock'} color">${locked ? '&#128274;' : '&#128275;'}</button>
      <div class="palette-card-info">
        <div class="hex">${c.hex}</div>
        <div class="rgb">rgb(${c.r}, ${c.g}, ${c.b})</div>
        <div class="usage">${c.usage}</div>
      </div>
    `;

    card.addEventListener('mouseenter', () => {
      card.style.boxShadow = `0 8px 32px rgba(0,0,0,0.3), 0 0 30px ${c.hex}33`;
    });
    card.addEventListener('mouseleave', () => { card.style.boxShadow = ''; });

    card.querySelector('.palette-card-swatch').addEventListener('click', () => {
      // Set as active paint color + copy
      state.color = { r: c.r, g: c.g, b: c.b };
      updateExplorerUI();
      navigator.clipboard.writeText(c.hex).then(() => showToast(`Painting with ${c.hex}`));
    });

    card.querySelector('.lock-btn').addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(e.currentTarget.dataset.index);
      if (state.lockedColors.has(idx)) state.lockedColors.delete(idx);
      else state.lockedColors.add(idx);
      renderPalette();
      renderContrastMatrix();
    });

    grid.appendChild(card);
  });

  updateSimulatorUI();
  updatePaintPalette();
}

// ─── Contrast Matrix (inline in palette) ────────

function renderContrastMatrix() {
  const container = document.getElementById('contrast-matrix');
  container.innerHTML = '';

  const p = state.palette;
  if (p.length < 2) return;

  const cols = p.length + 1;
  container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  // Top-left empty cell
  const empty = document.createElement('div');
  empty.className = 'cm-cell cm-header';
  container.appendChild(empty);

  // Header row: swatches
  p.forEach(c => {
    const header = document.createElement('div');
    header.className = 'cm-cell cm-header';
    header.innerHTML = `<span class="cm-swatch" style="background:${c.hex}"></span>`;
    container.appendChild(header);
  });

  // Data rows
  p.forEach((rowColor, i) => {
    // Row header
    const rowHeader = document.createElement('div');
    rowHeader.className = 'cm-cell cm-header';
    rowHeader.innerHTML = `<span class="cm-swatch" style="background:${rowColor.hex}"></span>`;
    container.appendChild(rowHeader);

    p.forEach((colColor, j) => {
      const cell = document.createElement('div');
      if (i === j) {
        cell.className = 'cm-cell cm-self';
        cell.textContent = '—';
      } else {
        const ratio = contrastRatio(rowColor, colColor);
        const ratioStr = ratio.toFixed(1);
        if (ratio >= 4.5) {
          cell.className = 'cm-cell cm-pass';
        } else if (ratio >= 3) {
          cell.className = 'cm-cell cm-large';
        } else {
          cell.className = 'cm-cell cm-fail';
        }
        cell.textContent = ratioStr;
        cell.title = `${rowColor.hex} vs ${colColor.hex}: ${ratioStr}:1`;
      }
      container.appendChild(cell);
    });
  });
}

function exportPalette(format) {
  const panel = document.getElementById('export-output');
  let output = '';
  if (format === 'css') {
    output = ':root {\n' + state.palette.map(c =>
      `  --color-${c.usage.toLowerCase()}: ${c.hex};`
    ).join('\n') + '\n}';
  } else {
    output = JSON.stringify({ palette: state.palette.map(c => ({ hex: c.hex, rgb: `rgb(${c.r}, ${c.g}, ${c.b})`, usage: c.usage })) }, null, 2);
  }
  panel.textContent = output;
  document.getElementById('export-panel').style.display = 'block';
  navigator.clipboard.writeText(output).then(() => showToast('Copied to clipboard'));
}

// ─── Color Blindness Simulator ──────────────────

function initSimulator() {
  document.querySelectorAll('.sim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sim-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.simType = btn.dataset.type;
      updateSimulatorUI();
    });
  });
}

function updateSimulatorUI() {
  const colors = state.palette.length ? state.palette : [
    { ...state.color, hex: rgbToHex(state.color.r, state.color.g, state.color.b) }
  ];

  const originalGrid = document.getElementById('sim-original');
  const simulatedGrid = document.getElementById('sim-simulated');
  originalGrid.innerHTML = '';
  simulatedGrid.innerHTML = '';

  let distinguishable = 0, total = 0;

  colors.forEach(c => {
    const orig = document.createElement('div');
    orig.className = 'sim-swatch';
    orig.style.backgroundColor = c.hex;
    orig.style.boxShadow = `0 0 16px ${c.hex}44`;
    const origLum = relativeLuminance(c.r, c.g, c.b);
    orig.innerHTML = `<span style="color:${origLum > 0.5 ? '#000' : '#fff'}; font-size:0.6rem; font-weight:600;">${c.hex}</span>`;
    originalGrid.appendChild(orig);

    const sim = simulateColorBlindness(c.r, c.g, c.b, state.simType);
    const simHex = rgbToHex(sim.r, sim.g, sim.b);
    const simEl = document.createElement('div');
    simEl.className = 'sim-swatch';
    simEl.style.backgroundColor = simHex;
    simEl.style.boxShadow = `0 0 16px ${simHex}44`;
    const simLum = relativeLuminance(sim.r, sim.g, sim.b);
    simEl.innerHTML = `<span style="color:${simLum > 0.5 ? '#000' : '#fff'}; font-size:0.6rem; font-weight:600;">${simHex}</span>`;
    simulatedGrid.appendChild(simEl);
  });

  const simColors = colors.map(c => simulateColorBlindness(c.r, c.g, c.b, state.simType));
  for (let i = 0; i < simColors.length; i++) {
    for (let j = i + 1; j < simColors.length; j++) {
      total++;
      if (contrastRatio(simColors[i], simColors[j]) >= 2) distinguishable++;
    }
  }

  const score = total > 0 ? Math.round((distinguishable / total) * 100) : 100;
  document.getElementById('sim-score-val').textContent = score + '%';
  const fill = document.getElementById('score-fill');
  fill.style.width = score + '%';
  if (score >= 80) { fill.style.background = 'linear-gradient(90deg, #00FF41, #00F0FF)'; fill.style.boxShadow = '0 0 12px rgba(0,255,65,0.4)'; }
  else if (score >= 50) { fill.style.background = 'linear-gradient(90deg, #F0FF00, #FF6B00)'; fill.style.boxShadow = '0 0 12px rgba(240,255,0,0.4)'; }
  else { fill.style.background = 'linear-gradient(90deg, #FF4466, #FF00FF)'; fill.style.boxShadow = '0 0 12px rgba(255,68,102,0.4)'; }
}

// ─── Paint Canvas (Neon Rave 3D) ────────────────

let paintCanvas, paintCtx, glowCanvas, glowCtx;
let paintRainbowHue = 0;
let glowAnimating = false;
const glowDots = [];

const paint = {
  drawing: false,
  tool: 'brush',
  mode: 'neon', // normal | neon | rainbow | spray
  size: 16,
  opacity: 100,
  softness: 50,
  bg: 'dark',
  lastX: null,
  lastY: null,
};

function initPaint() {
  paintCanvas = document.getElementById('paintCanvas');
  paintCtx = paintCanvas.getContext('2d', { willReadFrequently: true });
  glowCanvas = document.getElementById('paintGlowCanvas');
  glowCtx = glowCanvas.getContext('2d');

  function resizePaintCanvas() {
    const wrapper = paintCanvas.parentElement;
    const displayW = wrapper.clientWidth;
    const displayH = parseInt(getComputedStyle(paintCanvas).height);
    if (paintCanvas.width !== displayW || paintCanvas.height !== displayH) {
      const imageData = paintCtx.getImageData(0, 0, paintCanvas.width, paintCanvas.height);
      paintCanvas.width = displayW;
      paintCanvas.height = displayH;
      glowCanvas.width = displayW;
      glowCanvas.height = displayH;
      clearPaintCanvas();
      paintCtx.putImageData(imageData, 0, 0);
    }
  }

  // Size immediately (all sections visible on single page)
  requestAnimationFrame(() => resizePaintCanvas());

  window.addEventListener('resize', () => resizePaintCanvas());

  const wrapper = paintCanvas.parentElement;
  const cursor = document.getElementById('paintCursor');
  const cursorRing1 = cursor.querySelector('.cursor-ring-1');
  const cursorRing2 = cursor.querySelector('.cursor-ring-2');
  const cursorDot = cursor.querySelector('.cursor-dot');

  function getCoords(e) {
    const rect = paintCanvas.getBoundingClientRect();
    const scaleX = paintCanvas.width / rect.width;
    const scaleY = paintCanvas.height / rect.height;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function updateCursor(e) {
    const rect = wrapper.getBoundingClientRect();
    const clientX = e.clientX ?? 0;
    const clientY = e.clientY ?? 0;
    cursor.style.left = (clientX - rect.left) + 'px';
    cursor.style.top = (clientY - rect.top) + 'px';
    const displaySize = paint.size * (rect.width / paintCanvas.width);
    cursor.style.width = displaySize + 'px';
    cursor.style.height = displaySize + 'px';

    // Color the cursor rings based on mode
    const { r, g, b } = state.color;
    if (paint.mode === 'rainbow') {
      const hue = paintRainbowHue % 360;
      cursorRing1.style.borderColor = `hsl(${hue}, 100%, 60%)`;
      cursorRing2.style.borderColor = `hsl(${(hue + 60) % 360}, 100%, 50%)`;
      cursorDot.style.boxShadow = `0 0 6px #fff, 0 0 12px hsl(${hue}, 100%, 60%)`;
    } else if (paint.mode === 'neon') {
      cursorRing1.style.borderColor = `rgba(${r},${g},${b},0.8)`;
      cursorRing2.style.borderColor = `rgba(${r},${g},${b},0.35)`;
      cursorDot.style.boxShadow = `0 0 6px #fff, 0 0 14px rgba(${r},${g},${b},0.9)`;
    } else {
      cursorRing1.style.borderColor = `rgba(${r},${g},${b},0.6)`;
      cursorRing2.style.borderColor = `rgba(255,0,255,0.3)`;
      cursorDot.style.boxShadow = `0 0 6px #fff, 0 0 12px rgba(${r},${g},${b},0.5)`;
    }
  }

  // ── Get brush color based on mode ──
  function getBrushColor() {
    if (paint.mode === 'rainbow') {
      const rgb = hslToRgb(Math.round(paintRainbowHue) % 360, 100, 55);
      paintRainbowHue += 3;
      return rgb;
    }
    return state.color;
  }

  // ── Add glow dot for bloom overlay ──
  function addGlowDot(cx, cy, color, radius) {
    glowDots.push({ x: cx, y: cy, r: radius, color, life: 1 });
    if (!glowAnimating) { glowAnimating = true; requestAnimationFrame(glowLoop); }
  }

  function glowLoop() {
    glowCtx.clearRect(0, 0, glowCanvas.width, glowCanvas.height);
    for (let i = glowDots.length - 1; i >= 0; i--) {
      const d = glowDots[i];
      d.life -= 0.02;
      if (d.life <= 0) { glowDots.splice(i, 1); continue; }
      const { r, g, b } = d.color;
      glowCtx.globalAlpha = d.life * 0.35;
      const grad = glowCtx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 2.5);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.6)`);
      grad.addColorStop(0.5, `rgba(${r},${g},${b},0.15)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      glowCtx.fillStyle = grad;
      glowCtx.beginPath();
      glowCtx.arc(d.x, d.y, d.r * 2.5, 0, Math.PI * 2);
      glowCtx.fill();
    }
    glowCtx.globalAlpha = 1;
    if (glowDots.length > 0) requestAnimationFrame(glowLoop);
    else glowAnimating = false;
  }

  // ── Spray particles ──
  function sprayAt(cx, cy, color, radius, alpha) {
    const count = Math.floor(radius * 1.5);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius;
      const px = cx + Math.cos(angle) * dist;
      const py = cy + Math.sin(angle) * dist;
      const size = 1 + Math.random() * 2.5;
      const { r, g, b } = color;
      paintCtx.globalAlpha = alpha * (0.3 + Math.random() * 0.7);
      paintCtx.fillStyle = `rgb(${r},${g},${b})`;
      paintCtx.beginPath();
      paintCtx.arc(px, py, size, 0, Math.PI * 2);
      paintCtx.fill();
    }
    paintCtx.globalAlpha = 1;
  }

  // ── Main stroke function ──
  function strokeTo(x, y) {
    if (paint.tool === 'eyedropper') return;

    const isEraser = paint.tool === 'eraser';
    const alpha = paint.opacity / 100;
    const soft = paint.softness / 100;
    const rad = paint.size / 2;
    const mode = paint.mode;

    if (isEraser) {
      paintCtx.globalCompositeOperation = 'destination-out';
    } else {
      paintCtx.globalCompositeOperation = 'source-over';
    }

    const dx = x - (paint.lastX ?? x);
    const dy = y - (paint.lastY ?? y);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.floor(dist / Math.max(1, rad * 0.3)));

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const cx = (paint.lastX ?? x) + dx * t;
      const cy = (paint.lastY ?? y) + dy * t;
      const color = getBrushColor();
      const { r: cr, g: cg, b: cb } = color;

      if (mode === 'spray' && !isEraser) {
        // Neon spray: scattered particles
        sprayAt(cx, cy, color, rad, alpha);
        if (i % 3 === 0) addGlowDot(cx, cy, color, rad);
      } else if (mode === 'neon' && !isEraser) {
        // Neon glow: extra-soft brush + bloom
        paintCtx.shadowColor = `rgba(${cr},${cg},${cb},0.8)`;
        paintCtx.shadowBlur = rad * 0.8;

        const grad = paintCtx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        grad.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`);
        grad.addColorStop(0.3, `rgba(${cr},${cg},${cb},${alpha * 0.6})`);
        grad.addColorStop(0.7, `rgba(${cr},${cg},${cb},${alpha * 0.15})`);
        grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        paintCtx.fillStyle = grad;
        paintCtx.beginPath();
        paintCtx.arc(cx, cy, rad, 0, Math.PI * 2);
        paintCtx.fill();
        paintCtx.shadowBlur = 0;

        // Bloom overlay
        if (i % 2 === 0) addGlowDot(cx, cy, color, rad);
      } else if (soft > 0.05 && !isEraser) {
        // Normal soft brush
        const grad = paintCtx.createRadialGradient(cx, cy, rad * (1 - soft), cx, cy, rad);
        grad.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`);
        grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        paintCtx.fillStyle = grad;
        paintCtx.beginPath();
        paintCtx.arc(cx, cy, rad, 0, Math.PI * 2);
        paintCtx.fill();
      } else if (isEraser) {
        paintCtx.fillStyle = `rgba(0,0,0,${alpha})`;
        paintCtx.beginPath();
        paintCtx.arc(cx, cy, rad, 0, Math.PI * 2);
        paintCtx.fill();
      } else {
        // Normal hard brush
        paintCtx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
        paintCtx.beginPath();
        paintCtx.arc(cx, cy, rad, 0, Math.PI * 2);
        paintCtx.fill();
      }

      // Rainbow mode always gets subtle glow
      if (mode === 'rainbow' && !isEraser && i % 3 === 0) {
        addGlowDot(cx, cy, color, rad);
      }
    }

    paintCtx.globalCompositeOperation = 'source-over';
    paint.lastX = x;
    paint.lastY = y;
  }

  function eyedrop(x, y) {
    const pixel = paintCtx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    if (pixel[3] > 0) {
      state.color = { r: pixel[0], g: pixel[1], b: pixel[2] };
      updateExplorerUI();
      showToast(`Picked ${rgbToHex(pixel[0], pixel[1], pixel[2])}`);
    }
  }

  // ── Mouse events ──
  wrapper.addEventListener('mousedown', e => {
    resizePaintCanvas();
    const { x, y } = getCoords(e);
    if (paint.tool === 'eyedropper') { eyedrop(x, y); return; }
    paint.drawing = true;
    paint.lastX = x;
    paint.lastY = y;
    strokeTo(x, y);
  });

  window.addEventListener('mousemove', e => {
    updateCursor(e);
    if (!paint.drawing) return;
    const { x, y } = getCoords(e);
    strokeTo(x, y);
  });

  window.addEventListener('mouseup', () => { paint.drawing = false; paint.lastX = null; paint.lastY = null; });

  // ── Touch events ──
  wrapper.addEventListener('touchstart', e => {
    e.preventDefault();
    resizePaintCanvas();
    const { x, y } = getCoords(e);
    if (paint.tool === 'eyedropper') { eyedrop(x, y); return; }
    paint.drawing = true;
    paint.lastX = x;
    paint.lastY = y;
    strokeTo(x, y);
  }, { passive: false });

  wrapper.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!paint.drawing) return;
    const { x, y } = getCoords(e);
    strokeTo(x, y);
  }, { passive: false });

  wrapper.addEventListener('touchend', () => { paint.drawing = false; paint.lastX = null; paint.lastY = null; });

  // Hide cursor when leaving
  wrapper.addEventListener('mouseleave', () => { cursor.style.top = '-100px'; });

  // ── Slider controls ──
  document.getElementById('brush-size').addEventListener('input', e => {
    paint.size = parseInt(e.target.value);
    document.getElementById('brush-size-val').textContent = paint.size;
  });

  document.getElementById('brush-opacity').addEventListener('input', e => {
    paint.opacity = parseInt(e.target.value);
    document.getElementById('brush-opacity-val').textContent = paint.opacity;
  });

  document.getElementById('brush-softness').addEventListener('input', e => {
    paint.softness = parseInt(e.target.value);
    document.getElementById('brush-soft-val').textContent = paint.softness;
  });

  // ── Brush mode buttons ──
  document.querySelectorAll('.paint-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.paint-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      paint.mode = btn.dataset.mode;
    });
  });

  // ── Tool buttons ──
  document.querySelectorAll('.paint-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.paint-tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      paint.tool = btn.dataset.tool;
      wrapper.style.cursor = paint.tool === 'eyedropper' ? 'crosshair' : 'none';
    });
  });

  // ── Background buttons ──
  document.querySelectorAll('.paint-bg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.paint-bg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      paint.bg = btn.dataset.bg;
      wrapper.classList.remove('transparent-bg', 'light-bg');
      if (paint.bg === 'transparent') wrapper.classList.add('transparent-bg');
      else if (paint.bg === 'light') wrapper.classList.add('light-bg');
      else wrapper.style.background = '#0A0A12';
      clearPaintCanvas();
    });
  });

  // ── Clear ──
  document.getElementById('btn-clear-paint').addEventListener('click', () => {
    clearPaintCanvas();
    // Burst particles from the button
    const rect = document.getElementById('btn-clear-paint').getBoundingClientRect();
    spawnParticles(rect.left + rect.width / 2, rect.top, '#FF00FF', 20);
    showToast('Canvas cleared');
  });

  // ── Save ──
  document.getElementById('btn-save-paint').addEventListener('click', () => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = paintCanvas.width;
    tempCanvas.height = paintCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    if (paint.bg === 'dark') {
      tempCtx.fillStyle = '#0A0A12';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    } else if (paint.bg === 'light') {
      tempCtx.fillStyle = '#E8E4F8';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    }

    tempCtx.drawImage(paintCanvas, 0, 0);
    // Also composite the glow layer
    tempCtx.globalCompositeOperation = 'screen';
    tempCtx.drawImage(glowCanvas, 0, 0);
    tempCtx.globalCompositeOperation = 'source-over';

    const link = document.createElement('a');
    link.download = 'neon-rave-painting.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
    spawnParticles(window.innerWidth / 2, window.innerHeight / 2, '#00F0FF', 30);
    showToast('Saved as PNG');
  });
}

function clearPaintCanvas() {
  if (!paintCanvas) return;
  paintCtx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
  if (glowCtx) glowCtx.clearRect(0, 0, glowCanvas.width, glowCanvas.height);
}

function updatePaintPalette() {
  const strip = document.getElementById('paint-palette-strip');
  if (!strip) return;
  strip.innerHTML = '';

  // Current active color + neon fallbacks if palette is empty
  const active = { ...state.color, hex: rgbToHex(state.color.r, state.color.g, state.color.b) };
  const neonDefaults = [
    { r: 255, g: 0, b: 255, hex: '#FF00FF' },
    { r: 0, g: 240, b: 255, hex: '#00F0FF' },
    { r: 0, g: 255, b: 65, hex: '#00FF41' },
    { r: 157, g: 0, b: 255, hex: '#9D00FF' },
    { r: 240, g: 255, b: 0, hex: '#F0FF00' },
  ];
  const paletteColors = state.palette.length ? state.palette : neonDefaults;
  const allColors = [active, ...paletteColors];

  allColors.forEach((c, i) => {
    const dot = document.createElement('div');
    dot.className = 'paint-palette-dot' + (i === 0 ? ' active' : '');
    dot.style.backgroundColor = c.hex;
    dot.title = c.hex;
    dot.addEventListener('click', () => {
      state.color = { r: c.r, g: c.g, b: c.b };
      updateExplorerUI();
      // Update active state
      strip.querySelectorAll('.paint-palette-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
    });
    strip.appendChild(dot);
  });
}
