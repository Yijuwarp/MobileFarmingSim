/* ==========================================================================
   FARM EMPIRE - Economy & Financial Survival Manager
   ========================================================================== */

class EconomyManager {
    constructor() {
        this.initialCash = 0;
        this.initialLoan = 10000;
        this.monthlyDues = 1000;
        this.monthDurationSeconds = 300; // 5 minutes (300s) real-time per month
        this.reset();
    }

    reset() {
        this.balance = this.initialCash;
        this.loanPrincipal = this.initialLoan;
        this.monthTimer = this.monthDurationSeconds;
        this.monthsSurvived = 0;
        this.totalEarned = 0;
        this.workersHiredCount = 0;
        this.isGameOver = false;
        this.isVictory = false;
        this.warningPlayed = false;
    }

    update(dt) {
        if (this.isGameOver) return;

        this.monthTimer -= dt;

        // Warning sound when 10 seconds remaining
        if (this.monthTimer <= 10 && !this.warningPlayed) {
            soundManager.playWarning();
            this.warningPlayed = true;
        }

        // Monthly Dues Timer Expiration
        if (this.monthTimer <= 0) {
            this.processMonthlyDues();
        }
    }

    processMonthlyDues() {
        if (this.isVictory) return;

        if (this.balance >= this.monthlyDues) {
            // Deduct payment
            this.balance -= this.monthlyDues;
            this.monthsSurvived += 1;
            this.monthTimer = this.monthDurationSeconds;
            this.warningPlayed = false;
            soundManager.playCoin();

            showToast(`📅 Month ${this.monthsSurvived} Dues ($1,000) Paid!`, 'success');
        } else {
            // Foreclosure / Game Over!
            this.isGameOver = true;
            soundManager.playGameOver();
            showForeclosureModal(this);
        }
    }

    addMoney(amount) {
        this.balance += amount;
        this.totalEarned += amount;
        soundManager.playCoin();
    }

    spendMoney(amount) {
        if (this.balance >= amount) {
            this.balance -= amount;
            return true;
        }
        showToast("⚠️ Insufficient funds!", "danger");
        return false;
    }

    payDownLoan(amount) {
        const payment = Math.min(amount, this.loanPrincipal, this.balance);
        if (payment <= 0) return false;

        this.balance -= payment;
        this.loanPrincipal -= payment;
        soundManager.playCoin();
        showToast(`🏛️ Paid $${payment} towards loan debt!`, 'info');

        if (this.loanPrincipal <= 0) {
            this.loanPrincipal = 0;
            this.triggerVictory();
        }
        return true;
    }

    triggerVictory() {
        if (!this.isVictory && !this.isGameOver) {
            this.isVictory = true;
            soundManager.playHire();
            showVictoryModal();
        }
    }
}

const economy = new EconomyManager();
