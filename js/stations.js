/* ==========================================================================
   FARM EMPIRE - Farm Stations & Stand-on Decision Action Pads (Zero Overlap)
   ========================================================================== */

class ActionPad {
    constructor(id, name, x, y, radius, cost, requiredHoldTime, onCompleteAction, icon = '⚡', maxPurchases = 1) {
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
        this.maxPurchases = maxPurchases;
        this.purchasedCount = 0;
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
                this.purchasedCount++;
                this.onCompleteAction(player);
                soundManager.playHire();

                if (this.purchasedCount >= this.maxPurchases) {
                    this.isPurchased = true;
                } else {
                    this.cost = Math.floor(this.cost * 1.5);
                }
                showToast(`✅ ${this.name} (${this.purchasedCount}/${this.maxPurchases}) Hired!`, 'success');
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
        this.feedStock = 30;
        this.maxStock = 60;
        this.growTimer = 0;
        this.isExtraPlotUnlocked = false;
        this.worker = null;
        this.transferTimer = 0;

        // Upgrade / Hire Pad in front
        this.hirePad = new ActionPad('hire_feed_worker', 'Hire Feeder ($50)', x, y + 85, 30, 50, 0.4, () => {
            if (!this.worker) {
                this.worker = spawnRouteHelper('feed_worker', 'Feeder Helper',
                    { x: this.x, y: this.y, stationRef: this },
                    { x: game.coopStation.x, y: game.coopStation.y, stationRef: game.coopStation },
                    'wheat'
                );
                economy.workersHiredCount++;
                this.hirePad.name = 'Wheelbarrow ($120)';
                this.hirePad.cost = 120;
                this.hirePad.icon = '🛒';
                this.hirePad.isPurchased = false;
            } else if (this.worker.level === 1) {
                this.worker.upgrade();
                this.hirePad.name = 'Forklift ($300)';
                this.hirePad.cost = 300;
                this.hirePad.icon = '🚜';
                this.hirePad.isPurchased = false;
            } else if (this.worker.level === 2) {
                this.worker.upgrade();
                this.hirePad.isPurchased = true;
            }
        }, '🧑‍🌾');

        this.extraPlotPad = new ActionPad('unlock_wheat_2', 'Unlock Plot 2 ($150)', x + 75, y + 85, 30, 150, 0.5, () => {
            this.isExtraPlotUnlocked = true;
            this.maxStock = 120;
            this.feedStock += 30;
        }, '🌱');
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
        // Fast instant wheat growth
        this.growTimer += dt;
        const growthInterval = this.isExtraPlotUnlocked ? 0.2 : 0.4;
        if (this.growTimer >= growthInterval && this.feedStock < this.maxStock) {
            this.feedStock += this.isExtraPlotUnlocked ? 2 : 1;
            this.growTimer = 0;
        }

        // Broad Zone Interaction: Standing anywhere on field plot collects wheat instantly into player stack!
        if (player && Math.hypot(player.x - this.x, player.y - this.y) <= 85) {
            this.transferTimer += dt;
            if (this.transferTimer >= 0.08) {
                if (this.feedStock > 0 && player.addItem('wheat')) {
                    this.feedStock -= 1;
                }
                this.transferTimer = 0;
            }
        }

        this.hirePad.update(dt, player);
        if (!this.isExtraPlotUnlocked) {
            this.extraPlotPad.update(dt, player);
        }
    }

    draw(ctx) {
        // Main Plot Box
        ctx.fillStyle = '#d97706';
        ctx.fillRect(this.x - 70, this.y - 45, 140, 80);
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 3;
        ctx.strokeRect(this.x - 70, this.y - 45, 140, 80);

        // Wheat Stalks inside main field
        const renderedStalks = Math.min(this.feedStock, 18);
        for (let i = 0; i < renderedStalks; i++) {
            const wx = this.x - 55 + (i % 6) * 22;
            const wy = this.y - 30 + Math.floor(i / 6) * 22;
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(wx, wy, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Render 2nd Plot if unlocked
        if (this.isExtraPlotUnlocked) {
            ctx.fillStyle = '#b45309';
            ctx.fillRect(this.x + 80, this.y - 45, 70, 80);
            ctx.strokeStyle = '#78350f';
            ctx.strokeRect(this.x + 80, this.y - 45, 70, 80);

            for (let i = 0; i < Math.min(10, Math.max(0, this.feedStock - 18)); i++) {
                const wx = this.x + 92 + (i % 3) * 20;
                const wy = this.y - 30 + Math.floor(i / 3) * 22;
                ctx.fillStyle = '#f59e0b';
                ctx.beginPath();
                ctx.arc(wx, wy, 6, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Header Title
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 12px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText(`GRAIN PATCH (${this.feedStock}/${this.maxStock})`, this.x, this.y - 55);

        this.hirePad.draw(ctx);
        if (!this.isExtraPlotUnlocked) {
            this.extraPlotPad.draw(ctx);
        }
    }
}

class CoopStation {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.feedTrough = 0;
        this.maxFeed = 30;
        this.eggStock = 0;
        this.maxEggs = 40;
        this.layTimer = 0;
        this.transferTimer = 0;
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
        // Fast instant egg production when feed is present
        if (this.feedTrough > 0 && this.eggStock < this.maxEggs) {
            this.layTimer += dt;
            if (this.layTimer >= 0.4) {
                this.feedTrough -= 1;
                this.eggStock += 1;
                this.layTimer = 0;
            }
        }

        // Broad Zone Interaction: Standing anywhere inside coop zone feeds wheat AND collects eggs instantly!
        if (player && Math.hypot(player.x - this.x, player.y - this.y) <= 85) {
            this.transferTimer += dt;
            if (this.transferTimer >= 0.08) {
                // Deposit feed from stack
                if (this.feedTrough < this.maxFeed && player.removeItem('wheat')) {
                    this.feedTrough += 1;
                }
                // Collect eggs into stack
                if (this.eggStock > 0 && player.addItem('egg')) {
                    this.eggStock -= 1;
                }
                this.transferTimer = 0;
            }
        }
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

        // Status Badge Pill
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(this.x - 75, this.y + 28, 150, 20);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - 75, this.y + 28, 150, 20);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 10px Outfit';
        ctx.fillText(`FEED: ${this.feedTrough}/${this.maxFeed} | EGGS: ${this.eggStock}/${this.maxEggs}`, this.x, this.y + 42);
    }
}

class MarketStall {
    constructor(x, y) {
        this.x = x;
        this.y = y;

        // Physical inventory stock counters
        this.stock = {
            wheat: 0,
            egg: 0,
            mayo: 0,
            milk: 0,
            cheese: 0,
            artisan_cheese: 0
        };
        this.maxStockPerItem = 30;
        this.worker = null;
        this.transferTimer = 0;

        // Upgrade / Hire Pad in front
        this.hirePad = new ActionPad('hire_sales_worker', 'Hire Stocker ($100)', x, y + 85, 32, 100, 0.5, () => {
            if (!this.worker) {
                this.worker = spawnRouteHelper('sales_worker', 'Egg Seller',
                    { x: game.coopStation.x, y: game.coopStation.y, stationRef: game.coopStation },
                    { x: this.x, y: this.y, stationRef: this },
                    'egg'
                );
                economy.workersHiredCount++;
                this.hirePad.name = 'Wheelbarrow ($200)';
                this.hirePad.cost = 200;
                this.hirePad.icon = '🛒';
                this.hirePad.isPurchased = false;
            } else if (this.worker.level === 1) {
                this.worker.upgrade();
                this.hirePad.name = 'Forklift ($500)';
                this.hirePad.cost = 500;
                this.hirePad.icon = '🚜';
                this.hirePad.isPurchased = false;
            } else if (this.worker.level === 2) {
                this.worker.upgrade();
                this.hirePad.isPurchased = true;
            }
        }, '🧑‍💼');
    }

    receiveItemFromWorker(item) {
        if (this.stock[item] < this.maxStockPerItem) {
            this.stock[item] += 1;
            createFloatingText(`+1 ${item.toUpperCase()}`, this.x, this.y - 45, '#38bdf8');
            return true;
        }
        return false;
    }

    fulfillCustomerOrder(desiredItem) {
        if (this.stock[desiredItem] > 0) {
            this.stock[desiredItem] -= 1;

            let price = 20; // Default Egg
            if (desiredItem === 'wheat') price = 10;
            if (desiredItem === 'mayo') price = 50;
            if (desiredItem === 'milk') price = 40;
            if (desiredItem === 'cheese') price = 100;
            if (desiredItem === 'artisan_cheese') price = 250;

            economy.addMoney(price);
            createFloatingText(`+$${price}`, this.x, this.y - 50, '#10b981');
            return true;
        }
        return false;
    }

    giveItemToWorker(type) { return null; }

    update(dt, player) {
        // Broad Zone Interaction: Standing anywhere at market stall automatically stocks items from player stack into market inventory!
        if (player && Math.hypot(player.x - this.x, player.y - this.y) <= 85) {
            this.transferTimer += dt;
            if (this.transferTimer >= 0.08) {
                const item = player.removeItem();
                if (item) {
                    if (this.stock[item] < this.maxStockPerItem) {
                        this.stock[item] += 1;
                        createFloatingText(`+1 ${item.toUpperCase()} Stocked`, player.x, player.y - 25, '#38bdf8');
                    } else {
                        player.carryStack.push(item);
                    }
                }
                this.transferTimer = 0;
            }
        }

        this.hirePad.update(dt, player);
    }

    draw(ctx) {
        // Stall Structure
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(this.x - 70, this.y - 40, 140, 60);
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(this.x - 75, this.y - 50, 150, 14);

        // Header Title ABOVE awning
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 12px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('ROADSIDE MARKET (SHELVED STOCKS)', this.x, this.y - 58);

        // Render Inventory Shelf Display Pill below stall
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(this.x - 90, this.y + 25, 180, 22);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - 90, this.y + 25, 180, 22);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 10px Outfit';
        ctx.fillText(`EGGS: ${this.stock.egg} | MAYO: ${this.stock.mayo}`, this.x, this.y + 39);

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
        this.transferTimer = 0;
        this.worker = null;

        this.unlockPad = new ActionPad('unlock_mayo', 'Unlock Mayo Factory ($400)', x, y, 40, 400, 1.0, () => {
            this.isUnlocked = true;
            showToast('🏭 Mayo Factory Unlocked! Customers can now request Mayo.', 'success');
        }, '🏭');

        this.hirePad = new ActionPad('hire_mayo_worker', 'Hire Mayo Worker ($250)', x, y + 85, 30, 250, 0.5, () => {
            if (!this.worker) {
                this.worker = spawnRouteHelper('mayo_worker', 'Mayo Helper',
                    { x: game.coopStation.x, y: game.coopStation.y, stationRef: game.coopStation },
                    { x: this.x, y: this.y, stationRef: this },
                    'egg'
                );
                economy.workersHiredCount++;
                this.hirePad.name = 'Wheelbarrow ($400)';
                this.hirePad.cost = 400;
                this.hirePad.icon = '🛒';
                this.hirePad.isPurchased = false;
            } else if (this.worker.level === 1) {
                this.worker.upgrade();
                this.hirePad.name = 'Forklift ($800)';
                this.hirePad.cost = 800;
                this.hirePad.icon = '🚜';
                this.hirePad.isPurchased = false;
            } else if (this.worker.level === 2) {
                this.worker.upgrade();
                this.hirePad.isPurchased = true;
            }
        }, '🧑‍🔧');
    }

    receiveItemFromWorker(item) {
        if (item === 'egg' && this.inputEggs < 20) {
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

        // Instant fast processing
        if (this.inputEggs > 0 && this.outputMayo < 30) {
            this.processTimer += dt;
            if (this.processTimer >= 0.4) {
                this.inputEggs -= 1;
                this.outputMayo += 1;
                this.processTimer = 0;
            }
        }

        // Broad Zone Interaction: Standing anywhere inside Mayo factory zone deposits eggs AND collects mayo!
        if (player && Math.hypot(player.x - this.x, player.y - this.y) <= 85) {
            this.transferTimer += dt;
            if (this.transferTimer >= 0.08) {
                if (this.inputEggs < 20 && player.removeItem('egg')) {
                    this.inputEggs += 1;
                }
                if (this.outputMayo > 0 && player.addItem('mayo')) {
                    this.outputMayo -= 1;
                }
                this.transferTimer = 0;
            }
        }

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
        ctx.fillText('MAYO FACTORY ($50/jar)', this.x, this.y - 20);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(this.x - 70, this.y + 25, 140, 18);
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 10px Outfit';
        ctx.fillText(`EGGS: ${this.inputEggs}/20 | MAYO: ${this.outputMayo}/30`, this.x, this.y + 37);

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
        this.transferTimer = 0;
        this.worker = null;

        this.unlockPad = new ActionPad('unlock_cows', 'Unlock Cows ($1200)', x, y, 40, 1200, 1.0, () => {
            this.isUnlocked = true;
            showToast('🐄 Cow Pasture Unlocked! Fresh Milk production ready.', 'success');
        }, '🐄');

        this.hirePad = new ActionPad('hire_cow_worker', 'Hire Feeder ($450)', x, y + 85, 30, 450, 0.5, () => {
            if (!this.worker) {
                this.worker = spawnRouteHelper('cow_feeder', 'Cow Feeder',
                    { x: game.grainStation.x, y: game.grainStation.y, stationRef: game.grainStation },
                    { x: this.x, y: this.y, stationRef: this },
                    'wheat'
                );
                economy.workersHiredCount++;
                this.hirePad.name = 'Wheelbarrow ($700)';
                this.hirePad.cost = 700;
                this.hirePad.icon = '🛒';
                this.hirePad.isPurchased = false;
            } else if (this.worker.level === 1) {
                this.worker.upgrade();
                this.hirePad.name = 'Forklift ($1200)';
                this.hirePad.cost = 1200;
                this.hirePad.icon = '🚜';
                this.hirePad.isPurchased = false;
            } else if (this.worker.level === 2) {
                this.worker.upgrade();
                this.hirePad.isPurchased = true;
            }
        }, '🧑‍🌾');
    }

    receiveItemFromWorker(item) {
        if (item === 'wheat' && this.feedStock < 25) {
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

        // Instant fast milk production
        if (this.feedStock > 0 && this.milkStock < 30) {
            this.milkTimer += dt;
            if (this.milkTimer >= 0.4) {
                this.feedStock -= 1;
                this.milkStock += 1;
                this.milkTimer = 0;
            }
        }

        // Broad Zone Interaction: Standing anywhere inside cow pasture feeds wheat AND collects milk!
        if (player && Math.hypot(player.x - this.x, player.y - this.y) <= 85) {
            this.transferTimer += dt;
            if (this.transferTimer >= 0.08) {
                if (this.feedStock < 25 && player.removeItem('wheat')) {
                    this.feedStock += 1;
                }
                if (this.milkStock > 0 && player.addItem('milk')) {
                    this.milkStock -= 1;
                }
                this.transferTimer = 0;
            }
        }

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
        ctx.fillText(`FEED: ${this.feedStock}/25 | MILK: ${this.milkStock}/30`, this.x, this.y + 37);

        this.hirePad.draw(ctx);
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
        this.transferTimer = 0;
        this.worker = null;

        this.unlockPad = new ActionPad('unlock_cheese', 'Unlock Cheese Vat ($3000)', x, y, 42, 3000, 1.0, () => {
            this.isUnlocked = true;
            showToast('🧀 Cheese Aging Vat Unlocked! Premium Artisanal Cheese ready.', 'success');
        }, '🧀');

        this.hirePad = new ActionPad('hire_cheese_worker', 'Hire Transporter ($1000)', x, y + 85, 30, 1000, 0.5, () => {
            if (!this.worker) {
                this.worker = spawnRouteHelper('cheese_worker', 'Milk Transporter',
                    { x: game.cowStation.x, y: game.cowStation.y, stationRef: game.cowStation },
                    { x: this.x, y: this.y, stationRef: this },
                    'milk'
                );
                economy.workersHiredCount++;
                this.hirePad.name = 'Wheelbarrow ($1500)';
                this.hirePad.cost = 1500;
                this.hirePad.icon = '🛒';
                this.hirePad.isPurchased = false;
            } else if (this.worker.level === 1) {
                this.worker.upgrade();
                this.hirePad.name = 'Forklift ($2500)';
                this.hirePad.cost = 2500;
                this.hirePad.icon = '🚜';
                this.hirePad.isPurchased = false;
            } else if (this.worker.level === 2) {
                this.worker.upgrade();
                this.hirePad.isPurchased = true;
            }
        }, '🧑‍🍳');
    }

    receiveItemFromWorker(item) {
        if (item === 'milk' && this.inputMilk < 15) {
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

        // Instant fast cheese processing
        if (this.inputMilk > 0 && this.plainCheese < 25) {
            this.processTimer += dt;
            if (this.processTimer >= 0.4) {
                this.inputMilk -= 1;
                this.plainCheese += 1;
                this.processTimer = 0;
            }
        }

        if (this.plainCheese > 0 && this.artisanCheese < 10) {
            if (Math.random() < 0.15) {
                this.plainCheese -= 1;
                this.artisanCheese += 1;
            }
        }

        // Broad Zone Interaction: Standing anywhere inside Cheese vat deposits milk AND collects cheese!
        if (player && Math.hypot(player.x - this.x, player.y - this.y) <= 85) {
            this.transferTimer += dt;
            if (this.transferTimer >= 0.08) {
                if (this.inputMilk < 20 && player.removeItem('milk')) {
                    this.inputMilk += 1;
                }
                if (this.artisanCheese > 0) {
                    if (player.addItem('artisan_cheese')) this.artisanCheese -= 1;
                } else if (this.plainCheese > 0) {
                    if (player.addItem('cheese')) this.plainCheese -= 1;
                }
                this.transferTimer = 0;
            }
        }

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
        ctx.fillText(`MILK: ${this.inputMilk}/15 | CHEESE: ${this.plainCheese}`, this.x, this.y + 35);
        ctx.fillText(`ARTISANAL ($250): ${this.artisanCheese}`, this.x, this.y + 46);

        this.depositPad.draw(ctx);
        this.collectPad.draw(ctx);
        this.hirePad.draw(ctx);
    }
}

class BankDesk {
    constructor(x, y) {
        this.x = x;
        this.y = y;

        // Action Pad placed cleanly in front (y + 75)
        this.payPad = new ActionPad('pay_loan', 'Pay $500 Debt', x, y + 75, 36, 0, 0.6, () => {
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
