/* ==========================================================================
   FARM EMPIRE - Main Game Controller & Execution Loop
   ========================================================================== */

class GameController {
    constructor() {
        this.player = new Player(750, 340);

        this.initStations();

        this.routeHelpers = [];
        this.floatingTexts = [];
        this.customers = [];
        this.customerTimer = 0;

        this.lastTime = performance.now();

        this.initUI();
    }

    initStations() {
        this.grainStation = new GrainStation(250, 180);
        this.coopStation = new CoopStation(750, 180);
        this.marketStall = new MarketStall(1250, 180);
        this.mayoStation = new MayoStation(750, 500);
        this.cowStation = new CowStation(250, 500);
        this.cheeseStation = new CheeseStation(750, 800);
        this.bankDesk = new BankDesk(1250, 500);
    }

    initUI() {
        // Restart Button
        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => this.restartGame());
        }

        // Continue Endless Button
        const continueBtn = document.getElementById('continue-btn');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                document.getElementById('modal-overlay').classList.add('hidden');
                document.getElementById('victory-modal').classList.add('hidden');
            });
        }

        // Sound Toggle
        const soundBtn = document.getElementById('sound-toggle-btn');
        if (soundBtn) {
            soundBtn.addEventListener('click', () => {
                const enabled = soundManager.toggleSound();
                soundBtn.innerText = enabled ? '🔊' : '🔇';
            });
        }
    }

    restartGame() {
        economy.reset();
        this.player.reset(750, 340);
        this.initStations();
        this.routeHelpers = [];
        this.floatingTexts = [];
        this.customers = [];
        this.customerTimer = 0;

        document.getElementById('modal-overlay').classList.add('hidden');
        document.getElementById('foreclosure-modal').classList.add('hidden');
        document.getElementById('victory-modal').classList.add('hidden');

        showToast('🚜 New Farm Started! $10,000 Loan Issued.', 'info');
    }

    start() {
        requestAnimationFrame((time) => this.loop(time));
    }

    loop(currentTime) {
        const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
        this.lastTime = currentTime;

        this.update(dt);
        this.render();

        requestAnimationFrame((time) => this.loop(time));
    }

    update(dt) {
        // Economy Timer Tick
        economy.update(dt);

        if (economy.isGameOver) return;

        // Update Player & Camera
        this.player.update(dt, engine.inputDir);
        engine.updateCamera(this.player.x, this.player.y);

        // Update Farm Stations
        this.grainStation.update(dt, this.player);
        this.coopStation.update(dt, this.player);
        this.marketStall.update(dt, this.player);
        this.mayoStation.update(dt, this.player);
        this.cowStation.update(dt, this.player);
        this.cheeseStation.update(dt, this.player);
        this.bankDesk.update(dt, this.player);

        // Update Route Helpers (1/3 speed dedicated workers)
        this.routeHelpers.forEach(helper => helper.update(dt));

        // Update Floating Text Particles
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            this.floatingTexts[i].update(dt);
            if (this.floatingTexts[i].life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }

        // Spawn & Update Market Customers
        this.customerTimer += dt;
        if (this.customerTimer >= 4.0 && this.customers.length < 5) {
            this.customers.push(new Customer(750, 500, this.marketStall.x, this.marketStall.y));
            this.customerTimer = 0;
        }

        for (let i = this.customers.length - 1; i >= 0; i--) {
            this.customers[i].update(dt, this.marketStall);
            if (this.customers[i].isDone) {
                this.customers.splice(i, 1);
            }
        }

        // Update HUD Display Elements
        this.updateHUD();
    }

    updateHUD() {
        const bankElem = document.getElementById('hud-bank-balance');
        const loanElem = document.getElementById('hud-loan-principal');
        const timerElem = document.getElementById('hud-timer');
        const timerBar = document.getElementById('hud-timer-bar');
        const timerPill = document.getElementById('loan-timer-pill');

        if (bankElem) bankElem.innerText = `$${economy.balance.toLocaleString()}`;
        if (loanElem) loanElem.innerText = `$${economy.loanPrincipal.toLocaleString()}`;

        const remainingSeconds = Math.max(0, Math.ceil(economy.monthTimer));
        if (timerElem) timerElem.innerText = `${remainingSeconds}s`;

        if (timerBar) {
            const ratio = Math.max(0, economy.monthTimer / economy.monthDurationSeconds);
            timerBar.style.width = `${ratio * 100}%`;
        }

        // Urgent warning pulse when < 10 seconds remaining
        if (timerPill) {
            if (remainingSeconds <= 10) {
                timerPill.classList.add('urgent');
            } else {
                timerPill.classList.remove('urgent');
            }
        }
    }

    render() {
        engine.drawFarmBackground();

        const ctx = engine.ctx;
        ctx.save();
        ctx.translate(-engine.camera.x, -engine.camera.y);

        // Render Stations
        this.grainStation.draw(ctx);
        this.coopStation.draw(ctx);
        this.marketStall.draw(ctx);
        this.mayoStation.draw(ctx);
        this.cowStation.draw(ctx);
        this.cheeseStation.draw(ctx);
        this.bankDesk.draw(ctx);

        // Render Route Helpers
        this.routeHelpers.forEach(helper => helper.draw(ctx));

        // Render Customers
        this.customers.forEach(customer => customer.draw(ctx));

        // Render Player Avatar (Single active mobile character)
        this.player.draw(ctx);

        // Render Floating Particles (+ $15, +1 Feed)
        this.floatingTexts.forEach(txt => txt.draw(ctx));

        ctx.restore();
    }
}

// Global spawner helper functions called by station action pads
function spawnRouteHelper(id, name, sourcePos, destPos, itemType) {
    const helper = new RouteHelper(id, name, sourcePos, destPos, itemType, game.player.speed);
    game.routeHelpers.push(helper);
}

function createFloatingText(text, x, y, color = '#f59e0b') {
    game.floatingTexts.push(new FloatingText(text, x, y, color));
}

function showForeclosureModal(econ) {
    document.getElementById('victory-modal').classList.add('hidden');
    document.getElementById('foreclosure-modal').classList.remove('hidden');
    document.getElementById('modal-overlay').classList.remove('hidden');

    document.getElementById('stat-days-survived').innerText = econ.monthsSurvived;
    document.getElementById('stat-total-earned').innerText = `$${econ.totalEarned.toLocaleString()}`;
    document.getElementById('stat-workers-hired').innerText = econ.workersHiredCount;
}

function showVictoryModal() {
    document.getElementById('foreclosure-modal').classList.add('hidden');
    document.getElementById('victory-modal').classList.remove('hidden');
    document.getElementById('modal-overlay').classList.remove('hidden');
}

// Instantiate and start game
let game;
window.addEventListener('load', () => {
    game = new GameController();
    game.start();
});
