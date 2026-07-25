/* ==========================================================================
   FARM EMPIRE - Farm Stations & Stand-on Decision Action Pads (Zero Overlap)
   ========================================================================== */

class ActionPad {
    constructor(id, name, x, y, radius, cost, requiredHoldTime, onCompleteAction, icon = '⚡') {
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.cost = cost;
        this.requiredHoldTime = requiredHoldTime;
        this.currentHoldTime = 0;
        this.onCompleteAction = onCompleteAction;
        this.icon = icon;
        this.isActive = true;
        this.isUnlocked = false;
        this.isPurchased = false;
    }

    update(dt, player) {
        if (!this.isActive || this.isPurchased || !player) return;

        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (dist <= this.radius) {
            this.currentHoldTime += dt;
            if (this.currentHoldTime >= this.requiredHoldTime) {
                this.execute(player);
                this.currentHoldTime = 0;
            }
        } else {
            this.currentHoldTime = Math.max(0, this.currentHoldTime - dt * 2);
        }
    }

    execute(player) {
        if (this.cost > 0) {
            if (economy.spendMoney(this.cost)) {
                this.isPurchased = true;
                this.onCompleteAction(player);
                soundManager.playHire();
                showToast(`✅ ${this.name} Completed!`, 'success');
            }
        } else {
            this.onCompleteAction(player);
            this.currentHoldTime = 0;
        }
    }

    draw(ctx) {
        if (!this.isActive || this.isPurchased) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Ground Target Base
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.cost > 0 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(59, 130, 246, 0.25)';
        ctx.fill();
        ctx.strokeStyle = this.cost > 0 ? '#f59e0b' : '#3b82f6';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Hold Progress Meter Ring
        if (this.currentHoldTime > 0) {
            const fillRatio = Math.min(1, this.currentHoldTime / this.requiredHoldTime);
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 3, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * fillRatio));
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        // Icon
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.icon, 0, -10);

        // Label
        ctx.font = '800 9px Outfit';
        ctx.fillText(this.name, 0, 5);

        // Price Tag
        if (this.cost > 0) {
            ctx.fillStyle = '#fef08a';
            ctx.font = '900 9px Outfit';
            ctx.fillText(`$${this.cost}`, 0, 17);
        }

        ctx.restore();
    }
}

/* --------------------------------------------------------------------------
   Farm Station Modules (Spacious & Clean Layout)
   -------------------------------------------------------------------------- */
class GrainStation {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.feedStock = 20;
        this.maxStock = 50;
        this.growTimer = 0;

        // Action Pads placed cleanly in front (y + 80)
        this.harvestPad = new ActionPad('harvest_grain', 'Harvest Feed', x - 40, y + 80, 32, 0, 0.25, (player) => {
            if (this.feedStock > 0 && player.addItem('wheat')) {
                this.feedStock -= 1;
            }
        }, '🌾');

        this.hirePad = new ActionPad('hire_feed_worker', 'Hire Helper', x + 40, y + 80, 32, 150, 0.8, () => {
            spawnRouteHelper('feed_worker', 'Feeder Helper',
                { x: this.x, y: this.y + 80, stationRef: this },
                { x: game.coopStation.x - 50, y: game.coopStation.y + 80, stationRef: game.coopStation },
                'wheat'
            );
            economy.workersHiredCount++;
        }, '🧑‍🌾');
    }

    giveItemToWorker(type) {
        if (type === 'wheat' && this.feedStock > 0) {
            this.feedStock -= 1;
            return 'wheat';
        }
        return null;
    }
    receiveItemFromWorker(item) { return false; }

    update(dt, player) {
        this.growTimer += dt;
        if (this.growTimer >= 1.5 && this.feedStock < this.maxStock) {
            this.feedStock += 1;
            this.growTimer = 0;
        }

        this.harvestPad.update(dt, player);
        this.hirePad.update(dt, player);
    }

    draw(ctx) {
        // Field Plot Box
        ctx.fillStyle = '#d97706';
        ctx.fillRect(this.x - 70, this.y - 45, 140, 80);
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 3;
        ctx.strokeRect(this.x - 70, this.y - 45, 140, 80);

        // Wheat Stalks inside field
        for (let i = 0; i < Math.min(this.feedStock, 18); i++) {
            const wx = this.x - 55 + (i % 6) * 22;
            const wy = this.y - 30 + Math.floor(i / 6) * 22;
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(wx, wy, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Header Title ABOVE plot (y - 55)
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 12px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText(`GRAIN PATCH (${this.feedStock}/${this.maxStock})`, this.x, this.y - 55);

        this.harvestPad.draw(ctx);
        this.hirePad.draw(ctx);
    }
}

class CoopStation {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.feedTrough = 0;
        this.maxFeed = 20;
        this.eggStock = 0;
        this.maxEggs = 25;
        this.layTimer = 0;

        // Action Pads placed cleanly in front (y + 80)
        this.feedPad = new ActionPad('feed_coop', 'Add Feed', x - 50, y + 80, 32, 0, 0.25, (player) => {
            if (this.feedTrough < this.maxFeed && player.removeItem('wheat')) {
                this.feedTrough += 1;
            }
        }, '📥');

        this.collectPad = new ActionPad('collect_eggs', 'Collect Eggs', x + 50, y + 80, 32, 0, 0.25, (player) => {
            if (this.eggStock > 0 && player.addItem('egg')) {
                this.eggStock -= 1;
            }
        }, '🥚');
    }

    receiveItemFromWorker(item) {
        if (item === 'wheat' && this.feedTrough < this.maxFeed) {
            this.feedTrough += 1;
            return true;
        }
        return false;
    }

    giveItemToWorker(type) {
        if (type === 'egg' && this.eggStock > 0) {
            this.eggStock -= 1;
            return 'egg';
        }
        return null;
    }

    update(dt, player) {
        if (this.feedTrough > 0 && this.eggStock < this.maxEggs) {
            this.layTimer += dt;
            if (this.layTimer >= 2.5) {
                this.feedTrough -= 1;
                this.eggStock += 1;
                this.layTimer = 0;
            }
        }

        this.feedPad.update(dt, player);
        this.collectPad.update(dt, player);
    }

    draw(ctx) {
        // Coop Building
        ctx.fillStyle = '#b45309';
        ctx.fillRect(this.x - 70, this.y - 45, 140, 70);
        ctx.fillStyle = '#ef4444'; // Roof
        ctx.beginPath();
        ctx.moveTo(this.x - 80, this.y - 45);
        ctx.lineTo(this.x, this.y - 70);
        ctx.lineTo(this.x + 80, this.y - 45);
        ctx.closePath();
        ctx.fill();

        // Hens inside
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('🐓 🐓 🐓', this.x, this.y - 15);

        // Status Badge Pill BELOW building (y + 35)
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(this.x - 75, this.y + 28, 150, 20);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - 75, this.y + 28, 150, 20);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 10px Outfit';
        ctx.fillText(`FEED: ${this.feedTrough}/${this.maxFeed} | EGGS: ${this.eggStock}/${this.maxEggs}`, this.x, this.y + 42);

        this.feedPad.draw(ctx);
        this.collectPad.draw(ctx);
    }
}

class MarketStall {
    constructor(x, y) {
        this.x = x;
        this.y = y;

        // Action Pads placed cleanly in front (y + 80)
        this.sellPad = new ActionPad('sell_stall', 'Sell Products', x - 40, y + 80, 34, 0, 0.2, (player) => {
            const item = player.removeItem();
            if (item) {
                let price = 15;
                if (item === 'mayo') price = 45;
                if (item === 'milk') price = 35;
                if (item === 'cheese') price = 90;
                if (item === 'artisan_cheese') price = 250;

                economy.addMoney(price);
                createFloatingText(`+$${price}`, player.x, player.y - 20, '#10b981');
            }
        }, '💰');

        this.hirePad = new ActionPad('hire_sales_worker', 'Hire Seller', x + 50, y + 80, 32, 250, 0.8, () => {
            spawnRouteHelper('sales_worker', 'Egg Seller',
                { x: game.coopStation.x + 50, y: game.coopStation.y + 80, stationRef: game.coopStation },
                { x: this.x - 40, y: this.y + 80, stationRef: this },
                'egg'
            );
            economy.workersHiredCount++;
        }, '🧑‍💼');
    }

    receiveItemFromWorker(item) {
        let price = 15;
        if (item === 'mayo') price = 45;
        if (item === 'milk') price = 35;
        if (item === 'cheese') price = 90;
        if (item === 'artisan_cheese') price = 250;

        economy.addMoney(price);
        createFloatingText(`+$${price}`, this.x, this.y - 40, '#10b981');
        return true;
    }

    sellToCustomer(desiredItem) {
        let price = 15;
        if (desiredItem === 'mayo') price = 45;
        if (desiredItem === 'milk') price = 35;
        if (desiredItem === 'cheese') price = 90;
        if (desiredItem === 'artisan_cheese') price = 250;

        economy.addMoney(price);
        createFloatingText(`+$${price}`, this.x, this.y - 40, '#10b981');
        return true;
    }

    giveItemToWorker(type) { return null; }

    update(dt, player) {
        this.sellPad.update(dt, player);
        this.hirePad.update(dt, player);
    }

    draw(ctx) {
        // Stall Structure
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(this.x - 60, this.y - 40, 120, 60);
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(this.x - 65, this.y - 50, 130, 14);

        // Header Title ABOVE awning (y - 58)
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 12px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('ROADSIDE MARKET', this.x, this.y - 58);

        this.sellPad.draw(ctx);
        this.hirePad.draw(ctx);
    }
}

class MayoStation {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.isUnlocked = false;
        this.inputEggs = 0;
        this.outputMayo = 0;
        this.processTimer = 0;

        this.unlockPad = new ActionPad('unlock_mayo', 'Unlock Mayo', x, y, 40, 500, 1.0, () => {
            this.isUnlocked = true;
        }, '🏭');

        this.depositPad = new ActionPad('mayo_deposit', 'Add Egg', x - 60, y + 75, 30, 0, 0.25, (player) => {
            if (this.inputEggs < 10 && player.removeItem('egg')) {
                this.inputEggs += 1;
            }
        }, '🥚');

        this.collectPad = new ActionPad('mayo_collect', 'Get Mayo', x, y + 75, 30, 0, 0.25, (player) => {
            if (this.outputMayo > 0 && player.addItem('mayo')) {
                this.outputMayo -= 1;
            }
        }, '🧴');

        this.hirePad = new ActionPad('hire_mayo_worker', 'Hire Mayo Worker', x + 65, y + 75, 30, 400, 0.8, () => {
            spawnRouteHelper('mayo_worker', 'Mayo Helper',
                { x: game.coopStation.x + 50, y: game.coopStation.y + 80, stationRef: game.coopStation },
                { x: this.x - 60, y: this.y + 75, stationRef: this },
                'egg'
            );
            economy.workersHiredCount++;
        }, '🧑‍🔧');
    }

    receiveItemFromWorker(item) {
        if (item === 'egg' && this.inputEggs < 10) {
            this.inputEggs += 1;
            return true;
        }
        return false;
    }

    giveItemToWorker(type) {
        if (type === 'mayo' && this.outputMayo > 0) {
            this.outputMayo -= 1;
            return 'mayo';
        }
        return null;
    }

    update(dt, player) {
        if (!this.isUnlocked) {
            this.unlockPad.update(dt, player);
            return;
        }

        if (this.inputEggs > 0 && this.outputMayo < 15) {
            this.processTimer += dt;
            if (this.processTimer >= 3.5) {
                this.inputEggs -= 1;
                this.outputMayo += 1;
                this.processTimer = 0;
            }
        }

        this.depositPad.update(dt, player);
        this.collectPad.update(dt, player);
        this.hirePad.update(dt, player);
    }

    draw(ctx) {
        if (!this.isUnlocked) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.setLineDash([6, 6]);
            ctx.strokeRect(this.x - 65, this.y - 40, 130, 80);
            ctx.setLineDash([]);
            this.unlockPad.draw(ctx);
            return;
        }

        ctx.fillStyle = '#eab308';
        ctx.fillRect(this.x - 65, this.y - 40, 130, 60);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 11px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('MAYO FACTORY ($45)', this.x, this.y - 20);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(this.x - 70, this.y + 25, 140, 18);
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 10px Outfit';
        ctx.fillText(`EGGS: ${this.inputEggs}/10 | MAYO: ${this.outputMayo}/15`, this.x, this.y + 37);

        this.depositPad.draw(ctx);
        this.collectPad.draw(ctx);
        this.hirePad.draw(ctx);
    }
}

class CowStation {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.isUnlocked = false;
        this.feedStock = 0;
        this.milkStock = 0;
        this.milkTimer = 0;

        this.unlockPad = new ActionPad('unlock_cows', 'Unlock Cows', x, y, 40, 1200, 1.0, () => {
            this.isUnlocked = true;
        }, '🐄');

        this.feedPad = new ActionPad('cow_feed', 'Add Feed', x - 40, y + 75, 30, 0, 0.25, (player) => {
            if (this.feedStock < 15 && player.removeItem('wheat')) {
                this.feedStock += 1;
            }
        }, '🌾');

        this.collectPad = new ActionPad('cow_milk', 'Get Milk', x + 40, y + 75, 30, 0, 0.25, (player) => {
            if (this.milkStock > 0 && player.addItem('milk')) {
                this.milkStock -= 1;
            }
        }, '🥛');
    }

    receiveItemFromWorker(item) {
        if (item === 'wheat' && this.feedStock < 15) {
            this.feedStock += 1;
            return true;
        }
        return false;
    }

    giveItemToWorker(type) {
        if (type === 'milk' && this.milkStock > 0) {
            this.milkStock -= 1;
            return 'milk';
        }
        return null;
    }

    update(dt, player) {
        if (!this.isUnlocked) {
            this.unlockPad.update(dt, player);
            return;
        }

        if (this.feedStock > 0 && this.milkStock < 20) {
            this.milkTimer += dt;
            if (this.milkTimer >= 4.0) {
                this.feedStock -= 1;
                this.milkStock += 1;
                this.milkTimer = 0;
            }
        }

        this.feedPad.update(dt, player);
        this.collectPad.update(dt, player);
    }

    draw(ctx) {
        if (!this.isUnlocked) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.setLineDash([6, 6]);
            ctx.strokeRect(this.x - 65, this.y - 40, 130, 80);
            ctx.setLineDash([]);
            this.unlockPad.draw(ctx);
            return;
        }

        ctx.fillStyle = '#10b981';
        ctx.fillRect(this.x - 65, this.y - 40, 130, 60);
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('🐄 🐄', this.x, this.y - 15);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(this.x - 70, this.y + 25, 140, 18);
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 10px Outfit';
        ctx.fillText(`FEED: ${this.feedStock}/15 | MILK: ${this.milkStock}/20`, this.x, this.y + 37);

        this.feedPad.draw(ctx);
        this.collectPad.draw(ctx);
    }
}

class CheeseStation {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.isUnlocked = false;
        this.inputMilk = 0;
        this.plainCheese = 0;
        this.artisanCheese = 0;
        this.processTimer = 0;

        this.unlockPad = new ActionPad('unlock_cheese', 'Unlock Cheese', x, y, 42, 2500, 1.0, () => {
            this.isUnlocked = true;
        }, '🧀');

        this.depositPad = new ActionPad('cheese_deposit', 'Add Milk', x - 45, y + 75, 30, 0, 0.25, (player) => {
            if (this.inputMilk < 10 && player.removeItem('milk')) {
                this.inputMilk += 1;
            }
        }, '🥛');

        this.collectPad = new ActionPad('cheese_collect', 'Get Cheese', x + 45, y + 75, 30, 0, 0.25, (player) => {
            if (this.artisanCheese > 0) {
                if (player.addItem('artisan_cheese')) this.artisanCheese -= 1;
            } else if (this.plainCheese > 0) {
                if (player.addItem('cheese')) this.plainCheese -= 1;
            }
        }, '🧀');
    }

    receiveItemFromWorker(item) {
        if (item === 'milk' && this.inputMilk < 10) {
            this.inputMilk += 1;
            return true;
        }
        return false;
    }

    giveItemToWorker(type) {
        if (type === 'cheese' && this.plainCheese > 0) {
            this.plainCheese -= 1;
            return 'cheese';
        }
        if (type === 'artisan_cheese' && this.artisanCheese > 0) {
            this.artisanCheese -= 1;
            return 'artisan_cheese';
        }
        return null;
    }

    update(dt, player) {
        if (!this.isUnlocked) {
            this.unlockPad.update(dt, player);
            return;
        }

        if (this.inputMilk > 0 && this.plainCheese < 10) {
            this.processTimer += dt;
            if (this.processTimer >= 5.0) {
                this.inputMilk -= 1;
                this.plainCheese += 1;
                this.processTimer = 0;
            }
        }

        if (this.plainCheese > 0 && this.artisanCheese < 5) {
            if (Math.random() < 0.05) {
                this.plainCheese -= 1;
                this.artisanCheese += 1;
            }
        }

        this.depositPad.update(dt, player);
        this.collectPad.update(dt, player);
    }

    draw(ctx) {
        if (!this.isUnlocked) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.setLineDash([6, 6]);
            ctx.strokeRect(this.x - 65, this.y - 40, 130, 80);
            ctx.setLineDash([]);
            this.unlockPad.draw(ctx);
            return;
        }

        ctx.fillStyle = '#8b5cf6';
        ctx.fillRect(this.x - 65, this.y - 40, 130, 60);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 11px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('CHEESE AGING VAT', this.x, this.y - 20);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(this.x - 70, this.y + 25, 140, 24);
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 9px Outfit';
        ctx.fillText(`MILK: ${this.inputMilk}/10 | CHEESE: ${this.plainCheese}`, this.x, this.y + 35);
        ctx.fillText(`ARTISANAL ($250): ${this.artisanCheese}`, this.x, this.y + 46);

        this.depositPad.draw(ctx);
        this.collectPad.draw(ctx);
    }
}

class BankDesk {
    constructor(x, y) {
        this.x = x;
        this.y = y;

        // Action Pad placed cleanly in front (y + 75)
        this.payPad = new ActionPad('pay_loan', 'Pay $500 Loan', x, y + 75, 36, 0, 0.6, () => {
            economy.payDownLoan(500);
        }, '🏛️');
    }

    receiveItemFromWorker(item) { return false; }
    giveItemToWorker(type) { return null; }

    update(dt, player) {
        this.payPad.update(dt, player);
    }

    draw(ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(this.x - 55, this.y - 35, 110, 55);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(this.x - 60, this.y - 45, 120, 10);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 11px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('BANK & LOAN DESK', this.x, this.y - 20);

        this.payPad.draw(ctx);
    }
}
