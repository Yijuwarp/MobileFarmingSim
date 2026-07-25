/* ==========================================================================
   FARM EMPIRE - Game Engine, Canvas Renderer, Particle System & Lighting
   ========================================================================== */

class AssetManager {
    constructor() {
        this.assets = {};
        this.loadedCount = 0;
        this.totalCount = 0;
    }

    loadImages() {
        const manifest = {
            char: 'assets/sprout_lands/Basic Charakter Spritesheet.png',
            house: 'assets/sprout_lands/Wooden House.png',
            plants: 'assets/sprout_lands/Basic Plants.png',
            grass: 'assets/sprout_lands/Grass.png',
            dirt: 'assets/sprout_lands/Dirt.png',
            paths: 'assets/sprout_lands/Paths.png',
            fences: 'assets/sprout_lands/Fences.png',
            furniture: 'assets/sprout_lands/Basic Furniture.png',
            chest: 'assets/sprout_lands/Chest.png',
            corn: 'assets/sprout_lands/Corn.png',
            tomato: 'assets/sprout_lands/Tomato.png'
        };

        this.totalCount = Object.keys(manifest).length;

        for (const [key, src] of Object.entries(manifest)) {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                this.loadedCount++;
            };
            this.assets[key] = img;
        }
    }

    get(key) {
        return this.assets[key];
    }
}

const assets = new AssetManager();
assets.loadImages();

/* Particle class for visual feedback (money sparks, exhaust smoke, leaf bursts) */
class Particle {
    constructor(x, y, vx, vy, color, size, life, shape = 'circle') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.maxLife = life;
        this.life = life;
        this.shape = shape; // 'circle', 'coin', 'leaf', 'smoke'
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.shape === 'smoke') {
            this.size += dt * 8; // Smoke expands
            this.vy -= dt * 10; // Smoke drifts upward
        }
        this.life -= dt;
    }

    draw(ctx) {
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;

        if (this.shape === 'smoke') {
            ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.shape === 'coin') {
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else if (this.shape === 'leaf') {
            ctx.fillStyle = '#34d399';
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.size, this.size * 0.5, Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.inputDir = { x: 0, y: 0 };
        this.keys = {};
        this.particles = [];
        this.ambientWildlife = [];
        this.routeHelpers = [];
        this.customers = [];

        this.camera = { x: 0, y: 0 };
        this.zoom = 1.45; // Zoomed in camera for crisp arcade view
        this.dayTime = 0; // Day/Night ambient shift

        this.initCanvas();
        this.initInput();
        this.initAmbientWildlife();
    }

    initCanvas() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    initInput() {
        // Keyboard Handlers
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            this.updateKeyboardInput();
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            this.updateKeyboardInput();
        });

        // Mouse Drag / Touch Steering
        let isPointerDown = false;
        let startX = 0;
        let startY = 0;

        const handlePointerStart = (px, py) => {
            isPointerDown = true;
            startX = px;
            startY = py;
        };

        const handlePointerMove = (px, py) => {
            if (!isPointerDown) return;
            const dx = px - startX;
            const dy = py - startY;
            const dist = Math.hypot(dx, dy);
            if (dist > 10) {
                this.inputDir.x = dx / dist;
                this.inputDir.y = dy / dist;
            }
        };

        const handlePointerEnd = () => {
            isPointerDown = false;
            if (!this.isKeyboardActive()) {
                this.inputDir.x = 0;
                this.inputDir.y = 0;
            }
        };

        window.addEventListener('mousedown', (e) => handlePointerStart(e.clientX, e.clientY));
        window.addEventListener('mousemove', (e) => handlePointerMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', handlePointerEnd);

        window.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) handlePointerStart(e.touches[0].clientX, e.touches[0].clientY);
        });
        window.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
        });
        window.addEventListener('touchend', handlePointerEnd);
    }

    isKeyboardActive() {
        return this.keys['KeyW'] || this.keys['KeyS'] || this.keys['KeyA'] || this.keys['KeyD'] ||
               this.keys['ArrowUp'] || this.keys['ArrowDown'] || this.keys['ArrowLeft'] || this.keys['ArrowRight'];
    }

    updateKeyboardInput() {
        let dx = 0;
        let dy = 0;

        if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;

        this.inputDir.x = dx;
        this.inputDir.y = dy;
    }

    initAmbientWildlife() {
        for (let i = 0; i < 15; i++) {
            this.ambientWildlife.push({
                x: 100 + Math.random() * 1300,
                y: 100 + Math.random() * 800,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.5) * 20,
                wingTimer: Math.random() * Math.PI * 2,
                color: i % 2 === 0 ? '#fef08a' : '#38bdf8'
            });
        }
    }

    addParticle(particle) {
        this.particles.push(particle);
    }

    spawnMoneySparks(x, y, count = 6) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
            const speed = 40 + Math.random() * 60;
            this.addParticle(new Particle(
                x, y,
                Math.cos(angle) * speed, Math.sin(angle) * speed - 30,
                '#fbbf24', 4, 0.6, 'coin'
            ));
        }
    }

    spawnExhaustSmoke(x, y) {
        this.addParticle(new Particle(
            x, y,
            (Math.random() - 0.5) * 15, -20 - Math.random() * 15,
            '#94a3b8', 4, 0.7, 'smoke'
        ));
    }

    spawnHarvestLeaves(x, y, count = 4) {
        for (let i = 0; i < count; i++) {
            this.addParticle(new Particle(
                x, y,
                (Math.random() - 0.5) * 50, -40 - Math.random() * 30,
                '#34d399', 3, 0.5, 'leaf'
            ));
        }
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update(dt);
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update ambient butterflies
        this.dayTime += dt * 0.05;
        this.ambientWildlife.forEach(w => {
            w.x += w.vx * dt;
            w.y += w.vy * dt;
            w.wingTimer += dt * 10;
            if (w.x < 100 || w.x > 1400) w.vx *= -1;
            if (w.y < 100 || w.y > 900) w.vy *= -1;
        });
    }

    updateCamera(playerX, playerY) {
        // Smooth camera follow centered with zoom scaling
        const targetX = playerX - (this.width / (2 * this.zoom));
        const targetY = playerY - (this.height / (2 * this.zoom));
        this.camera.x += (targetX - this.camera.x) * 0.1;
        this.camera.y += (targetY - this.camera.y) * 0.1;
    }

    drawFarmBackground() {
        // Pixel-Art Crisp Scaling
        this.ctx.imageSmoothingEnabled = false;

        const sprGrass = assets.get('grass');
        const sprPaths = assets.get('paths');
        const sprFences = assets.get('fences');

        this.ctx.save();
        this.ctx.scale(this.zoom, this.zoom);
        this.ctx.translate(-this.camera.x, -this.camera.y);

        // 1. Render Pixel Art Top-Down Basic Dark Emerald Grass Grid
        const tileSize = 48; // Scaled 3x from 16x16
        const scaledW = this.width / this.zoom;
        const scaledH = this.height / this.zoom;

        const startTileX = Math.floor(this.camera.x / tileSize) * tileSize - tileSize;
        const endTileX = this.camera.x + scaledW + tileSize * 2;
        const startTileY = Math.floor(this.camera.y / tileSize) * tileSize - tileSize;
        const endTileY = this.camera.y + scaledH + tileSize * 2;

        for (let x = startTileX; x < endTileX; x += tileSize) {
            for (let y = startTileY; y < endTileY; y += tileSize) {
                if (sprGrass && sprGrass.complete) {
                    this.ctx.drawImage(sprGrass, 0, 0, 16, 16, x, y, tileSize, tileSize);
                } else {
                    // Rich Pixel Art Top-Down Dark Emerald Terrain
                    const tileVariation = (Math.abs(Math.sin(x * 12.5 + y * 7.2)) * 100) % 3;
                    if (tileVariation < 1) this.ctx.fillStyle = '#2e5c1e';
                    else if (tileVariation < 2) this.ctx.fillStyle = '#346622';
                    else this.ctx.fillStyle = '#285019';
                    
                    this.ctx.fillRect(x, y, tileSize, tileSize);

                    // Decorative grass tuft details
                    if ((x + y) % 96 === 0) {
                        this.ctx.fillStyle = '#4a8533';
                        this.ctx.fillRect(x + 12, y + 14, 4, 10);
                        this.ctx.fillRect(x + 18, y + 10, 4, 14);
                        this.ctx.fillRect(x + 24, y + 16, 4, 8);
                    }
                }
            }
        }

        // 2. Render Dirt Paths with Cobblestone Border Trim
        const pathCoords = [
            { x: 150, y: 320, w: 1200, h: 45 },
            { x: 730, y: 100, w: 45, h: 800 },
            { x: 230, y: 320, w: 40, h: 200 },
            { x: 1230, y: 320, w: 40, h: 200 }
        ];

        pathCoords.forEach(p => {
            if (sprPaths && sprPaths.complete) {
                for (let px = p.x; px < p.x + p.w; px += 32) {
                    for (let py = p.y; py < p.y + p.h; py += 32) {
                        this.ctx.drawImage(sprPaths, 0, 0, 16, 16, px, py, 32, 32);
                    }
                }
            } else {
                // Dirt path base
                this.ctx.fillStyle = '#8d532b';
                this.ctx.fillRect(p.x, p.y, p.w, p.h);

                // Path texture gravel details
                this.ctx.fillStyle = '#a66436';
                for (let px = p.x + 6; px < p.x + p.w - 6; px += 24) {
                    for (let py = p.y + 6; py < p.y + p.h - 6; py += 18) {
                        this.ctx.fillRect(px, py, 6, 4);
                    }
                }

                // Cobblestone border lines
                this.ctx.fillStyle = '#6a3b1c';
                this.ctx.fillRect(p.x, p.y, p.w, 3);
                this.ctx.fillRect(p.x, p.y + p.h - 3, p.w, 3);
            }
        });

        // 3. Render Perimeter Fences with Shadow Depth
        if (sprFences && sprFences.complete) {
            for (let fx = 80; fx < 1420; fx += 32) {
                this.ctx.drawImage(sprFences, 0, 0, 16, 16, fx, 40, 32, 32);
                this.ctx.drawImage(sprFences, 0, 0, 16, 16, fx, 960, 32, 32);
            }
            for (let fy = 40; fy < 960; fy += 32) {
                this.ctx.drawImage(sprFences, 0, 0, 16, 16, 80, fy, 32, 32);
                this.ctx.drawImage(sprFences, 0, 0, 16, 16, 1420, fy, 32, 32);
            }
        } else {
            // Fence Shadow
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            this.ctx.fillRect(84, 46, 1340, 920);

            // Rustic Wooden Fence Posts
            this.ctx.strokeStyle = '#78350f';
            this.ctx.lineWidth = 6;
            this.ctx.strokeRect(80, 40, 1340, 920);

            this.ctx.fillStyle = '#b45309';
            for (let fx = 80; fx <= 1420; fx += 60) {
                this.ctx.fillRect(fx - 4, 34, 8, 16);
                this.ctx.fillRect(fx - 4, 954, 8, 16);
            }
            for (let fy = 40; fy <= 960; fy += 60) {
                this.ctx.fillRect(74, fy - 4, 16, 8);
                this.ctx.fillRect(1414, fy - 4, 16, 8);
            }
        }

        // 4. Render Floating Particles & Ambient Wildlife
        this.particles.forEach(p => p.draw(this.ctx));

        this.ambientWildlife.forEach(w => {
            this.ctx.save();
            const wingOffset = Math.sin(w.wingTimer) * 4;
            this.ctx.fillStyle = w.color;
            this.ctx.beginPath();
            this.ctx.ellipse(w.x - 3, w.y, 4, 3 + wingOffset, 0, 0, Math.PI * 2);
            this.ctx.ellipse(w.x + 3, w.y, 4, 3 + wingOffset, 0, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });

        // 5. Subtle Ambient Vignette & Sunbeams
        const vignette = this.ctx.createRadialGradient(
            this.camera.x + scaledW / 2, this.camera.y + scaledH / 2, scaledW * 0.3,
            this.camera.x + scaledW / 2, this.camera.y + scaledH / 2, scaledW * 0.75
        );
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignette.addColorStop(1, 'rgba(9, 17, 30, 0.35)');
        this.ctx.fillStyle = vignette;
        this.ctx.fillRect(this.camera.x, this.camera.y, scaledW, scaledH);

        this.ctx.restore();
    }
}

const engine = new GameEngine();

/* Helper Toast Notification function */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            if (typeof toast.remove === 'function') toast.remove();
        }, 300);
    }, 2500);
}
