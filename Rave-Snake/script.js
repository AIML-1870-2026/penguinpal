// Game Configuration
const CELL_SIZE = 20;
const GRID_WIDTH = 40;
const GRID_HEIGHT = 30;
const CANVAS_WIDTH = GRID_WIDTH * CELL_SIZE;
const CANVAS_HEIGHT = GRID_HEIGHT * CELL_SIZE;

// Neon Colors
const COLORS = {
    neonPink: '#ff00ff',
    neonBlue: '#00ffff',
    neonGreen: '#00ff00',
    neonYellow: '#ffff00',
    neonOrange: '#ff6600',
    neonPurple: '#9900ff',
    neonRed: '#ff0066',
    neonWhite: '#ffffff'
};

// Game State
let canvas, ctx;
let snake = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let food = [];
let score = 0;
let gameTime = 0;
let lastUpdate = 0;
let moveTimer = 0;
let moveInterval = 150;
let isPaused = false;
let isGameOver = false;
let useMouseControl = false;
let mousePos = { x: 400, y: 300 };
let highScore = localStorage.getItem('raveSnakeHighScore') || 0;
let currentMode = 'classic';
let backgroundHue = 0;
let pulsePhase = 0;
let beatPhase = 0;
let strobeIntensity = 0;
let screenShake = { x: 0, y: 0, intensity: 0 };

// Smooth snake path
let snakePath = [];
const PATH_RESOLUTION = 5;

// RAVE ELEMENTS
let laserBeams = [];
let pulsingOrbs = [];
let starField = [];

// Mode configurations
const MODES = {
    classic: { name: 'Classic', goal: 'Reach 30 segments', targetLength: 30 },
    timeTrial: { name: 'Time Trial', goal: 'Survive 2 minutes', targetTime: 120 },
    scoreRush: { name: 'Score Rush', goal: 'Reach 500 points', targetScore: 500 },
    endless: { name: 'Endless', goal: 'How long can you survive?' },
    speedDemon: { name: 'Speed Demon', goal: 'Reach 30 segments (speed increases!)', targetLength: 30 }
};

function init() {
    canvas = document.getElementById('gameCanvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    ctx = canvas.getContext('2d');

    initRaveBackground();

    document.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', () => { if (!isGameOver) useMouseControl = true; updateControlToggle(); });
    document.getElementById('controlToggle').addEventListener('click', toggleControl);
}

function initRaveBackground() {
    // Laser beams - reduced for performance
    for (let i = 0; i < 6; i++) {
        laserBeams.push({
            x: Math.random() * CANVAS_WIDTH,
            angle: Math.random() * Math.PI * 2,
            speed: (Math.random() - 0.5) * 3,
            hue: Math.random() * 360,
            width: Math.random() * 4 + 2,
            length: CANVAS_HEIGHT * (0.5 + Math.random())
        });
    }

    // Pulsing orbs - reduced for performance
    for (let i = 0; i < 4; i++) {
        pulsingOrbs.push({
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * CANVAS_HEIGHT,
            baseRadius: 80 + Math.random() * 150,
            phase: Math.random() * Math.PI * 2,
            hue: Math.random() * 360,
            speedX: (Math.random() - 0.5) * 60,
            speedY: (Math.random() - 0.5) * 60
        });
    }

    // Star field - reduced for performance
    for (let i = 0; i < 50; i++) {
        starField.push({
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * CANVAS_HEIGHT,
            size: Math.random() * 3 + 1,
            twinklePhase: Math.random() * Math.PI * 2,
            twinkleSpeed: 3 + Math.random() * 5,
            hue: Math.random() * 360
        });
    }
}

function handleKeyDown(e) {
    if (e.code === 'Space') {
        e.preventDefault();
        togglePause();
        return;
    }
    if (e.code === 'KeyC') {
        toggleControl();
        return;
    }
    if (isPaused || isGameOver || useMouseControl) return;

    const keyMap = {
        'ArrowUp': { x: 0, y: -1 }, 'KeyW': { x: 0, y: -1 },
        'ArrowDown': { x: 0, y: 1 }, 'KeyS': { x: 0, y: 1 },
        'ArrowLeft': { x: -1, y: 0 }, 'KeyA': { x: -1, y: 0 },
        'ArrowRight': { x: 1, y: 0 }, 'KeyD': { x: 1, y: 0 }
    };

    if (keyMap[e.code]) {
        e.preventDefault();
        const newDir = keyMap[e.code];
        if (newDir.x !== -direction.x || newDir.y !== -direction.y) {
            nextDirection = newDir;
        }
    }
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mousePos.x = e.clientX - rect.left;
    mousePos.y = e.clientY - rect.top;
}

function toggleControl() {
    useMouseControl = !useMouseControl;
    updateControlToggle();
}

function updateControlToggle() {
    document.getElementById('controlToggle').textContent =
        `Controls: ${useMouseControl ? 'Mouse' : 'Keyboard'}`;
}

function togglePause() {
    if (isGameOver) return;
    isPaused = !isPaused;
    document.getElementById('pauseIndicator').classList.toggle('visible', isPaused);
    if (!isPaused) {
        lastUpdate = performance.now();
        requestAnimationFrame(update);
    }
}

function startGame() {
    currentMode = document.getElementById('gameMode').value;
    const mode = MODES[currentMode];

    snake = [
        { x: 5, y: Math.floor(GRID_HEIGHT / 2) },
        { x: 4, y: Math.floor(GRID_HEIGHT / 2) },
        { x: 3, y: Math.floor(GRID_HEIGHT / 2) }
    ];

    initSnakePath();

    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    food = [];
    score = 0;
    gameTime = 0;
    moveTimer = 0;
    moveInterval = 150;
    isPaused = false;
    isGameOver = false;
    beatPhase = 0;
    strobeIntensity = 0;

    for (let i = 0; i < 3; i++) spawnFood();

    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('objective').textContent = `${mode.name}: ${mode.goal}`;
    updateHUD();

    lastUpdate = performance.now();
    requestAnimationFrame(update);
}

function initSnakePath() {
    snakePath = [];
    for (let i = 0; i < snake.length; i++) {
        const x = snake[i].x * CELL_SIZE + CELL_SIZE / 2;
        const y = snake[i].y * CELL_SIZE + CELL_SIZE / 2;
        for (let j = 0; j < PATH_RESOLUTION; j++) {
            snakePath.push({ x, y });
        }
    }
}

function showMenu() {
    document.getElementById('mainMenu').classList.remove('hidden');
    document.getElementById('gameOver').classList.add('hidden');
}

function spawnFood() {
    let pos;
    let attempts = 0;
    do {
        pos = {
            x: Math.floor(Math.random() * GRID_WIDTH),
            y: Math.floor(Math.random() * GRID_HEIGHT),
            color: Object.values(COLORS)[Math.floor(Math.random() * 6)],
            points: Math.random() < 0.2 ? 20 : 10,
            rotation: 0,
            pulseOffset: Math.random() * Math.PI * 2,
            hueShift: Math.random() * 360
        };
        attempts++;
    } while (attempts < 100 && isOccupied(pos.x, pos.y));

    if (attempts < 100) food.push(pos);
}

function isOccupied(x, y) {
    if (snake.some(s => s.x === x && s.y === y)) return true;
    if (food.some(f => f.x === x && f.y === y)) return true;
    return false;
}

function update(timestamp) {
    if (isGameOver) return;
    if (isPaused) return;

    const deltaTime = Math.min((timestamp - lastUpdate) / 1000, 0.1);
    lastUpdate = timestamp;

    gameTime += deltaTime;
    backgroundHue = (backgroundHue + 80 * deltaTime) % 360; // FASTER color cycling
    pulsePhase += deltaTime * 8;
    beatPhase += deltaTime * 15; // FASTER beat

    strobeIntensity = Math.max(0, strobeIntensity - deltaTime * 2);

    // Screen shake decay
    screenShake.intensity *= 0.9;
    screenShake.x = (Math.random() - 0.5) * screenShake.intensity;
    screenShake.y = (Math.random() - 0.5) * screenShake.intensity;

    updateRaveBackground(deltaTime);

    moveTimer += deltaTime * 1000;
    if (moveTimer >= moveInterval) {
        moveTimer = 0;
        moveSnake();
    }

    updateSnakePath(deltaTime);

    food.forEach(f => {
        f.rotation += deltaTime * 6;
        f.hueShift = (f.hueShift + deltaTime * 120) % 360;
    });

    if (currentMode === 'speedDemon' && snake.length > 3) {
        moveInterval = Math.max(50, 150 - (snake.length - 3) * 5);
    }

    checkWinCondition();
    updateHUD();
    render();

    requestAnimationFrame(update);
}

function updateRaveBackground(deltaTime) {
    // Laser beams - more chaotic movement
    laserBeams.forEach(beam => {
        beam.angle += beam.speed * deltaTime;
        beam.hue = (beam.hue + 100 * deltaTime) % 360;
        beam.x += Math.sin(beatPhase * 0.5 + beam.angle) * 80 * deltaTime;
        if (beam.x < -50) beam.x = CANVAS_WIDTH + 50;
        if (beam.x > CANVAS_WIDTH + 50) beam.x = -50;
    });

    // Pulsing orbs
    pulsingOrbs.forEach(orb => {
        orb.phase += deltaTime * 5;
        orb.hue = (orb.hue + 50 * deltaTime) % 360;
        orb.x += orb.speedX * deltaTime;
        orb.y += orb.speedY * deltaTime;

        if (orb.x < 0 || orb.x > CANVAS_WIDTH) orb.speedX *= -1;
        if (orb.y < 0 || orb.y > CANVAS_HEIGHT) orb.speedY *= -1;
        orb.x = Math.max(0, Math.min(CANVAS_WIDTH, orb.x));
        orb.y = Math.max(0, Math.min(CANVAS_HEIGHT, orb.y));
    });

    // Star field twinkle
    starField.forEach(star => {
        star.twinklePhase += star.twinkleSpeed * deltaTime;
        star.hue = (star.hue + 30 * deltaTime) % 360;
    });
}

function updateSnakePath(deltaTime) {
    if (snake.length === 0) return;

    const targetX = snake[0].x * CELL_SIZE + CELL_SIZE / 2;
    const targetY = snake[0].y * CELL_SIZE + CELL_SIZE / 2;
    const lerpSpeed = 20;

    if (snakePath.length > 0) {
        snakePath[0].x += (targetX - snakePath[0].x) * lerpSpeed * deltaTime;
        snakePath[0].y += (targetY - snakePath[0].y) * lerpSpeed * deltaTime;
    }

    for (let i = 1; i < snakePath.length; i++) {
        const prev = snakePath[i - 1];
        const curr = snakePath[i];
        const followSpeed = 25;
        curr.x += (prev.x - curr.x) * followSpeed * deltaTime;
        curr.y += (prev.y - curr.y) * followSpeed * deltaTime;
    }

    const targetLength = snake.length * PATH_RESOLUTION;
    while (snakePath.length < targetLength) {
        const last = snakePath[snakePath.length - 1];
        snakePath.push({ x: last.x, y: last.y });
    }
    while (snakePath.length > targetLength) {
        snakePath.pop();
    }
}

function moveSnake() {
    if (useMouseControl && snake.length > 0) {
        const head = snake[0];
        const headPixelX = head.x * CELL_SIZE + CELL_SIZE / 2;
        const headPixelY = head.y * CELL_SIZE + CELL_SIZE / 2;
        const dx = mousePos.x - headPixelX;
        const dy = mousePos.y - headPixelY;

        if (Math.abs(dx) > Math.abs(dy)) {
            nextDirection = { x: dx > 0 ? 1 : -1, y: 0 };
        } else {
            nextDirection = { x: 0, y: dy > 0 ? 1 : -1 };
        }

        if (nextDirection.x === -direction.x && nextDirection.y === -direction.y) {
            nextDirection = direction;
        }
    }

    direction = nextDirection;
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

    if (head.x < 0 || head.x >= GRID_WIDTH || head.y < 0 || head.y >= GRID_HEIGHT) {
        endGame();
        return;
    }

    if (snake.some(s => s.x === head.x && s.y === head.y)) {
        endGame();
        return;
    }

    snake.unshift(head);

    const headX = snakePath[0]?.x || head.x * CELL_SIZE + CELL_SIZE / 2;
    const headY = snakePath[0]?.y || head.y * CELL_SIZE + CELL_SIZE / 2;
    for (let i = 0; i < PATH_RESOLUTION; i++) {
        snakePath.unshift({ x: headX, y: headY });
    }

    const foodIndex = food.findIndex(f => f.x === head.x && f.y === head.y);
    if (foodIndex !== -1) {
        const eaten = food.splice(foodIndex, 1)[0];
        score += eaten.points;
        strobeIntensity = 1.5; // BIGGER flash
        screenShake.intensity = 15; // Screen shake!

        spawnFood();
    } else {
        snake.pop();
        for (let i = 0; i < PATH_RESOLUTION; i++) {
            snakePath.pop();
        }
    }
}

function checkWinCondition() {
    const mode = MODES[currentMode];
    let won = false;

    if (currentMode === 'classic' || currentMode === 'speedDemon') {
        if (snake.length >= mode.targetLength) won = true;
    } else if (currentMode === 'timeTrial') {
        if (gameTime >= mode.targetTime) won = true;
    } else if (currentMode === 'scoreRush') {
        if (score >= mode.targetScore) won = true;
    }

    if (won) endGame(true);
}

function updateHUD() {
    document.getElementById('score').textContent = score;
    document.getElementById('length').textContent = snake.length;
    const minutes = Math.floor(gameTime / 60);
    const seconds = Math.floor(gameTime % 60);
    document.getElementById('time').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function render() {
    ctx.save();
    ctx.translate(screenShake.x, screenShake.y);

    // Animated neon gradient background
    const gradient = ctx.createRadialGradient(
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0,
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, Math.max(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.7
    );
    gradient.addColorStop(0, `hsl(${backgroundHue}, 100%, 50%)`);
    gradient.addColorStop(0.5, `hsl(${(backgroundHue + 60) % 360}, 100%, 45%)`);
    gradient.addColorStop(1, `hsl(${(backgroundHue + 120) % 360}, 100%, 40%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(-10, -10, CANVAS_WIDTH + 20, CANVAS_HEIGHT + 20);

    // FULL RAVE BACKGROUND
    drawRaveBackground();

    // Food
    drawFood();

    // Snake
    drawSmoothSnake();

    // INTENSE strobe overlay
    if (strobeIntensity > 0) {
        const strobeHue = (backgroundHue + 180) % 360;
        ctx.fillStyle = `hsla(${strobeHue}, 100%, 50%, ${strobeIntensity * 0.3})`;
        ctx.fillRect(-10, -10, CANVAS_WIDTH + 20, CANVAS_HEIGHT + 20);
        ctx.fillStyle = `rgba(255, 255, 255, ${strobeIntensity * 0.2})`;
        ctx.fillRect(-10, -10, CANVAS_WIDTH + 20, CANVAS_HEIGHT + 20);
    }

    // Constant beat pulse - ALWAYS pulsing
    const beatPulse = Math.sin(beatPhase) * 0.5 + 0.5;
    const beatPulse2 = Math.sin(beatPhase * 1.5) * 0.5 + 0.5;
    ctx.fillStyle = `hsla(${backgroundHue}, 100%, 50%, ${beatPulse * 0.08})`;
    ctx.fillRect(-10, -10, CANVAS_WIDTH + 20, CANVAS_HEIGHT + 20);
    ctx.fillStyle = `hsla(${(backgroundHue + 180) % 360}, 100%, 50%, ${beatPulse2 * 0.05})`;
    ctx.fillRect(-10, -10, CANVAS_WIDTH + 20, CANVAS_HEIGHT + 20);

    // Border glow
    drawBorderGlow();

    ctx.restore();
}

function drawRaveBackground() {
    // Star field
    starField.forEach(star => {
        const twinkle = Math.sin(star.twinklePhase) * 0.5 + 0.5;
        ctx.fillStyle = `hsla(${star.hue}, 100%, 80%, ${twinkle * 0.8})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = `hsl(${star.hue}, 100%, 50%)`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * twinkle, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Pulsing orbs
    pulsingOrbs.forEach(orb => {
        const pulse = Math.sin(orb.phase) * 0.5 + 0.5;
        const radius = orb.baseRadius * (0.6 + pulse * 0.6);

        const gradient = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, radius);
        gradient.addColorStop(0, `hsla(${orb.hue}, 100%, 70%, 0.5)`);
        gradient.addColorStop(0.3, `hsla(${orb.hue}, 100%, 60%, 0.3)`);
        gradient.addColorStop(0.6, `hsla(${orb.hue}, 100%, 50%, 0.15)`);
        gradient.addColorStop(1, `hsla(${orb.hue}, 100%, 40%, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, radius, 0, Math.PI * 2);
        ctx.fill();
    });

    // Laser beams
    laserBeams.forEach(beam => {
        ctx.save();
        ctx.translate(beam.x, CANVAS_HEIGHT / 2);
        ctx.rotate(beam.angle);

        const gradient = ctx.createLinearGradient(0, -beam.length, 0, beam.length);
        gradient.addColorStop(0, `hsla(${beam.hue}, 100%, 50%, 0)`);
        gradient.addColorStop(0.3, `hsla(${beam.hue}, 100%, 70%, 0.7)`);
        gradient.addColorStop(0.5, `hsla(${beam.hue}, 100%, 95%, 1)`);
        gradient.addColorStop(0.7, `hsla(${beam.hue}, 100%, 70%, 0.7)`);
        gradient.addColorStop(1, `hsla(${beam.hue}, 100%, 50%, 0)`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = beam.width;
        ctx.shadowBlur = 30;
        ctx.shadowColor = `hsl(${beam.hue}, 100%, 50%)`;

        ctx.beginPath();
        ctx.moveTo(0, -beam.length);
        ctx.lineTo(0, beam.length);
        ctx.stroke();

        ctx.restore();
    });
    ctx.shadowBlur = 0;

    // Grid with pulse
    const gridPulse = Math.sin(pulsePhase * 2) * 0.5 + 0.5;
    ctx.strokeStyle = `hsla(${backgroundHue}, 100%, 50%, ${0.1 + gridPulse * 0.1})`;
    ctx.lineWidth = 1;

    for (let x = 0; x <= CANVAS_WIDTH; x += CELL_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y += CELL_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
    }
}

function drawBorderGlow() {
    const pulse = Math.sin(pulsePhase * 3) * 0.5 + 0.5;
    const borderWidth = 8;

    // Top
    let gradient = ctx.createLinearGradient(0, 0, 0, borderWidth * 3);
    gradient.addColorStop(0, `hsla(${backgroundHue}, 100%, 50%, ${0.5 + pulse * 0.5})`);
    gradient.addColorStop(1, `hsla(${backgroundHue}, 100%, 50%, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, borderWidth * 3);

    // Bottom
    gradient = ctx.createLinearGradient(0, CANVAS_HEIGHT, 0, CANVAS_HEIGHT - borderWidth * 3);
    gradient.addColorStop(0, `hsla(${(backgroundHue + 90) % 360}, 100%, 50%, ${0.5 + pulse * 0.5})`);
    gradient.addColorStop(1, `hsla(${(backgroundHue + 90) % 360}, 100%, 50%, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, CANVAS_HEIGHT - borderWidth * 3, CANVAS_WIDTH, borderWidth * 3);

    // Left
    gradient = ctx.createLinearGradient(0, 0, borderWidth * 3, 0);
    gradient.addColorStop(0, `hsla(${(backgroundHue + 180) % 360}, 100%, 50%, ${0.5 + pulse * 0.5})`);
    gradient.addColorStop(1, `hsla(${(backgroundHue + 180) % 360}, 100%, 50%, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, borderWidth * 3, CANVAS_HEIGHT);

    // Right
    gradient = ctx.createLinearGradient(CANVAS_WIDTH, 0, CANVAS_WIDTH - borderWidth * 3, 0);
    gradient.addColorStop(0, `hsla(${(backgroundHue + 270) % 360}, 100%, 50%, ${0.5 + pulse * 0.5})`);
    gradient.addColorStop(1, `hsla(${(backgroundHue + 270) % 360}, 100%, 50%, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(CANVAS_WIDTH - borderWidth * 3, 0, borderWidth * 3, CANVAS_HEIGHT);
}

function drawSmoothSnake() {
    if (snake.length === 0) return;

    // Draw segments from tail to head
    for (let i = snake.length - 1; i >= 0; i--) {
        const segment = snake[i];
        const x = segment.x * CELL_SIZE + CELL_SIZE / 2;
        const y = segment.y * CELL_SIZE + CELL_SIZE / 2;
        const segmentSize = CELL_SIZE - 2;
        const isHead = i === 0;

        // Calculate hue for this segment (rainbow effect)
        const hue = (backgroundHue + i * 15) % 360;
        const pulse = Math.sin(pulsePhase + i * 0.5) * 3;

        // Outer glow - optimized
        for (let glow = 2; glow >= 1; glow--) {
            ctx.shadowBlur = 40 + glow * 15;
            ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
            ctx.fillStyle = `hsla(${hue}, 100%, 50%, ${0.15 / glow})`;
            ctx.beginPath();
            ctx.arc(x, y, segmentSize / 2 + glow * 6 + pulse, 0, Math.PI * 2);
            ctx.fill();
        }

        // Main segment body with gradient
        ctx.shadowBlur = 40;
        ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, segmentSize / 2);
        gradient.addColorStop(0, `hsl(${hue}, 100%, 95%)`);
        gradient.addColorStop(0.3, `hsl(${hue}, 100%, 80%)`);
        gradient.addColorStop(0.6, `hsl(${hue}, 100%, 60%)`);
        gradient.addColorStop(1, `hsl(${hue}, 100%, 45%)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, segmentSize / 2 + pulse / 2, 0, Math.PI * 2);
        ctx.fill();

        // Bright neon ring
        ctx.strokeStyle = `hsl(${hue}, 100%, 80%)`;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 20;
        ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;
        ctx.beginPath();
        ctx.arc(x, y, segmentSize / 2 - 2 + pulse / 2, 0, Math.PI * 2);
        ctx.stroke();

        // Inner white hot core
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#fff';
        const innerGradient = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, segmentSize / 4);
        innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        innerGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
        innerGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = innerGradient;
        ctx.beginPath();
        ctx.arc(x - 2, y - 2, segmentSize / 3, 0, Math.PI * 2);
        ctx.fill();

        // Draw eyes on head
        if (isHead) {
            drawSnakeEyes(x, y);
        }
    }

    ctx.shadowBlur = 0;
}

function drawSnakeEyes(x, y) {
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#fff';
    ctx.fillStyle = '#fff';

    const eyeOffset = 5;
    const eyeSize = 4;
    const pupilSize = 2;

    let eye1X, eye1Y, eye2X, eye2Y;

    if (direction.x === 1) {
        eye1X = x + 4; eye1Y = y - eyeOffset;
        eye2X = x + 4; eye2Y = y + eyeOffset;
    } else if (direction.x === -1) {
        eye1X = x - 4; eye1Y = y - eyeOffset;
        eye2X = x - 4; eye2Y = y + eyeOffset;
    } else if (direction.y === 1) {
        eye1X = x - eyeOffset; eye1Y = y + 4;
        eye2X = x + eyeOffset; eye2Y = y + 4;
    } else {
        eye1X = x - eyeOffset; eye1Y = y - 4;
        eye2X = x + eyeOffset; eye2Y = y - 4;
    }

    // Glowing eye whites
    ctx.beginPath();
    ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
    ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    // Dark pupils
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(eye1X + direction.x * 1.5, eye1Y + direction.y * 1.5, pupilSize, 0, Math.PI * 2);
    ctx.arc(eye2X + direction.x * 1.5, eye2Y + direction.y * 1.5, pupilSize, 0, Math.PI * 2);
    ctx.fill();
}

function drawFood() {
    food.forEach(f => {
        const x = f.x * CELL_SIZE + CELL_SIZE / 2;
        const y = f.y * CELL_SIZE + CELL_SIZE / 2;
        const baseSize = CELL_SIZE / 2;
        const pulse = Math.sin(pulsePhase * 3 + f.pulseOffset) * 4 + baseSize;
        const hue = f.hueShift;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(f.rotation);

        ctx.shadowBlur = 40;
        ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;

        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, pulse);
        gradient.addColorStop(0, `hsl(${hue}, 100%, 95%)`);
        gradient.addColorStop(0.4, `hsl(${hue}, 100%, 70%)`);
        gradient.addColorStop(1, `hsl(${hue}, 100%, 45%)`);

        ctx.fillStyle = gradient;

        if (f.points > 10) {
            drawStar(0, 0, 6, pulse, pulse / 2);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, pulse, 0, Math.PI * 2);
            ctx.fill();
        }

        // Inner bright core
        ctx.shadowBlur = 0;
        ctx.fillStyle = `hsla(${hue}, 100%, 100%, 0.9)`;
        ctx.beginPath();
        ctx.arc(0, 0, pulse * 0.35, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    });
    ctx.shadowBlur = 0;
}

function drawStar(cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
        rot += step;
        ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
}

function endGame(won = false) {
    isGameOver = true;
    screenShake.intensity = 50; // Big shake on death

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('raveSnakeHighScore', highScore);
        document.getElementById('newRecord').style.display = 'block';
    } else {
        document.getElementById('newRecord').style.display = 'none';
    }

    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalLength').textContent = snake.length;
    const minutes = Math.floor(gameTime / 60);
    const seconds = Math.floor(gameTime % 60);
    document.getElementById('finalTime').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const status = document.getElementById('objectiveStatus');
    if (won) {
        status.innerHTML = '<span style="color: #00ff00;">OBJECTIVE COMPLETE!</span>';
    } else {
        status.innerHTML = '<span style="color: #ff0066;">Objective not reached</span>';
    }

    document.getElementById('gameOver').classList.remove('hidden');
}

window.onload = init;
