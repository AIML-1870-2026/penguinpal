// Boids Mini-Lab - Simulation Engine (Neon Rainbow Rave Edition)

// ==================== Configuration ====================
const CONFIG = {
    separation: 1.5,
    alignment: 1.0,
    cohesion: 1.0,
    neighborRadius: 75,
    maxSpeed: 4,
    maxForce: 0.2,
    boidCount: 150,
    boundaryMode: 'wrap', // 'wrap' or 'bounce'
    predatorEnabled: false,
    obstaclesEnabled: false
};

// Global time for rainbow cycling
let globalTime = 0;
const RAINBOW_SPEED = 0.06; // Moderate color cycling

// Mouse interaction state
const mouse = {
    x: null,
    y: null,
    isAttracting: false,
    isRepelling: false
};

// Obstacles
const obstacles = [
    { x: 200, y: 200, radius: 40 },
    { x: 500, y: 300, radius: 50 },
    { x: 350, y: 450, radius: 35 }
];

// ==================== Predator Class ====================
class Predator {
    constructor(x, y) {
        this.position = new Vector(x, y);
        this.velocity = Vector.random2D().mult(2);
        this.maxSpeed = 3;
        this.size = 30;
        this.pulsePhase = 0;
    }

    update(boids, width, height) {
        // Find nearest boid to chase
        let nearest = null;
        let nearestDist = Infinity;

        for (const boid of boids) {
            const d = Vector.dist(this.position, boid.position);
            if (d < nearestDist && d < 300) {
                nearestDist = d;
                nearest = boid;
            }
        }

        if (nearest) {
            // Chase nearest boid
            const desired = Vector.sub(nearest.position, this.position);
            desired.setMag(this.maxSpeed);
            const steering = Vector.sub(desired, this.velocity);
            steering.limit(0.1);
            this.velocity.add(steering);
        }

        this.velocity.limit(this.maxSpeed);
        this.position.add(this.velocity);

        // Boundary wrap
        if (this.position.x < 0) this.position.x = width;
        if (this.position.x > width) this.position.x = 0;
        if (this.position.y < 0) this.position.y = height;
        if (this.position.y > height) this.position.y = 0;

        this.pulsePhase += 0.1;
    }

    draw(ctx) {
        const pulse = 1 + Math.sin(this.pulsePhase) * 0.15;
        const size = this.size * pulse;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        // Scary glow
        ctx.shadowColor = '#FF0000';
        ctx.shadowBlur = 25;

        // Draw skull-like predator
        ctx.fillStyle = '#220000';
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
        ctx.fill();

        // Evil eyes
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(-size * 0.3, -size * 0.1, size * 0.2, size * 0.25, 0, 0, Math.PI * 2);
        ctx.ellipse(size * 0.3, -size * 0.1, size * 0.2, size * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();

        // Red pupils
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(-size * 0.3, -size * 0.1, size * 0.08, 0, Math.PI * 2);
        ctx.arc(size * 0.3, -size * 0.1, size * 0.08, 0, Math.PI * 2);
        ctx.fill();

        // Angry mouth
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, size * 0.2, size * 0.35, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();

        ctx.restore();
    }
}

// Presets
const PRESETS = {
    schooling: {
        separation: 1.0,
        alignment: 2.5,
        cohesion: 1.5,
        neighborRadius: 100,
        maxSpeed: 4
    },
    chaotic: {
        separation: 2.0,
        alignment: 0.3,
        cohesion: 0.3,
        neighborRadius: 40,
        maxSpeed: 6
    },
    cluster: {
        separation: 1.5,
        alignment: 1.5,
        cohesion: 3.0,
        neighborRadius: 120,
        maxSpeed: 3
    }
};

// ==================== Vector Class ====================
class Vector {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }

    mult(n) {
        this.x *= n;
        this.y *= n;
        return this;
    }

    div(n) {
        if (n !== 0) {
            this.x /= n;
            this.y /= n;
        }
        return this;
    }

    mag() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    normalize() {
        const m = this.mag();
        if (m > 0) {
            this.div(m);
        }
        return this;
    }

    limit(max) {
        if (this.mag() > max) {
            this.normalize().mult(max);
        }
        return this;
    }

    setMag(mag) {
        this.normalize().mult(mag);
        return this;
    }

    copy() {
        return new Vector(this.x, this.y);
    }

    static sub(v1, v2) {
        return new Vector(v1.x - v2.x, v1.y - v2.y);
    }

    static dist(v1, v2) {
        return Math.sqrt((v1.x - v2.x) ** 2 + (v1.y - v2.y) ** 2);
    }

    static random2D() {
        const angle = Math.random() * Math.PI * 2;
        return new Vector(Math.cos(angle), Math.sin(angle));
    }
}

// ==================== Boid Class ====================
class Boid {
    constructor(x, y) {
        this.position = new Vector(x, y);
        this.velocity = Vector.random2D().mult(Math.random() * 2 + 2);
        this.acceleration = new Vector();
        this.neighborCount = 0;
    }

    // Apply force to acceleration
    applyForce(force) {
        this.acceleration.add(force);
    }

    // Separation: steer away from nearby boids
    separation(boids) {
        const steering = new Vector();
        let count = 0;
        const desiredSeparation = 25;

        for (const other of boids) {
            const d = Vector.dist(this.position, other.position);
            if (other !== this && d < desiredSeparation && d > 0) {
                const diff = Vector.sub(this.position, other.position);
                diff.normalize().div(d); // Weight by distance
                steering.add(diff);
                count++;
            }
        }

        if (count > 0) {
            steering.div(count);
            steering.setMag(CONFIG.maxSpeed);
            steering.sub(this.velocity);
            steering.limit(CONFIG.maxForce);
        }

        return steering;
    }

    // Alignment: steer towards average heading of neighbors
    alignment(boids) {
        const steering = new Vector();
        let count = 0;

        for (const other of boids) {
            const d = Vector.dist(this.position, other.position);
            if (other !== this && d < CONFIG.neighborRadius) {
                steering.add(other.velocity);
                count++;
            }
        }

        if (count > 0) {
            steering.div(count);
            steering.setMag(CONFIG.maxSpeed);
            steering.sub(this.velocity);
            steering.limit(CONFIG.maxForce);
        }

        return steering;
    }

    // Cohesion: steer towards center of mass of neighbors
    cohesion(boids) {
        const steering = new Vector();
        let count = 0;

        for (const other of boids) {
            const d = Vector.dist(this.position, other.position);
            if (other !== this && d < CONFIG.neighborRadius) {
                steering.add(other.position);
                count++;
            }
        }

        this.neighborCount = count;

        if (count > 0) {
            steering.div(count);
            return this.seek(steering);
        }

        return steering;
    }

    // Seek a target position
    seek(target) {
        const desired = Vector.sub(target, this.position);
        desired.setMag(CONFIG.maxSpeed);
        const steering = Vector.sub(desired, this.velocity);
        steering.limit(CONFIG.maxForce);
        return steering;
    }

    // Apply flocking behavior
    flock(boids, predator) {
        const sep = this.separation(boids).mult(CONFIG.separation);
        const ali = this.alignment(boids).mult(CONFIG.alignment);
        const coh = this.cohesion(boids).mult(CONFIG.cohesion);

        this.applyForce(sep);
        this.applyForce(ali);
        this.applyForce(coh);

        // Mouse interaction
        if (mouse.x !== null && mouse.y !== null) {
            const mousePos = new Vector(mouse.x, mouse.y);
            const d = Vector.dist(this.position, mousePos);

            if (d < 150) {
                if (mouse.isAttracting) {
                    const attract = this.seek(mousePos).mult(2);
                    this.applyForce(attract);
                } else if (mouse.isRepelling) {
                    const diff = Vector.sub(this.position, mousePos);
                    diff.normalize().mult(CONFIG.maxSpeed * 1.5);
                    diff.div(d / 50);
                    this.applyForce(diff);
                }
            }
        }

        // Flee from predator
        if (CONFIG.predatorEnabled && predator) {
            const d = Vector.dist(this.position, predator.position);
            if (d < 120) {
                const flee = Vector.sub(this.position, predator.position);
                flee.normalize().mult(CONFIG.maxSpeed * 2);
                flee.div(d / 30);
                this.applyForce(flee);
            }
        }

        // Avoid obstacles
        if (CONFIG.obstaclesEnabled) {
            for (const obs of obstacles) {
                const obsPos = new Vector(obs.x, obs.y);
                const d = Vector.dist(this.position, obsPos);
                const avoidDist = obs.radius + 40;

                if (d < avoidDist) {
                    const avoid = Vector.sub(this.position, obsPos);
                    avoid.normalize().mult(CONFIG.maxSpeed);
                    avoid.mult((avoidDist - d) / avoidDist * 3);
                    this.applyForce(avoid);
                }
            }
        }
    }

    // Update position
    update() {
        this.velocity.add(this.acceleration);
        this.velocity.limit(CONFIG.maxSpeed);
        this.position.add(this.velocity);
        this.acceleration.mult(0); // Reset acceleration
    }

    // Handle boundary behavior
    boundaries(width, height) {
        const margin = 25;

        if (CONFIG.boundaryMode === 'wrap') {
            if (this.position.x < 0) this.position.x = width;
            if (this.position.x > width) this.position.x = 0;
            if (this.position.y < 0) this.position.y = height;
            if (this.position.y > height) this.position.y = 0;
        } else {
            // Bounce mode
            if (this.position.x < margin) {
                this.position.x = margin;
                this.velocity.x *= -1;
            }
            if (this.position.x > width - margin) {
                this.position.x = width - margin;
                this.velocity.x *= -1;
            }
            if (this.position.y < margin) {
                this.position.y = margin;
                this.velocity.y *= -1;
            }
            if (this.position.y > height - margin) {
                this.position.y = height - margin;
                this.velocity.y *= -1;
            }
        }
    }

    // Draw the boid as a heart
    draw(ctx, boidIndex) {
        const size = 16;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        // Rainbow cycling - each boid has offset based on index
        const hue = (globalTime * 360 + boidIndex * 20) % 360;

        // Glow effect
        ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
        ctx.shadowBlur = 12;

        // Draw heart shape
        const s = size * 0.12;
        ctx.beginPath();
        ctx.moveTo(0, s * 3);
        ctx.bezierCurveTo(-s * 5, -s * 2, -s * 10, s * 2, 0, s * 10);
        ctx.moveTo(0, s * 3);
        ctx.bezierCurveTo(s * 5, -s * 2, s * 10, s * 2, 0, s * 10);

        ctx.fillStyle = `hsl(${hue}, 100%, 55%)`;
        ctx.fill();

        ctx.restore();
    }
}

// ==================== Simulation ====================
class Simulation {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.boids = [];
        this.predator = null;
        this.isPaused = false;
        this.lastTime = 0;
        this.frameCount = 0;
        this.fps = 60;
        this.fpsUpdateTime = 0;

        this.resize();
        this.init();
        this.setupMouseEvents();

        window.addEventListener('resize', () => this.resize());
    }

    setupMouseEvents() {
        const canvas = this.canvas;

        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
            mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);

            if (e.button === 0) mouse.isAttracting = true;
            if (e.button === 2) mouse.isRepelling = true;
        });

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
            mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
        });

        canvas.addEventListener('mouseup', () => {
            mouse.isAttracting = false;
            mouse.isRepelling = false;
        });

        canvas.addEventListener('mouseleave', () => {
            mouse.x = null;
            mouse.y = null;
            mouse.isAttracting = false;
            mouse.isRepelling = false;
        });

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    init() {
        this.boids = [];
        for (let i = 0; i < CONFIG.boidCount; i++) {
            const x = Math.random() * this.canvas.width;
            const y = Math.random() * this.canvas.height;
            this.boids.push(new Boid(x, y));
        }

        // Initialize predator
        this.predator = new Predator(this.canvas.width / 2, this.canvas.height / 2);

        // Position obstacles based on canvas size
        obstacles[0].x = this.canvas.width * 0.2;
        obstacles[0].y = this.canvas.height * 0.3;
        obstacles[1].x = this.canvas.width * 0.7;
        obstacles[1].y = this.canvas.height * 0.4;
        obstacles[2].x = this.canvas.width * 0.4;
        obstacles[2].y = this.canvas.height * 0.7;
    }

    updateBoidCount(count) {
        const diff = count - this.boids.length;

        if (diff > 0) {
            // Add boids
            for (let i = 0; i < diff; i++) {
                const x = Math.random() * this.canvas.width;
                const y = Math.random() * this.canvas.height;
                this.boids.push(new Boid(x, y));
            }
        } else if (diff < 0) {
            // Remove boids
            this.boids.splice(count);
        }
    }

    update() {
        for (const boid of this.boids) {
            boid.flock(this.boids, this.predator);
            boid.update();
            boid.boundaries(this.canvas.width, this.canvas.height);
        }

        // Update predator
        if (CONFIG.predatorEnabled && this.predator) {
            this.predator.update(this.boids, this.canvas.width, this.canvas.height);
        }
    }

    draw() {
        // Update global time for rainbow cycling
        globalTime += RAINBOW_SPEED;

        // Draw animated rave background
        this.drawRaveBackground();

        // Draw obstacles
        if (CONFIG.obstaclesEnabled) {
            this.drawObstacles();
        }

        // Draw boundary glow
        this.drawBoundaryGlow();

        // Draw boids with index for color offset
        for (let i = 0; i < this.boids.length; i++) {
            this.boids[i].draw(this.ctx, i);
        }

        // Draw predator
        if (CONFIG.predatorEnabled && this.predator) {
            this.predator.draw(this.ctx);
        }

        // Draw mouse indicator
        this.drawMouseIndicator();
    }

    drawObstacles() {
        const ctx = this.ctx;

        for (const obs of obstacles) {
            ctx.save();

            // Outer glow
            ctx.shadowColor = '#FF1493';
            ctx.shadowBlur = 20;

            // Gradient fill
            const gradient = ctx.createRadialGradient(obs.x, obs.y, 0, obs.x, obs.y, obs.radius);
            gradient.addColorStop(0, 'rgba(60, 20, 40, 0.9)');
            gradient.addColorStop(0.7, 'rgba(100, 30, 60, 0.8)');
            gradient.addColorStop(1, 'rgba(255, 20, 147, 0.6)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
            ctx.fill();

            // Inner ring
            ctx.strokeStyle = '#FF69B4';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(obs.x, obs.y, obs.radius * 0.6, 0, Math.PI * 2);
            ctx.stroke();

            ctx.restore();
        }
    }

    drawMouseIndicator() {
        if (mouse.x === null || mouse.y === null) return;
        if (!mouse.isAttracting && !mouse.isRepelling) return;

        const ctx = this.ctx;
        ctx.save();

        const color = mouse.isAttracting ? '#00FF00' : '#FF0000';
        const radius = 20 + Math.sin(globalTime * 5) * 5;

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;

        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner pulse
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, radius * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    drawRaveBackground() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const time = globalTime * 0.4;

        // Light overlay for slight trail effect
        ctx.fillStyle = 'rgba(60, 20, 40, 0.12)';
        ctx.fillRect(0, 0, w, h);

        // Bright base layer - vibrant pink/yellow gradient
        const baseGradient = ctx.createLinearGradient(0, 0, w, h);
        const t = Math.sin(time) * 0.5 + 0.5;
        baseGradient.addColorStop(0, `rgba(255, 50, 150, ${0.4 + t * 0.2})`);
        baseGradient.addColorStop(0.5, `rgba(255, 180, 50, ${0.3 + t * 0.15})`);
        baseGradient.addColorStop(1, `rgba(255, 100, 200, ${0.4 + t * 0.2})`);
        ctx.fillStyle = baseGradient;
        ctx.fillRect(0, 0, w, h);

        // Bright pulsing neon pink blob
        const x1 = w * 0.25 + Math.sin(time) * w * 0.15;
        const y1 = h * 0.3 + Math.cos(time * 0.7) * h * 0.15;
        const pinkIntensity = 0.6 + Math.sin(time * 2) * 0.2;
        const gradient1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, w * 0.5);
        gradient1.addColorStop(0, `rgba(255, 20, 147, ${pinkIntensity})`);
        gradient1.addColorStop(0.4, `rgba(255, 105, 180, ${pinkIntensity * 0.6})`);
        gradient1.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient1;
        ctx.fillRect(0, 0, w, h);

        // Bright pulsing neon yellow blob
        const x2 = w * 0.75 + Math.cos(time * 0.8) * w * 0.15;
        const y2 = h * 0.7 + Math.sin(time * 0.6) * h * 0.15;
        const yellowIntensity = 0.55 + Math.cos(time * 2) * 0.2;
        const gradient2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, w * 0.45);
        gradient2.addColorStop(0, `rgba(255, 255, 0, ${yellowIntensity})`);
        gradient2.addColorStop(0.4, `rgba(255, 200, 50, ${yellowIntensity * 0.6})`);
        gradient2.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient2;
        ctx.fillRect(0, 0, w, h);

        // Hot center glow
        const x3 = w * 0.5 + Math.sin(time * 0.5) * w * 0.1;
        const y3 = h * 0.5 + Math.cos(time * 0.6) * h * 0.1;
        const gradient3 = ctx.createRadialGradient(x3, y3, 0, x3, y3, w * 0.35);
        gradient3.addColorStop(0, 'rgba(255, 150, 200, 0.5)');
        gradient3.addColorStop(0.5, 'rgba(255, 220, 100, 0.3)');
        gradient3.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient3;
        ctx.fillRect(0, 0, w, h);
    }

    drawBoundaryGlow() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const glowSize = 4;

        // Pink and yellow alternating border
        const t = Math.sin(globalTime * 2) * 0.5 + 0.5; // 0 to 1 oscillation
        const r = Math.round(255);
        const g = Math.round(20 + t * 235); // 20 to 255 (pink to yellow)
        const b = Math.round(147 - t * 147); // 147 to 0 (pink to yellow)

        ctx.save();
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.6)`;
        ctx.lineWidth = glowSize;
        ctx.shadowColor = `rgb(${r}, ${g}, ${b})`;
        ctx.shadowBlur = 20;

        ctx.strokeRect(glowSize / 2, glowSize / 2, w - glowSize, h - glowSize);
        ctx.restore();
    }

    calculateMetrics() {
        let totalSpeed = 0;
        let totalNeighbors = 0;

        for (const boid of this.boids) {
            totalSpeed += boid.velocity.mag();
            totalNeighbors += boid.neighborCount;
        }

        return {
            avgSpeed: (totalSpeed / this.boids.length).toFixed(1),
            avgNeighbors: (totalNeighbors / this.boids.length).toFixed(1),
            boidCount: this.boids.length
        };
    }

    animate(timestamp) {
        // FPS calculation
        this.frameCount++;
        if (timestamp - this.fpsUpdateTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsUpdateTime = timestamp;
        }

        if (!this.isPaused) {
            this.update();
        }
        this.draw();

        // Update metrics display
        const metrics = this.calculateMetrics();
        document.getElementById('fps-value').textContent = this.fps;
        document.getElementById('boid-count-metric').textContent = metrics.boidCount;
        document.getElementById('avg-speed-value').textContent = metrics.avgSpeed;
        document.getElementById('avg-neighbors-value').textContent = metrics.avgNeighbors;

        requestAnimationFrame((t) => this.animate(t));
    }

    start() {
        requestAnimationFrame((t) => this.animate(t));
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }

    reset() {
        this.init();
    }
}

// ==================== UI Controller ====================
class UIController {
    constructor(simulation) {
        this.simulation = simulation;
        this.activePreset = null;
        this.setupControls();
        this.setupPresets();
        this.setupSimButtons();
        this.setupBoundaryToggle();
        this.setupFeatureToggles();
    }

    setupControls() {
        const controls = [
            { id: 'separation', config: 'separation' },
            { id: 'alignment', config: 'alignment' },
            { id: 'cohesion', config: 'cohesion' },
            { id: 'neighbor-radius', config: 'neighborRadius' },
            { id: 'max-speed', config: 'maxSpeed' },
            { id: 'boid-count', config: 'boidCount' }
        ];

        controls.forEach(({ id, config }) => {
            const slider = document.getElementById(id);
            const valueDisplay = document.getElementById(`${id}-value`);

            slider.value = CONFIG[config];
            valueDisplay.textContent = CONFIG[config];

            slider.addEventListener('input', () => {
                const value = parseFloat(slider.value);
                CONFIG[config] = value;
                valueDisplay.textContent = value;

                // Handle boid count changes
                if (config === 'boidCount') {
                    this.simulation.updateBoidCount(value);
                }

                // Clear active preset when manually adjusting
                this.clearActivePreset();
            });
        });
    }

    setupPresets() {
        const presetButtons = document.querySelectorAll('.preset-btn');

        presetButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const presetName = btn.dataset.preset;
                this.applyPreset(presetName);

                // Update active state
                presetButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activePreset = presetName;
            });
        });
    }

    applyPreset(name) {
        const preset = PRESETS[name];
        if (!preset) return;

        // Apply preset values
        Object.entries(preset).forEach(([key, value]) => {
            CONFIG[key] = value;

            // Update slider
            const sliderId = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            const slider = document.getElementById(sliderId);
            const valueDisplay = document.getElementById(`${sliderId}-value`);

            if (slider) {
                slider.value = value;
                valueDisplay.textContent = value;
            }
        });
    }

    clearActivePreset() {
        if (this.activePreset) {
            document.querySelectorAll('.preset-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            this.activePreset = null;
        }
    }

    setupSimButtons() {
        const pauseBtn = document.getElementById('pause-btn');
        const resetBtn = document.getElementById('reset-btn');

        pauseBtn.addEventListener('click', () => {
            const isPaused = this.simulation.togglePause();
            pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
            pauseBtn.classList.toggle('paused', isPaused);
        });

        resetBtn.addEventListener('click', () => {
            this.simulation.reset();
        });
    }

    setupBoundaryToggle() {
        const toggle = document.getElementById('boundary-mode');
        const labels = document.querySelectorAll('.toggle-label');

        toggle.addEventListener('change', () => {
            CONFIG.boundaryMode = toggle.checked ? 'bounce' : 'wrap';

            // Update label styling
            labels[0].style.color = toggle.checked ? '#B0B0B0' : '#39FF14';
            labels[0].style.textShadow = toggle.checked ? 'none' : '0 0 8px #39FF14';
            labels[1].style.color = toggle.checked ? '#FF00FF' : '#B0B0B0';
            labels[1].style.textShadow = toggle.checked ? '0 0 8px #FF00FF' : 'none';
        });
    }

    setupFeatureToggles() {
        const predatorToggle = document.getElementById('predator-toggle');
        const obstaclesToggle = document.getElementById('obstacles-toggle');

        if (predatorToggle) {
            predatorToggle.addEventListener('change', () => {
                CONFIG.predatorEnabled = predatorToggle.checked;
            });
        }

        if (obstaclesToggle) {
            obstaclesToggle.addEventListener('change', () => {
                CONFIG.obstaclesEnabled = obstaclesToggle.checked;
            });
        }
    }
}

// ==================== Initialize ====================
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('boids-canvas');
    const simulation = new Simulation(canvas);
    const ui = new UIController(simulation);

    simulation.start();
});
