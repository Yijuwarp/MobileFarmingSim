/* ==========================================================================
   FARM EMPIRE - Farm Stations (Pixel Art Top-Down Basic Structures & Machinery)
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
        this.pulseTimer = Math.random() * Math.PI * 2;
    }

    update(dt, player) {
        if (!this.isActive || this.isPurchased || !player) return;

        this.pulseTimer += dt * 4;

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
                engine.spawnMoneySparks(this.x, this.y, 10);
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

        const pulseScale = 1 + Math.sin(this.pulseTimer) * 0.05;

        // Ground Target Base
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * pulseScale, 0, Math.PI * 2);
        ctx.fillStyle = this.cost > 0 ? 'rgba(245, 158, 11, 0.28)' : 'rgba(56, 189, 248, 0.28)';
        ctx.fill();
        ctx.strokeStyle = this.cost > 0 ? '#fbbf24' : '#38bdf8';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Hold Progress Arc Ring
        if (this.currentHoldTime > 0) {
            const fillRatio = Math.min(1, this.currentHoldTime / this.requiredHoldTime);
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 4, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * fillRatio));
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 5;
            ctx.stroke();
        }

        // Icon
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.icon, 0, -10);

        // Label
        ctx.font = '900 9px Outfit';
        ctx.fillText(this.name, 0, 6);

        // Price Tag
        if (this.cost > 0) {
            ctx.fillStyle = '#fef08a';
            ctx.font = '900 10px Outfit';
            ctx.fillText(`$${this.cost}`, 0, 18);
        }

        ctx.restore();
    }
}

/* --------------------------------------------------------------------------
   Farm Station Modules with Pixel Art Top-Down Basic Assets
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

        this.hirePad = new ActionPad('hire_feed_worker', 'Hire Feeder ($50)', x, y + 85, 32, 50, 0.4, () => {
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

        this.extraPlotPad = new ActionPad('unlock_wheat_2', 'Unlock Plot 2 ($150)', x + 75, y + 85, 32, 150, 0.5, () => {
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
        this.growTimer += dt;
        const growthInterval = this.isExtraPlotUnlocked ? 0.2 : 0.4;
        if (this.growTimer >= growthInterval && this.feedStock < this.maxStock) {
            this.feedStock += this.isExtraPlotUnlocked ? 2 : 1;
            this.growTimer = 0;
        }

        // Broad Zone Interaction: Collect wheat into player stack
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
        ctx.save();
        const sprDirt = assets.get('dirt');
        const sprPlants = assets.get('plants');

        // Draw Tilled Soil Grid with Border
        if (sprDirt && sprDirt.complete) {
            for (let px = -60; px <= 40; px += 32) {
                for (let py = -40; py <= 20; py += 32) {
                    ctx.drawImage(sprDirt, 0, 0, 16, 16, this.x + px, this.y + py, 32, 32);
                }
            }
        } else {
            ctx.fillStyle = '#6a3b1c';
            ctx.fillRect(this.x - 70, this.y - 45, 140, 80);
            ctx.strokeStyle = '#4a2710';
            ctx.lineWidth = 3;
            ctx.strokeRect(this.x - 70, this.y - 45, 140, 80);
        }

        // Draw Swaying Golden Wheat Crops
        const now = performance.now() * 0.004;
        const renderedCrops = Math.min(this.feedStock, 15);
        for (let i = 0; i < renderedCrops; i++) {
            const wx = this.x - 55 + (i % 5) * 24;
            const wy = this.y - 35 + Math.floor(i / 5) * 24;
            const sway = Math.sin(now + i) * 3;

            if (sprPlants && sprPlants.complete) {
                ctx.drawImage(sprPlants, 32, 0, 16, 16, wx + sway, wy, 24, 24);
            } else {
                ctx.fillStyle = '#fbbf24';
                ctx.fillRect(wx + sway, wy - 8, 4, 16);
                ctx.fillStyle = '#fef08a';
                ctx.fillRect(wx + sway - 2, wy - 12, 8, 8);
            }
        }

        // Render 2nd Plot if unlocked
        if (this.isExtraPlotUnlocked) {
            if (sprDirt && sprDirt.complete) {
                for (let px = 80; px <= 140; px += 32) {
                    for (let py = -40; py <= 20; py += 32) {
                        ctx.drawImage(sprDirt, 0, 0, 16, 16, this.x + px, this.y + py, 32, 32);
                    }
                }
            } else {
                ctx.fillStyle = '#6a3b1c';
                ctx.fillRect(this.x + 75, this.y - 45, 75, 80);
                ctx.strokeStyle = '#4a2710';
                ctx.lineWidth = 3;
                ctx.strokeRect(this.x + 75, this.y - 45, 75, 80);
            }

            const extraCrops = Math.min(10, Math.max(0, this.feedStock - 15));
            for (let i = 0; i < extraCrops; i++) {
                const wx = this.x + 85 + (i % 3) * 22;
                const wy = this.y - 35 + Math.floor(i / 3) * 24;
                const sway = Math.sin(now + i + 2) * 3;

                if (sprPlants && sprPlants.complete) {
                    ctx.drawImage(sprPlants, 32, 0, 16, 16, wx + sway, wy, 22, 22);
                } else {
                    ctx.fillStyle = '#fbbf24';
                    ctx.fillRect(wx + sway, wy - 8, 4, 16);
                }
            }
        }

        // Header Title ABOVE plot
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 12px Outfit';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 4;
        ctx.fillText(`GRAIN PATCH (${this.feedStock}/${this.maxStock})`, this.x, this.y - 55);

        ctx.restore();

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
        if (this.feedTrough > 0 && this.eggStock < this.maxEggs) {
            this.layTimer += dt;
            if (this.layTimer >= 0.4) {
                this.feedTrough -= 1;
                this.eggStock += 1;
                this.layTimer = 0;
            }
        }

        // Broad Zone Interaction
        if (player && Math.hypot(player.x - this.x, player.y - this.y) <= 85) {
            this.transferTimer += dt;
            if (this.transferTimer >= 0.08) {
                if (this.feedTrough < this.maxFeed && player.removeItem('wheat')) {
                    this.feedTrough += 1;
                }
                if (this.eggStock > 0 && player.addItem('egg')) {
                    this.eggStock -= 1;
                }
                this.transferTimer = 0;
            }
        }
    }

    draw(ctx) {
        ctx.save();
        const sprHouse = assets.get('house');

        if (sprHouse && sprHouse.complete) {
            ctx.drawImage(sprHouse, 0, 0, 80, 80, this.x - 60, this.y - 65, 120, 120);
        } else {
            // Timber Wooden Coop Barn
            ctx.fillStyle = '#92400e';
            ctx.fillRect(this.x - 65, this.y - 50, 130, 75);
            ctx.fillStyle = '#b45309';
            ctx.fillRect(this.x - 55, this.y - 40, 110, 55);

            // Roof
            ctx.fillStyle = '#dc2626';
            ctx.beginPath();
            ctx.moveTo(this.x - 75, this.y - 50);
            ctx.lineTo(this.x, this.y - 80);
            ctx.lineTo(this.x + 75, this.y - 50);
            ctx.closePath();
            ctx.fill();
        }

        // Animated Pecking Chickens Inside
        const peck = Math.sin(performance.now() * 0.008) * 3;
        ctx.fillStyle = '#fffbeb';
        ctx.beginPath();
        ctx.arc(this.x - 30 + peck, this.y - 10, 8, 0, Math.PI * 2);
        ctx.arc(this.x + peck, this.y - 5, 8, 0, Math.PI * 2);
        ctx.arc(this.x + 30 - peck, this.y - 10, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ef4444';
        ctx.fillRect(this.x - 30 + peck, this.y - 18, 3, 4);
        ctx.fillRect(this.x + peck, this.y - 13, 3, 4);
        ctx.fillRect(this.x + 30 - peck, this.y - 18, 3, 4);

        // Status Badge Pill
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(this.x - 75, this.y + 35, 150, 22);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - 75, this.y + 35, 150, 22);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 10px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText(`FEED: ${this.feedTrough}/${this.maxFeed} | EGGS: ${this.eggStock}/${this.maxEggs}`, this.x, this.y + 49);

        ctx.restore();
    }
}

class MarketStall {
    constructor(x, y) {
        this.x = x;
        this.y = y;

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

            let price = 20;
            if (desiredItem === 'wheat') price = 10;
            if (desiredItem === 'mayo') price = 50;
            if (desiredItem === 'milk') price = 40;
            if (desiredItem === 'cheese') price = 100;

            economy.addMoney(price);
            engine.spawnMoneySparks(this.x, this.y - 40, 8);
            createFloatingText(`+$${price}`, this.x, this.y - 50, '#10b981');
            return true;
        }
        return false;
    }

    giveItemToWorker(type) { return null; }

    update(dt, player) {
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
        ctx.save();
        const sprFurniture = assets.get('furniture');

        // Stall Structure
        if (sprFurniture && sprFurniture.complete) {
            ctx.drawImage(sprFurniture, 0, 0, 48, 48, this.x - 50, this.y - 45, 100, 70);
        } else {
            // Dark Wooden Counter Base
            ctx.fillStyle = '#334155';
            ctx.fillRect(this.x - 70, this.y - 40, 140, 60);

            // Striped Canvas Awning (Red & White)
            for (let i = 0; i < 7; i++) {
                ctx.fillStyle = i % 2 === 0 ? '#ef4444' : '#ffffff';
                ctx.fillRect(this.x - 70 + (i * 20), this.y - 56, 20, 16);
            }
        }

        // Header Title
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 12px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('ROADSIDE MARKET (SHELVED STOCKS)', this.x, this.y - 62);

        // Render Physical Item Stock Display Pill below stall
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(this.x - 85, this.y + 30, 170, 24);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - 85, this.y + 30, 170, 24);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 10px Outfit';
        ctx.fillText(`EGGS: ${this.stock.egg} | MAYO: ${this.stock.mayo}`, this.x, this.y + 45);

        ctx.restore();

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
        this.gearAngle = 0;

        this.unlockPad = new ActionPad('unlock_mayo', 'Unlock Mayo Factory ($400)', x, y, 40, 400, 1.0, () => {
            this.isUnlocked = true;
            showToast('🏭 Mayo Factory Unlocked! Customers can now request Mayo.', 'success');
            engine.spawnMoneySparks(this.x, this.y, 15);
        }, '🏭');

        this.hirePad = new ActionPad('hire_mayo_worker', 'Hire Mayo Worker ($250)', x, y + 85, 32, 250, 0.5, () => {
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

        if (this.inputEggs > 0 && this.outputMayo < 30) {
            this.processTimer += dt;
            this.gearAngle += dt * 5;

            if (this.processTimer >= 0.4) {
                this.inputEggs -= 1;
                this.outputMayo += 1;
                this.processTimer = 0;
                engine.spawnExhaustSmoke(this.x + 20, this.y - 30);
            }
        }

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
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.setLineDash([6, 6]);
            ctx.strokeRect(this.x - 65, this.y - 40, 130, 80);
            ctx.setLineDash([]);
            this.unlockPad.draw(ctx);
            return;
        }

        ctx.save();

        // Factory Building (Yellow Industrial Structure)
        ctx.fillStyle = '#eab308';
        ctx.fillRect(this.x - 65, this.y - 40, 130, 60);
        ctx.fillStyle = '#ca8a04';
        ctx.fillRect(this.x - 65, this.y - 40, 20, 60);

        // Animated Mechanical Blender Gear
        ctx.save();
        ctx.translate(this.x + 35, this.y - 20);
        ctx.rotate(this.gearAngle);
        ctx.fillStyle = '#475569';
        ctx.fillRect(-6, -6, 12, 12);
        ctx.restore();

        // Header Title
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 11px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('MAYO FACTORY ($50/jar)', this.x, this.y - 20);

        // Status Badge Pill
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(this.x - 70, this.y + 25, 140, 20);
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - 70, this.y + 25, 140, 20);

        ctx.fillStyle = '#ffffff';
        ctx.font = '800 10px Outfit';
        ctx.fillText(`EGGS: ${this.inputEggs}/20 | MAYO: ${this.outputMayo}/30`, this.x, this.y + 39);

        ctx.restore();

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
    }
    update(dt, player) {}
    draw(ctx) {}
}

class CheeseStation {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.isUnlocked = false;
    }
    update(dt, player) {}
    draw(ctx) {}
}

class BankDesk {
    constructor(x, y) {
        this.x = x;
        this.y = y;

        this.payPad = new ActionPad('pay_loan', 'Pay $500 Debt', x, y + 75, 36, 0, 0.6, () => {
            economy.payDownLoan(500);
        }, '🏛️');
    }

    update(dt, player) {
        this.payPad.update(dt, player);
    }

    draw(ctx) {
        ctx.save();

        // Mahogany Bank Desk
        ctx.fillStyle = '#451a03';
        ctx.fillRect(this.x - 55, this.y - 35, 110, 50);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(this.x - 55, this.y - 35, 110, 6);

        // Header Title & Debt Display
        ctx.fillStyle = '#38bdf8';
        ctx.font = '900 11px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('FARM BANK DESK', this.x, this.y - 15);
        ctx.fillStyle = '#fca5a5';
        ctx.fillText(`DEBT: $${economy.loanPrincipal}`, this.x, this.y + 5);

        ctx.restore();

        this.payPad.draw(ctx);
    }
}
