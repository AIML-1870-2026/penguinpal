/* ============================================
   NEON RAVE JULIA SET EXPLORER - ENGINE
   ============================================ */

// --- Inline Web Worker for fractal computation ---
const workerSource = `
self.onmessage = function(e) {
  const { width, height, cReal, cImag, maxIter, zoom, centerX, centerY, palette, invert, pulseMultiplier } = e.data;

  const buf = new ArrayBuffer(width * height * 4);
  const data = new Uint8ClampedArray(buf);

  const aspect = width / height;
  const rangeY = 4 / zoom;
  const rangeX = rangeY * aspect;
  const xMin = centerX - rangeX / 2;
  const yMin = centerY - rangeY / 2;
  const xStep = rangeX / width;
  const yStep = rangeY / height;
  const log2 = Math.log(2);
  const pal = palette;
  const palLen = pal.length;

  function interpColor(t, bri) {
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    for (let i = 0; i < palLen - 1; i++) {
      if (t >= pal[i][0] && t <= pal[i + 1][0]) {
        var lt = (t - pal[i][0]) / (pal[i + 1][0] - pal[i][0]);
        lt = lt * lt * (3 - 2 * lt);
        return [
          ((pal[i][1] + (pal[i + 1][1] - pal[i][1]) * lt) * bri) & 255,
          ((pal[i][2] + (pal[i + 1][2] - pal[i][2]) * lt) * bri) & 255,
          ((pal[i][3] + (pal[i + 1][3] - pal[i][3]) * lt) * bri) & 255
        ];
      }
    }
    var last = pal[palLen - 1];
    return [(last[1] * bri) & 255, (last[2] * bri) & 255, (last[3] * bri) & 255];
  }

  for (let py = 0; py < height; py++) {
    const zy0 = yMin + py * yStep;
    for (let px = 0; px < width; px++) {
      let zx = xMin + px * xStep;
      let zy = zy0;
      let iter = 0;
      let zx2 = zx * zx;
      let zy2 = zy * zy;

      while (zx2 + zy2 < 4 && iter < maxIter) {
        zy = 2 * zx * zy + cImag;
        zx = zx2 - zy2 + cReal;
        zx2 = zx * zx;
        zy2 = zy * zy;
        iter++;
      }

      const idx = (py * width + px) << 2;

      if (iter === maxIter) {
        if (invert) {
          var c = interpColor(0.5, pulseMultiplier);
          data[idx] = c[0]; data[idx+1] = c[1]; data[idx+2] = c[2];
        }
        data[idx + 3] = 255;
      } else {
        var zMag = Math.sqrt(zx2 + zy2);
        var smoothed = iter + 1 - Math.log(Math.log(zMag)) / log2;
        var t = smoothed / maxIter;
        t = ((t % 1) + 1) % 1;

        if (invert) {
          data[idx + 3] = 255;
        } else {
          var c = interpColor(t, pulseMultiplier);
          data[idx] = c[0]; data[idx+1] = c[1]; data[idx+2] = c[2];
          data[idx + 3] = 255;
        }
      }
    }
  }

  self.postMessage({ buffer: buf }, [buf]);
};
`;

const workerBlob = new Blob([workerSource], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(workerBlob);
let worker = new Worker(workerUrl);
let renderPending = false;
let renderQueued = false;

// --- State ---
const state = {
  cReal: -0.75,
  cImag: 0.11,
  maxIter: 250,
  zoom: 1.5,
  centerX: 0,
  centerY: 0,
  palette: 'electricDreams',
  effects: {
    bloom: false,
    scanlines: false,
    chromatic: false,
    invert: false,
    vignette: true
  },
  autoMorph: false,
  colorPulse: false,
  morphAngle: 0,
  morphRadius: 0.7885,
  pulsePhase: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  dragCenterX: 0,
  dragCenterY: 0,
  activePreset: 0
};

// --- Color Palettes ---
const palettes = {
  electricDreams: {
    name: 'Electric Dreams',
    colors: [
      { pos: 0.0, r: 0, g: 0, b: 0 },
      { pos: 0.15, r: 20, g: 0, b: 40 },
      { pos: 0.33, r: 255, g: 0, b: 110 },
      { pos: 0.55, r: 0, g: 240, b: 255 },
      { pos: 0.78, r: 181, g: 55, b: 242 },
      { pos: 0.95, r: 255, g: 255, b: 255 },
      { pos: 1.0, r: 0, g: 0, b: 0 }
    ]
  },
  acidTrip: {
    name: 'Acid Trip',
    colors: [
      { pos: 0.0, r: 0, g: 0, b: 0 },
      { pos: 0.2, r: 57, g: 255, b: 20 },
      { pos: 0.45, r: 255, g: 0, b: 110 },
      { pos: 0.65, r: 255, g: 255, b: 0 },
      { pos: 0.85, r: 57, g: 255, b: 20 },
      { pos: 1.0, r: 0, g: 0, b: 0 }
    ]
  },
  cyberSunset: {
    name: 'Cyber Sunset',
    colors: [
      { pos: 0.0, r: 10, g: 0, b: 20 },
      { pos: 0.25, r: 74, g: 20, b: 140 },
      { pos: 0.5, r: 233, g: 30, b: 99 },
      { pos: 0.75, r: 255, g: 111, b: 0 },
      { pos: 0.9, r: 255, g: 200, b: 50 },
      { pos: 1.0, r: 10, g: 0, b: 20 }
    ]
  },
  toxicWaste: {
    name: 'Toxic Waste',
    colors: [
      { pos: 0.0, r: 0, g: 0, b: 0 },
      { pos: 0.2, r: 0, g: 40, b: 0 },
      { pos: 0.45, r: 0, g: 255, b: 65 },
      { pos: 0.65, r: 204, g: 255, b: 0 },
      { pos: 0.85, r: 0, g: 255, b: 65 },
      { pos: 1.0, r: 0, g: 0, b: 0 }
    ]
  },
  laserShow: {
    name: 'Laser Show',
    colors: [
      { pos: 0.0, r: 0, g: 0, b: 0 },
      { pos: 0.17, r: 255, g: 0, b: 0 },
      { pos: 0.33, r: 255, g: 255, b: 0 },
      { pos: 0.5, r: 0, g: 255, b: 0 },
      { pos: 0.67, r: 0, g: 255, b: 255 },
      { pos: 0.83, r: 0, g: 0, b: 255 },
      { pos: 1.0, r: 0, g: 0, b: 0 }
    ]
  },
  blacklight: {
    name: 'Blacklight',
    colors: [
      { pos: 0.0, r: 0, g: 0, b: 10 },
      { pos: 0.2, r: 30, g: 0, b: 60 },
      { pos: 0.45, r: 191, g: 0, b: 255 },
      { pos: 0.65, r: 0, g: 255, b: 255 },
      { pos: 0.85, r: 255, g: 255, b: 255 },
      { pos: 1.0, r: 0, g: 0, b: 10 }
    ]
  }
};

// --- Presets ---
const presets = [
  { name: '\u{1F300} Spiral Vortex', cReal: -0.75, cImag: 0.11 },
  { name: '\u{26A1} Lightning Tree', cReal: -0.4, cImag: 0.6 },
  { name: '\u{1F525} Flame Fractal', cReal: 0.285, cImag: 0.01 },
  { name: '\u{1F4A0} Crystal Dendrite', cReal: -0.8, cImag: 0.156 },
  { name: '\u{1F409} Neon Dragon', cReal: -0.70176, cImag: -0.3842 },
  { name: '\u{1F30A} Electric Wave', cReal: -0.7269, cImag: 0.1889 },
  { name: '\u{1F48E} Diamond Dust', cReal: 0.3, cImag: 0.5 },
  { name: '\u{1F386} Firework', cReal: -0.54, cImag: 0.54 }
];

// --- DOM References ---
let canvas, ctx, overlay;
const dom = {};

// --- Canvas Setup ---
function initCanvas() {
  canvas = document.getElementById('fractal-canvas');
  ctx = canvas.getContext('2d', { willReadFrequently: true });
  overlay = document.getElementById('canvas-overlay');
  resizeCanvas();
}

function resizeCanvas() {
  const container = document.querySelector('.canvas-container');
  const w = container.clientWidth;
  const h = container.clientHeight;
  const size = Math.min(w, h);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const isMobile = window.innerWidth <= 600;
  const maxRes = isMobile ? 500 : 800;
  const res = Math.min(Math.round(size * dpr), maxRes);

  canvas.width = res;
  canvas.height = res;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
}

// --- Convert palette for worker (flat array format) ---
function getPaletteForWorker() {
  return palettes[state.palette].colors.map(c => [c.pos, c.r, c.g, c.b]);
}

// --- Render via Web Worker ---
function render() {
  if (renderPending) {
    renderQueued = true;
    return;
  }
  renderPending = true;

  const pulseMultiplier = state.colorPulse
    ? 0.75 + 0.5 * Math.sin(state.pulsePhase)
    : 1.0;

  worker.postMessage({
    width: canvas.width,
    height: canvas.height,
    cReal: state.cReal,
    cImag: state.cImag,
    maxIter: state.maxIter,
    zoom: state.zoom,
    centerX: state.centerX,
    centerY: state.centerY,
    palette: getPaletteForWorker(),
    invert: state.effects.invert,
    pulseMultiplier
  });
}

worker.onmessage = function(e) {
  const data = new Uint8ClampedArray(e.data.buffer);
  const imageData = new ImageData(data, canvas.width, canvas.height);
  ctx.putImageData(imageData, 0, 0);
  applyEffects();
  renderPending = false;
  fpsFrameCount++;

  if (renderQueued) {
    renderQueued = false;
    render();
  } else if (state.autoMorph) {
    requestAnimationFrame(morphStep);
  } else if (state.colorPulse) {
    requestAnimationFrame(pulseStep);
  }
};

// --- Post-Processing Effects ---
function applyEffects() {
  if (state.effects.bloom) applyBloom();
  if (state.effects.chromatic) applyChromaticAberration();

  overlay.className = 'canvas-overlay';
  if (state.effects.scanlines) overlay.classList.add('scanlines-active');
  if (state.effects.vignette) overlay.classList.add('vignette-active');
}

function applyBloom() {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.filter = 'blur(6px) brightness(1.6)';
  tempCtx.drawImage(canvas, 0, 0);

  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.35;
  ctx.drawImage(tempCanvas, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

function applyChromaticAberration() {
  const w = canvas.width;
  const h = canvas.height;
  const src = ctx.getImageData(0, 0, w, h);
  const srcData = src.data;
  const result = ctx.createImageData(w, h);
  const destData = result.data;
  const offset = Math.max(2, Math.round(w / 300));

  for (let y = 0; y < h; y++) {
    const rowOffset = y * w;
    for (let x = 0; x < w; x++) {
      const idx = (rowOffset + x) << 2;
      const rIdx = (rowOffset + Math.max(0, x - offset)) << 2;
      const bIdx = (rowOffset + Math.min(w - 1, x + offset)) << 2;
      destData[idx] = srcData[rIdx];
      destData[idx + 1] = srcData[idx + 1];
      destData[idx + 2] = srcData[bIdx + 2];
      destData[idx + 3] = 255;
    }
  }

  ctx.putImageData(result, 0, 0);
}

// --- UI Setup ---
function buildUI() {
  buildPalettes();
  buildPresets();
  bindSliders();
  bindEffects();
  bindActions();
  bindZoom();
  updateInfoBar();
}

function buildPalettes() {
  const grid = document.getElementById('palette-grid');
  grid.innerHTML = '';

  for (const [key, pal] of Object.entries(palettes)) {
    const btn = document.createElement('button');
    btn.className = 'palette-btn' + (state.palette === key ? ' active' : '');
    btn.setAttribute('aria-label', pal.name + ' color palette');
    btn.dataset.palette = key;

    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    const stops = pal.colors.map(c => `rgb(${c.r},${c.g},${c.b}) ${c.pos * 100}%`).join(', ');
    swatch.style.background = `linear-gradient(90deg, ${stops})`;

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = pal.name;

    btn.append(swatch, label);
    btn.addEventListener('click', () => selectPalette(key));
    grid.appendChild(btn);
  }
}

function selectPalette(key) {
  state.palette = key;
  document.querySelectorAll('.palette-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.palette === key);
  });
  scheduleRender();
}

function buildPresets() {
  const grid = document.getElementById('preset-grid');
  grid.innerHTML = '';

  presets.forEach((p, i) => {
    const btn = document.createElement('button');
    btn.className = 'preset-btn' + (i === state.activePreset ? ' active' : '');
    btn.textContent = p.name;
    btn.setAttribute('aria-label', p.name + ' preset');
    btn.dataset.index = i;
    btn.addEventListener('click', () => selectPreset(i));
    grid.appendChild(btn);
  });
}

function selectPreset(index) {
  const p = presets[index];
  state.cReal = p.cReal;
  state.cImag = p.cImag;
  state.activePreset = index;
  state.zoom = 1.5;
  state.centerX = 0;
  state.centerY = 0;

  document.querySelectorAll('.preset-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.index) === index);
  });

  updateSliders();
  updateInfoBar();
  scheduleRender();
}

function bindSliders() {
  dom.sliderCReal = document.getElementById('slider-c-real');
  dom.sliderCImag = document.getElementById('slider-c-imag');
  dom.sliderIter = document.getElementById('slider-iter');
  dom.valueCReal = document.getElementById('value-c-real');
  dom.valueCImag = document.getElementById('value-c-imag');
  dom.valueIter = document.getElementById('value-iter');

  dom.sliderCReal.value = state.cReal;
  dom.sliderCImag.value = state.cImag;
  dom.sliderIter.value = state.maxIter;
  updateSliderDisplays();

  dom.sliderCReal.addEventListener('input', () => {
    state.cReal = parseFloat(dom.sliderCReal.value);
    clearActivePreset();
    updateSliderDisplays();
    updateInfoBar();
    scheduleRender();
  });

  dom.sliderCImag.addEventListener('input', () => {
    state.cImag = parseFloat(dom.sliderCImag.value);
    clearActivePreset();
    updateSliderDisplays();
    updateInfoBar();
    scheduleRender();
  });

  dom.sliderIter.addEventListener('input', () => {
    state.maxIter = parseInt(dom.sliderIter.value);
    updateSliderDisplays();
    updateInfoBar();
    scheduleRender();
  });
}

function updateSliders() {
  dom.sliderCReal.value = state.cReal;
  dom.sliderCImag.value = state.cImag;
  dom.sliderIter.value = state.maxIter;
  updateSliderDisplays();
}

function updateSliderDisplays() {
  dom.valueCReal.textContent = state.cReal.toFixed(4);
  dom.valueCImag.textContent = state.cImag.toFixed(4);
  dom.valueIter.textContent = state.maxIter;
}

function clearActivePreset() {
  state.activePreset = -1;
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
}

function bindEffects() {
  document.querySelectorAll('.effect-btn').forEach(btn => {
    const effect = btn.dataset.effect;
    btn.classList.toggle('active', state.effects[effect]);
    btn.addEventListener('click', () => {
      state.effects[effect] = !state.effects[effect];
      btn.classList.toggle('active', state.effects[effect]);
      scheduleRender();
    });
  });
}

function bindActions() {
  document.getElementById('btn-random').addEventListener('click', randomC);
  document.getElementById('btn-morph').addEventListener('click', toggleAutoMorph);
  document.getElementById('btn-capture').addEventListener('click', takeScreenshot);
  document.getElementById('btn-pulse').addEventListener('click', toggleColorPulse);
}

function bindZoom() {
  document.getElementById('zoom-in').addEventListener('click', () => {
    state.zoom *= 1.5;
    updateInfoBar();
    scheduleRender();
  });

  document.getElementById('zoom-out').addEventListener('click', () => {
    state.zoom = Math.max(0.2, state.zoom / 1.5);
    updateInfoBar();
    scheduleRender();
  });

  document.getElementById('zoom-reset').addEventListener('click', () => {
    state.zoom = 1.5;
    state.centerX = 0;
    state.centerY = 0;
    updateInfoBar();
    scheduleRender();
  });
}

function updateInfoBar() {
  const sign = state.cImag >= 0 ? '+' : '-';
  document.getElementById('info-c').textContent =
    `${state.cReal.toFixed(4)} ${sign} ${Math.abs(state.cImag).toFixed(4)}i`;
  document.getElementById('info-zoom').textContent = state.zoom.toFixed(2) + 'x';
  document.getElementById('info-iter').textContent = state.maxIter;
}

// --- Render Scheduling (debounced for user input) ---
let renderTimeout = null;

function scheduleRender() {
  if (renderTimeout) clearTimeout(renderTimeout);
  renderTimeout = setTimeout(() => {
    render();
    renderTimeout = null;
  }, 40);
}

// --- Mouse / Touch Interactions ---
function initInteractions() {
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;

    const aspect = canvas.width / canvas.height;
    const rangeY = 4 / state.zoom;
    const rangeX = rangeY * aspect;
    const worldX = state.centerX - rangeX / 2 + mx * rangeX;
    const worldY = state.centerY - rangeY / 2 + my * rangeY;

    const factor = e.deltaY < 0 ? 1.25 : 0.8;
    const newZoom = Math.max(0.2, state.zoom * factor);

    const newRangeY = 4 / newZoom;
    const newRangeX = newRangeY * aspect;
    state.centerX = worldX - (mx - 0.5) * newRangeX;
    state.centerY = worldY - (my - 0.5) * newRangeY;
    state.zoom = newZoom;

    updateInfoBar();
    scheduleRender();
  }, { passive: false });

  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    state.isDragging = true;
    state.dragStartX = e.clientX;
    state.dragStartY = e.clientY;
    state.dragCenterX = state.centerX;
    state.dragCenterY = state.centerY;
    canvas.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', e => {
    if (!state.isDragging) return;
    const rect = canvas.getBoundingClientRect();
    const aspect = canvas.width / canvas.height;
    const rangeY = 4 / state.zoom;
    const rangeX = rangeY * aspect;

    const dx = (e.clientX - state.dragStartX) / rect.width * rangeX;
    const dy = (e.clientY - state.dragStartY) / rect.height * rangeY;
    state.centerX = state.dragCenterX - dx;
    state.centerY = state.dragCenterY - dy;
    updateInfoBar();
    scheduleRender();
  });

  window.addEventListener('mouseup', () => {
    state.isDragging = false;
    canvas.style.cursor = 'crosshair';
  });

  canvas.addEventListener('dblclick', () => {
    state.zoom = 1.5;
    state.centerX = 0;
    state.centerY = 0;
    updateInfoBar();
    scheduleRender();
  });

  // Touch support
  let lastTouchDist = 0;

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length === 1) {
      state.isDragging = true;
      state.dragStartX = e.touches[0].clientX;
      state.dragStartY = e.touches[0].clientY;
      state.dragCenterX = state.centerX;
      state.dragCenterY = state.centerY;
    } else if (e.touches.length === 2) {
      state.isDragging = false;
      lastTouchDist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 1 && state.isDragging) {
      const rect = canvas.getBoundingClientRect();
      const aspect = canvas.width / canvas.height;
      const rangeY = 4 / state.zoom;
      const rangeX = rangeY * aspect;
      const dx = (e.touches[0].clientX - state.dragStartX) / rect.width * rangeX;
      const dy = (e.touches[0].clientY - state.dragStartY) / rect.height * rangeY;
      state.centerX = state.dragCenterX - dx;
      state.centerY = state.dragCenterY - dy;
      updateInfoBar();
      scheduleRender();
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      state.zoom = Math.max(0.2, state.zoom * (dist / lastTouchDist));
      lastTouchDist = dist;
      updateInfoBar();
      scheduleRender();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', () => {
    state.isDragging = false;
  });
}

// --- Keyboard Shortcuts ---
function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        toggleAutoMorph();
        break;
      case 'r': case 'R': randomC(); break;
      case 'p': case 'P': cyclePalette(); break;
      case 's': case 'S': takeScreenshot(); break;
      case '+': case '=':
        state.zoom *= 1.5;
        updateInfoBar();
        scheduleRender();
        break;
      case '-': case '_':
        state.zoom = Math.max(0.2, state.zoom / 1.5);
        updateInfoBar();
        scheduleRender();
        break;
      case 'ArrowUp':
        e.preventDefault();
        state.centerY -= 0.2 / state.zoom;
        updateInfoBar(); scheduleRender();
        break;
      case 'ArrowDown':
        e.preventDefault();
        state.centerY += 0.2 / state.zoom;
        updateInfoBar(); scheduleRender();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        state.centerX -= 0.2 / state.zoom;
        updateInfoBar(); scheduleRender();
        break;
      case 'ArrowRight':
        e.preventDefault();
        state.centerX += 0.2 / state.zoom;
        updateInfoBar(); scheduleRender();
        break;
      default:
        if (e.key >= '1' && e.key <= '8') selectPreset(parseInt(e.key) - 1);
        break;
    }
  });
}

// --- Actions ---
function randomC() {
  state.cReal = Math.random() * 2.4 - 1.2;
  state.cImag = Math.random() * 2.4 - 1.2;
  const mag = Math.sqrt(state.cReal * state.cReal + state.cImag * state.cImag);
  if (mag > 1.5) {
    state.cReal *= 1.2 / mag;
    state.cImag *= 1.2 / mag;
  }
  state.zoom = 1.5;
  state.centerX = 0;
  state.centerY = 0;
  clearActivePreset();
  updateSliders();
  updateInfoBar();
  scheduleRender();
}

function toggleAutoMorph() {
  state.autoMorph = !state.autoMorph;
  const btn = document.getElementById('btn-morph');
  btn.classList.toggle('active', state.autoMorph);
  btn.textContent = state.autoMorph ? '\u{23F8}\uFE0F Pause' : '\u{25B6}\uFE0F Auto-Morph';

  if (state.autoMorph) {
    state.morphAngle = Math.atan2(state.cImag, state.cReal);
    state.morphRadius = Math.sqrt(state.cReal * state.cReal + state.cImag * state.cImag);
    if (state.morphRadius < 0.1) state.morphRadius = 0.7885;
    morphStep();
  }
}

function morphStep() {
  if (!state.autoMorph) return;
  state.morphAngle += 0.008;
  state.cReal = state.morphRadius * Math.cos(state.morphAngle);
  state.cImag = state.morphRadius * Math.sin(state.morphAngle);
  clearActivePreset();
  updateSliders();
  updateInfoBar();
  render(); // worker.onmessage will call next morphStep when done
}

function toggleColorPulse() {
  state.colorPulse = !state.colorPulse;
  const btn = document.getElementById('btn-pulse');
  btn.classList.toggle('active', state.colorPulse);

  if (state.colorPulse && !state.autoMorph) {
    pulseStep();
  }
}

function pulseStep() {
  if (!state.colorPulse || state.autoMorph) return;
  state.pulsePhase += 0.06;
  render(); // worker.onmessage will call next pulseStep when done
}

function cyclePalette() {
  const keys = Object.keys(palettes);
  const idx = keys.indexOf(state.palette);
  selectPalette(keys[(idx + 1) % keys.length]);
}

function takeScreenshot() {
  const flash = document.getElementById('screenshot-flash');
  flash.classList.add('flash');
  setTimeout(() => flash.classList.remove('flash'), 500);

  const link = document.createElement('a');
  link.download = `julia-rave-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// --- Splash Screen ---
function initSplash() {
  const warning = document.getElementById('seizure-warning');
  const splash = document.getElementById('splash-screen');

  document.getElementById('warning-accept').addEventListener('click', () => {
    warning.classList.add('hidden');
    splash.classList.remove('hidden');
    setTimeout(dismissSplash, 3500);
  });

  document.getElementById('warning-safe').addEventListener('click', () => {
    warning.classList.add('hidden');
    state.effects.bloom = false;
    state.effects.scanlines = false;
    state.colorPulse = false;
    state.autoMorph = false;
    splash.classList.add('hidden');
    render();
  });

  splash.addEventListener('click', dismissSplash);
}

function dismissSplash() {
  const splash = document.getElementById('splash-screen');
  if (splash.classList.contains('fade-out') || splash.classList.contains('hidden')) return;
  splash.classList.add('fade-out');
  setTimeout(() => {
    splash.classList.add('hidden');
    showTutorial();
  }, 800);
}

function showTutorial() {
  const tut = document.getElementById('tutorial');
  if (!tut) return;
  tut.classList.remove('hidden');
  setTimeout(() => tut.classList.add('hidden'), 6000);
  tut.addEventListener('click', () => tut.classList.add('hidden'));
}

// --- FPS Counter ---
let fpsFrameCount = 0;
let fpsLastTime = performance.now();

function updateFPS() {
  const now = performance.now();
  if (now - fpsLastTime >= 1000) {
    document.getElementById('info-fps').textContent = fpsFrameCount;
    fpsFrameCount = 0;
    fpsLastTime = now;
  }
  requestAnimationFrame(updateFPS);
}

// --- Resize Handler ---
function initResize() {
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeCanvas();
      render();
    }, 200);
  });
}

// --- Cursor Coordinate Display ---
function initCursorCoords() {
  canvas.addEventListener('mousemove', e => {
    if (state.isDragging) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;

    const aspect = canvas.width / canvas.height;
    const rangeY = 4 / state.zoom;
    const rangeX = rangeY * aspect;
    const worldX = state.centerX - rangeX / 2 + mx * rangeX;
    const worldY = state.centerY - rangeY / 2 + my * rangeY;

    const sign = worldY >= 0 ? '+' : '-';
    document.getElementById('info-cursor').textContent =
      `${worldX.toFixed(3)} ${sign} ${Math.abs(worldY).toFixed(3)}i`;
  });

  canvas.addEventListener('mouseleave', () => {
    document.getElementById('info-cursor').textContent = '\u2014';
  });
}

// --- Initialize ---
function init() {
  initCanvas();
  buildUI();
  initInteractions();
  initKeyboard();
  initSplash();
  initResize();
  initCursorCoords();
  updateFPS();
  render();
}

document.addEventListener('DOMContentLoaded', init);
