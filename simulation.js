// ===== Gray-Scott Reaction-Diffusion Simulation =====
// Proper implementation based on Karl Sims' work

const CONFIG = {
    width: 256,
    height: 256,
    dA: 1.0,      // Diffusion rate of chemical A
    dB: 0.5,      // Diffusion rate of chemical B
    dt: 1.0       // Time step
};

// ===== Color Schemes =====
const COLOR_SCHEMES = [
    { name: 'Cyberpunk', colors: ['#0a0a0a', '#ff006e', '#00f5ff'] },
    { name: 'Acid Trip', colors: ['#000000', '#39ff14', '#bf00ff'] },
    { name: 'Laser Show', colors: ['#000000', '#ff0055', '#ffffff'] },
    { name: 'UV Blacklight', colors: ['#0a0a1a', '#bf00ff', '#00f5ff'] },
    { name: 'Electric Dreams', colors: ['#0a0a0a', '#0066ff', '#ff006e'] },
    { name: 'Toxic Glow', colors: ['#0a0a0a', '#39ff14', '#ff006e'] },
    { name: 'Neon Noir', colors: ['#000000', '#00f5ff', '#ff006e'] },
    { name: 'Rave Sunrise', colors: ['#1a0a2e', '#ff6600', '#dfff00'] }
];

// ===== Pattern Presets (carefully tuned for visible patterns) =====
const PRESETS = [
    { name: 'Coral Growth', feed: 0.055, kill: 0.062 },
    { name: 'Mitosis', feed: 0.0367, kill: 0.0649 },
    { name: 'Fingerprints', feed: 0.037, kill: 0.06 },
    { name: 'Spotted', feed: 0.03, kill: 0.062 },
    { name: 'Maze Runner', feed: 0.029, kill: 0.057 },
    { name: 'Worms', feed: 0.078, kill: 0.061 },
    { name: 'Bubbles', feed: 0.025, kill: 0.06 }
];

// ===== State =====
let gridA, gridB, nextA, nextB;
let feed = 0.055;
let kill = 0.062;
let speed = 1;
let isPlaying = true;
let brushSize = 15;
let selectedChemical = 'A';
let currentColorScheme = 0;
let isDrawing = false;

// ===== Canvas Setup =====
const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');
const paramCanvas = document.getElementById('parameterMap');
const paramCtx = paramCanvas.getContext('2d');

// Offscreen canvas for smooth upscaling
const offCanvas = document.createElement('canvas');
offCanvas.width = CONFIG.width;
offCanvas.height = CONFIG.height;
const offCtx = offCanvas.getContext('2d');
const imageData = offCtx.createImageData(CONFIG.width, CONFIG.height);

// ===== Initialize Grid =====
function initGrid() {
    const w = CONFIG.width;
    const h = CONFIG.height;
    const size = w * h;

    gridA = new Float32Array(size);
    gridB = new Float32Array(size);
    nextA = new Float32Array(size);
    nextB = new Float32Array(size);

    // Fill with chemical A (substrate)
    gridA.fill(1.0);
    gridB.fill(0.0);

    // Add a small seed in the center - this is key!
    // Just a small square, patterns will grow from here
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);
    const seedSize = 10;

    for (let y = cy - seedSize; y <= cy + seedSize; y++) {
        for (let x = cx - seedSize; x <= cx + seedSize; x++) {
            if (x >= 0 && x < w && y >= 0 && y < h) {
                const i = y * w + x;
                gridA[i] = 0.0;
                gridB[i] = 1.0;
            }
        }
    }

    // Add a few more small seeds
    for (let s = 0; s < 5; s++) {
        const sx = Math.floor(w * 0.2 + Math.random() * w * 0.6);
        const sy = Math.floor(h * 0.2 + Math.random() * h * 0.6);
        const size = 3 + Math.floor(Math.random() * 5);

        for (let y = sy - size; y <= sy + size; y++) {
            for (let x = sx - size; x <= sx + size; x++) {
                if (x >= 0 && x < w && y >= 0 && y < h) {
                    const i = y * w + x;
                    gridA[i] = 0.0;
                    gridB[i] = 1.0;
                }
            }
        }
    }
}

// ===== Laplacian with 9-point stencil =====
function laplacian(grid, x, y, w, h) {
    const i = y * w + x;

    // Wrap coordinates for periodic boundary
    const xm = (x - 1 + w) % w;
    const xp = (x + 1) % w;
    const ym = (y - 1 + h) % h;
    const yp = (y + 1) % h;

    // 9-point Laplacian stencil (more accurate)
    // Center: -1, Adjacent: 0.2, Diagonals: 0.05
    const center = grid[i];
    const adjacent = grid[ym * w + x] + grid[yp * w + x] +
                     grid[y * w + xm] + grid[y * w + xp];
    const diagonals = grid[ym * w + xm] + grid[ym * w + xp] +
                      grid[yp * w + xm] + grid[yp * w + xp];

    return adjacent * 0.2 + diagonals * 0.05 - center;
}

// ===== Simulation Step =====
function simulate() {
    const w = CONFIG.width;
    const h = CONFIG.height;
    const dA = CONFIG.dA;
    const dB = CONFIG.dB;
    const f = feed;
    const k = kill;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = y * w + x;

            const a = gridA[i];
            const b = gridB[i];

            // Laplacian (diffusion)
            const lapA = laplacian(gridA, x, y, w, h);
            const lapB = laplacian(gridB, x, y, w, h);

            // Reaction term
            const reaction = a * b * b;

            // Gray-Scott equations
            nextA[i] = a + (dA * lapA - reaction + f * (1.0 - a)) * CONFIG.dt;
            nextB[i] = b + (dB * lapB + reaction - (k + f) * b) * CONFIG.dt;

            // Clamp to valid range
            nextA[i] = Math.max(0, Math.min(1, nextA[i]));
            nextB[i] = Math.max(0, Math.min(1, nextB[i]));
        }
    }

    // Swap buffers
    [gridA, nextA] = [nextA, gridA];
    [gridB, nextB] = [nextB, gridB];
}

// ===== Render =====
function render() {
    const w = CONFIG.width;
    const h = CONFIG.height;
    const data = imageData.data;
    const colors = COLOR_SCHEMES[currentColorScheme].colors;

    for (let i = 0; i < w * h; i++) {
        const idx = i * 4;

        // Use chemical B concentration for coloring
        // Higher B = more pattern visible
        const b = gridB[i];
        const a = gridA[i];

        // Create smooth gradient based on B concentration
        const t = Math.min(1, b * 2); // Amplify for visibility

        const color = interpolateColors(colors, t);

        data[idx] = color.r;
        data[idx + 1] = color.g;
        data[idx + 2] = color.b;
        data[idx + 3] = 255;
    }

    // Draw to offscreen canvas
    offCtx.putImageData(imageData, 0, 0);

    // Upscale smoothly to main canvas
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(offCanvas, 0, 0, canvas.width, canvas.height);
}

// ===== Color Interpolation =====
function interpolateColors(colors, t) {
    t = Math.max(0, Math.min(1, t));

    if (colors.length === 2) {
        const c1 = hexToRgb(colors[0]);
        const c2 = hexToRgb(colors[1]);
        return {
            r: Math.round(c1.r + (c2.r - c1.r) * t),
            g: Math.round(c1.g + (c2.g - c1.g) * t),
            b: Math.round(c1.b + (c2.b - c1.b) * t)
        };
    }

    // 3-color gradient
    const c1 = hexToRgb(colors[0]);
    const c2 = hexToRgb(colors[1]);
    const c3 = hexToRgb(colors[2]);

    if (t < 0.5) {
        const lt = t * 2;
        return {
            r: Math.round(c1.r + (c2.r - c1.r) * lt),
            g: Math.round(c1.g + (c2.g - c1.g) * lt),
            b: Math.round(c1.b + (c2.b - c1.b) * lt)
        };
    } else {
        const lt = (t - 0.5) * 2;
        return {
            r: Math.round(c2.r + (c3.r - c2.r) * lt),
            g: Math.round(c2.g + (c3.g - c2.g) * lt),
            b: Math.round(c2.b + (c3.b - c2.b) * lt)
        };
    }
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

// ===== Parameter Map =====
function drawParameterMap() {
    const width = paramCanvas.width;
    const height = paramCanvas.height;

    // Background
    const gradient = paramCtx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1a0a2e');
    gradient.addColorStop(1, '#16213e');
    paramCtx.fillStyle = gradient;
    paramCtx.fillRect(0, 0, width, height);

    // Grid
    paramCtx.strokeStyle = 'rgba(0, 245, 255, 0.2)';
    paramCtx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
        const x = (i / 10) * width;
        const y = (i / 10) * height;
        paramCtx.beginPath();
        paramCtx.moveTo(x, 0);
        paramCtx.lineTo(x, height);
        paramCtx.stroke();
        paramCtx.beginPath();
        paramCtx.moveTo(0, y);
        paramCtx.lineTo(width, y);
        paramCtx.stroke();
    }

    // Position indicator
    const feedRange = { min: 0.01, max: 0.08 };
    const killRange = { min: 0.04, max: 0.07 };
    const posX = ((feed - feedRange.min) / (feedRange.max - feedRange.min)) * width;
    const posY = height - ((kill - killRange.min) / (killRange.max - killRange.min)) * height;

    // Glow
    paramCtx.beginPath();
    paramCtx.arc(posX, posY, 12, 0, Math.PI * 2);
    paramCtx.fillStyle = 'rgba(255, 0, 110, 0.3)';
    paramCtx.fill();

    paramCtx.beginPath();
    paramCtx.arc(posX, posY, 6, 0, Math.PI * 2);
    paramCtx.fillStyle = '#ff006e';
    paramCtx.fill();

    document.getElementById('mapCoords').textContent = `F: ${feed.toFixed(3)} | K: ${kill.toFixed(3)}`;
}

// ===== Add Disturbance (draw on canvas) =====
function addDisturbance(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CONFIG.width / rect.width;
    const scaleY = CONFIG.height / rect.height;

    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const gridX = Math.floor(canvasX * scaleX);
    const gridY = Math.floor(canvasY * scaleY);
    const radius = Math.max(2, Math.floor(brushSize * scaleX / 4));

    const w = CONFIG.width;
    const h = CONFIG.height;

    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy <= radius * radius) {
                const x = (gridX + dx + w) % w;
                const y = (gridY + dy + h) % h;
                const i = y * w + x;

                if (selectedChemical === 'A') {
                    gridA[i] = 0.0;
                    gridB[i] = 1.0;
                } else {
                    gridA[i] = 1.0;
                    gridB[i] = 0.0;
                }
            }
        }
    }
}

// ===== Setup UI =====
function setupUI() {
    // Color swatches
    const swatchContainer = document.getElementById('colorSwatches');
    COLOR_SCHEMES.forEach((scheme, index) => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch' + (index === 0 ? ' active' : '');
        swatch.style.background = `linear-gradient(135deg, ${scheme.colors.join(', ')})`;
        swatch.title = scheme.name;
        swatch.onclick = () => {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            currentColorScheme = index;
        };
        swatchContainer.appendChild(swatch);
    });

    // Preset buttons
    const presetContainer = document.getElementById('presetButtons');
    PRESETS.forEach((preset, idx) => {
        const btn = document.createElement('button');
        btn.className = 'preset-btn' + (idx === 0 ? ' active' : '');
        btn.textContent = preset.name;
        btn.onclick = () => {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            feed = preset.feed;
            kill = preset.kill;
            document.getElementById('feedSlider').value = feed;
            document.getElementById('killSlider').value = kill;
            document.getElementById('feedValue').textContent = feed.toFixed(3);
            document.getElementById('killValue').textContent = kill.toFixed(3);
            document.querySelector('.pattern-name').textContent = preset.name;
            drawParameterMap();
        };
        presetContainer.appendChild(btn);
    });

    // Sliders
    document.getElementById('feedSlider').oninput = (e) => {
        feed = parseFloat(e.target.value);
        document.getElementById('feedValue').textContent = feed.toFixed(3);
        document.querySelector('.pattern-name').textContent = 'Custom';
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        drawParameterMap();
    };

    document.getElementById('killSlider').oninput = (e) => {
        kill = parseFloat(e.target.value);
        document.getElementById('killValue').textContent = kill.toFixed(3);
        document.querySelector('.pattern-name').textContent = 'Custom';
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        drawParameterMap();
    };

    document.getElementById('speedSlider').oninput = (e) => {
        speed = parseFloat(e.target.value);
        document.getElementById('speedValue').textContent = speed.toFixed(1) + 'x';
    };

    // Brush sizes
    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            brushSize = parseInt(btn.dataset.size);
        };
    });

    // Chemical toggle
    document.querySelectorAll('.chem-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.chem-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedChemical = btn.dataset.chem;
        };
    });

    // Control buttons
    document.getElementById('playPauseBtn').onclick = () => {
        isPlaying = !isPlaying;
        document.getElementById('playPauseBtn').classList.toggle('playing', isPlaying);
    };

    document.getElementById('resetBtn').onclick = () => initGrid();

    document.getElementById('randomizeBtn').onclick = () => {
        feed = 0.02 + Math.random() * 0.05;
        kill = 0.045 + Math.random() * 0.02;
        document.getElementById('feedSlider').value = feed;
        document.getElementById('killSlider').value = kill;
        document.getElementById('feedValue').textContent = feed.toFixed(3);
        document.getElementById('killValue').textContent = kill.toFixed(3);
        document.querySelector('.pattern-name').textContent = 'Random';
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        drawParameterMap();
    };

    // Save
    document.getElementById('saveBtn').onclick = () => {
        const link = document.createElement('a');
        link.download = `turing-rave-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    };

    // About modal
    document.getElementById('aboutBtn').onclick = () => {
        document.getElementById('aboutModal').classList.add('active');
    };
    document.querySelector('.close-btn').onclick = () => {
        document.getElementById('aboutModal').classList.remove('active');
    };
    document.getElementById('aboutModal').onclick = (e) => {
        if (e.target.id === 'aboutModal') {
            document.getElementById('aboutModal').classList.remove('active');
        }
    };

    // Parameter map click
    paramCanvas.onclick = (e) => {
        const rect = paramCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const feedRange = { min: 0.01, max: 0.08 };
        const killRange = { min: 0.04, max: 0.07 };

        feed = feedRange.min + (x / paramCanvas.width) * (feedRange.max - feedRange.min);
        kill = killRange.min + (1 - y / paramCanvas.height) * (killRange.max - killRange.min);

        document.getElementById('feedSlider').value = feed;
        document.getElementById('killSlider').value = kill;
        document.getElementById('feedValue').textContent = feed.toFixed(3);
        document.getElementById('killValue').textContent = kill.toFixed(3);
        document.querySelector('.pattern-name').textContent = 'Custom';
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        drawParameterMap();
    };

    // Canvas drawing
    canvas.onmousedown = (e) => { isDrawing = true; addDisturbance(e); };
    canvas.onmousemove = (e) => { if (isDrawing) addDisturbance(e); };
    canvas.onmouseup = () => isDrawing = false;
    canvas.onmouseleave = () => isDrawing = false;

    // Touch
    canvas.ontouchstart = (e) => { e.preventDefault(); isDrawing = true; addDisturbance(e.touches[0]); };
    canvas.ontouchmove = (e) => { e.preventDefault(); if (isDrawing) addDisturbance(e.touches[0]); };
    canvas.ontouchend = () => isDrawing = false;
}

// ===== Animation Loop =====
function animate() {
    if (isPlaying) {
        // Run simulation steps based on speed
        // Fewer iterations = slower pattern development
        const iterations = Math.max(1, Math.floor(speed * 2));
        for (let i = 0; i < iterations; i++) {
            simulate();
        }
    }

    render();
    drawParameterMap();
    requestAnimationFrame(animate);
}

// ===== Audio System =====
let audioContext = null;
let analyser = null;
let audioData = null;
let micStream = null;
let isMicActive = false;
let isSynthActive = false;
let synthOscillators = [];
let synthGain = null;
let bassLevel = 0;
let midLevel = 0;
let highLevel = 0;
let audioCanvas, audioCtx;

function initAudio() {
    audioCanvas = document.getElementById('audioCanvas');
    audioCtx = audioCanvas.getContext('2d');
}

async function startMicrophone() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (isMicActive) {
            stopMicrophone();
            return;
        }

        // Stop synth if running
        if (isSynthActive) stopSynth();

        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioContext.createMediaStreamSource(micStream);

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        audioData = new Uint8Array(analyser.frequencyBinCount);

        source.connect(analyser);

        isMicActive = true;
        document.getElementById('micBtn').classList.add('active');
        document.getElementById('audioStatus').textContent = '🎤 Listening to you...';
    } catch (err) {
        document.getElementById('audioStatus').textContent = 'Mic access denied';
        console.error(err);
    }
}

function stopMicrophone() {
    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
        micStream = null;
    }
    isMicActive = false;
    document.getElementById('micBtn').classList.remove('active');
    document.getElementById('audioStatus').textContent = 'Click to enable audio';
}

function startSynth() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (isSynthActive) {
        stopSynth();
        return;
    }

    // Stop mic if running
    if (isMicActive) stopMicrophone();

    // Create analyser
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    audioData = new Uint8Array(analyser.frequencyBinCount);

    // Master gain
    synthGain = audioContext.createGain();
    synthGain.gain.value = 0.15;
    synthGain.connect(analyser);
    analyser.connect(audioContext.destination);

    // Create ambient synth pads
    const notes = [55, 82.5, 110, 165, 220, 330]; // A1, E2, A2, E3, A3, E4
    const now = audioContext.currentTime;

    notes.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.type = i < 2 ? 'sine' : (i < 4 ? 'triangle' : 'sine');
        osc.frequency.value = freq;

        // Slow LFO for movement
        const lfo = audioContext.createOscillator();
        const lfoGain = audioContext.createGain();
        lfo.frequency.value = 0.1 + Math.random() * 0.3;
        lfoGain.gain.value = freq * 0.02;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();

        gain.gain.value = 0.3 / notes.length;

        osc.connect(gain);
        gain.connect(synthGain);
        osc.start();

        synthOscillators.push({ osc, gain, lfo, lfoGain });
    });

    // Add rhythmic pulse
    schedulePulse();

    isSynthActive = true;
    document.getElementById('musicBtn').classList.add('active');
    document.getElementById('audioStatus').textContent = '🎵 Ambient synth playing...';
}

function schedulePulse() {
    if (!isSynthActive) return;

    const now = audioContext.currentTime;
    const pulseOsc = audioContext.createOscillator();
    const pulseGain = audioContext.createGain();

    // Random bass note
    const bassNotes = [55, 65.4, 73.4, 82.4, 110];
    pulseOsc.frequency.value = bassNotes[Math.floor(Math.random() * bassNotes.length)];
    pulseOsc.type = 'sine';

    pulseGain.gain.setValueAtTime(0, now);
    pulseGain.gain.linearRampToValueAtTime(0.4, now + 0.05);
    pulseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

    pulseOsc.connect(pulseGain);
    pulseGain.connect(synthGain);

    pulseOsc.start(now);
    pulseOsc.stop(now + 1);

    // Schedule next pulse (random rhythm)
    const nextPulse = 0.5 + Math.random() * 1.5;
    setTimeout(schedulePulse, nextPulse * 1000);
}

function stopSynth() {
    synthOscillators.forEach(({ osc, lfo }) => {
        try {
            osc.stop();
            lfo.stop();
        } catch (e) {}
    });
    synthOscillators = [];
    isSynthActive = false;
    document.getElementById('musicBtn').classList.remove('active');
    document.getElementById('audioStatus').textContent = 'Click to enable audio';
}

function analyzeAudio() {
    if (!analyser || !audioData) return;

    analyser.getByteFrequencyData(audioData);

    // Split into frequency bands
    const len = audioData.length;
    const bassEnd = Math.floor(len * 0.1);
    const midEnd = Math.floor(len * 0.5);

    let bassSum = 0, midSum = 0, highSum = 0;

    for (let i = 0; i < len; i++) {
        if (i < bassEnd) bassSum += audioData[i];
        else if (i < midEnd) midSum += audioData[i];
        else highSum += audioData[i];
    }

    bassLevel = bassSum / (bassEnd * 255);
    midLevel = midSum / ((midEnd - bassEnd) * 255);
    highLevel = highSum / ((len - midEnd) * 255);

    // Draw visualizer
    drawAudioVisualizer();

    // Modulate simulation based on audio
    modulateSimulation();
}

function drawAudioVisualizer() {
    const width = audioCanvas.width;
    const height = audioCanvas.height;

    audioCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    audioCtx.fillRect(0, 0, width, height);

    if (!audioData) return;

    const barWidth = width / audioData.length * 2;
    const barSpacing = 1;

    for (let i = 0; i < audioData.length / 2; i++) {
        const value = audioData[i];
        const barHeight = (value / 255) * height;

        // Color based on frequency
        const hue = (i / audioData.length) * 180 + 280; // Purple to cyan
        audioCtx.fillStyle = `hsla(${hue}, 100%, 60%, 0.8)`;

        audioCtx.fillRect(
            i * (barWidth + barSpacing),
            height - barHeight,
            barWidth,
            barHeight
        );
    }
}

function modulateSimulation() {
    if (!isMicActive && !isSynthActive) return;

    // Bass affects speed of pattern evolution
    const speedMod = 1 + bassLevel * 2;

    // Mids affect color scheme cycling (shift hue)
    if (midLevel > 0.3) {
        // Add subtle color pulse effect
        const pulseIntensity = midLevel * 0.5;
        canvas.style.filter = `brightness(${1 + pulseIntensity}) saturate(${1 + pulseIntensity * 0.5})`;
    } else {
        canvas.style.filter = 'none';
    }

    // Highs can trigger small disturbances
    if (highLevel > 0.5 && Math.random() < 0.1) {
        // Add random seed based on high frequencies
        const w = CONFIG.width;
        const h = CONFIG.height;
        const x = Math.floor(Math.random() * w);
        const y = Math.floor(Math.random() * h);
        const radius = 2 + Math.floor(highLevel * 5);

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy <= radius * radius) {
                    const px = (x + dx + w) % w;
                    const py = (y + dy + h) % h;
                    const i = py * w + px;
                    gridA[i] = 0;
                    gridB[i] = 1;
                }
            }
        }
    }

    // Bass pulses can slightly shift parameters
    if (bassLevel > 0.6) {
        const bassShift = (bassLevel - 0.6) * 0.002;
        // Temporarily boost feed rate for more activity
        feed = Math.min(0.08, feed + bassShift * 0.1);
    }
}

// ===== Enhanced Animation Loop with Audio =====
function animate() {
    // Analyze audio if active
    if (isMicActive || isSynthActive) {
        analyzeAudio();
    }

    if (isPlaying) {
        // Audio-reactive speed
        let iterations = Math.max(1, Math.floor(speed * 2));
        if (isMicActive || isSynthActive) {
            iterations = Math.max(1, Math.floor(iterations * (1 + bassLevel)));
        }

        for (let i = 0; i < iterations; i++) {
            simulate();
        }
    }

    render();
    drawParameterMap();
    requestAnimationFrame(animate);
}

// ===== Setup Audio UI =====
function setupAudioUI() {
    document.getElementById('micBtn').onclick = startMicrophone;
    document.getElementById('musicBtn').onclick = startSynth;
}

// ===== Start =====
initGrid();
setupUI();
initAudio();
setupAudioUI();
drawParameterMap();
animate();
