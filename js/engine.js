/* ==========================================================================
   FARM EMPIRE - Game Engine, Canvas Renderer & Input Controller
   ========================================================================== */

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
        this.ctx.fillStyle = '#15803d'; // Rich Farm Grass Green
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();
        this.ctx.translate(-this.camera.x, -this.camera.y);

        // Draw Dirt Roads & Pathways
        this.ctx.fillStyle = '#b45309';
        // Main Horizontal Highway (connects Grain Patch, Chicken Coop, Market Stall)
        this.ctx.fillRect(150, 320, 1200, 45);
        // Main Vertical Central Avenue (connects Coop, Mayo Machine, Cheese Vat)
        this.ctx.fillRect(730, 100, 45, 800);

        // Sub-Paths to Side Buildings
        this.ctx.fillRect(230, 320, 40, 200); // Path to Cow Pasture
        this.ctx.fillRect(1230, 320, 40, 200); // Path to Bank Desk

        // Farm Boundary Border
        this.ctx.strokeStyle = '#78350f';
        this.ctx.lineWidth = 8;
        this.ctx.strokeRect(80, 40, 1340, 920);

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
