/* ==========================================================================
   FARM EMPIRE - Game Engine, Canvas Renderer & Sprout Lands Asset Manager
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

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.inputDir = { x: 0, y: 0 };
        this.keys = {};
        this.particles = [];
        this.routeHelpers = [];
        this.customers = [];

        this.camera = { x: 0, y: 0 };

        this.initCanvas();
        this.initInput();
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

    updateCamera(playerX, playerY) {
        // Smooth camera follow
        this.camera.x += (playerX - this.width / 2 - this.camera.x) * 0.1;
        this.camera.y += (playerY - this.height / 2 - this.camera.y) * 0.1;
    }

    drawFarmBackground() {
        // Pixel-Art Crisp Scaling
        this.ctx.imageSmoothingEnabled = false;

        const sprGrass = assets.get('grass');
        const sprPaths = assets.get('paths');
        const sprFences = assets.get('fences');

        this.ctx.save();
        this.ctx.translate(-this.camera.x, -this.camera.y);

        // 1. Render Sprout Lands Grass Tile Grid
        const tileSize = 48; // Scaled 3x from 16x16
        const startTileX = Math.floor(this.camera.x / tileSize) * tileSize - tileSize;
        const endTileX = this.camera.x + this.width + tileSize * 2;
        const startTileY = Math.floor(this.camera.y / tileSize) * tileSize - tileSize;
        const endTileY = this.camera.y + this.height + tileSize * 2;

        for (let x = startTileX; x < endTileX; x += tileSize) {
            for (let y = startTileY; y < endTileY; y += tileSize) {
                if (sprGrass && sprGrass.complete) {
                    this.ctx.drawImage(sprGrass, 0, 0, 16, 16, x, y, tileSize, tileSize);
                } else {
                    this.ctx.fillStyle = '#5c9447';
                    this.ctx.fillRect(x, y, tileSize, tileSize);
                }
            }
        }

        // 2. Render Sprout Lands Paths
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
                this.ctx.fillStyle = '#b45309';
                this.ctx.fillRect(p.x, p.y, p.w, p.h);
            }
        });

        // 3. Render Farm Perimeter Fences
        if (sprFences && sprFences.complete) {
            // Horizontal top/bottom fences
            for (let fx = 80; fx < 1420; fx += 32) {
                this.ctx.drawImage(sprFences, 0, 0, 16, 16, fx, 40, 32, 32);
                this.ctx.drawImage(sprFences, 0, 0, 16, 16, fx, 960, 32, 32);
            }
            // Vertical left/right fences
            for (let fy = 40; fy < 960; fy += 32) {
                this.ctx.drawImage(sprFences, 0, 0, 16, 16, 80, fy, 32, 32);
                this.ctx.drawImage(sprFences, 0, 0, 16, 16, 1420, fy, 32, 32);
            }
        } else {
            this.ctx.strokeStyle = '#78350f';
            this.ctx.lineWidth = 8;
            this.ctx.strokeRect(80, 40, 1340, 920);
        }

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
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}
