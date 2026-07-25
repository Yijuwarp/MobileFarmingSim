/* ==========================================================================
   FARM EMPIRE - Game Entities (Player, Dedicated Route Helpers, Customers, Particles)
   ========================================================================== */

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 20;
        this.speed = 220; // Pixels per second
        this.capacity = 10; // Fixed player capacity of 10 items
        this.carryStack = []; // Array of item types: 'wheat', 'egg', 'mayo', 'milk', 'cheese', 'artisan_cheese'
        this.vx = 0;
        this.vy = 0;
        this.facing = 'down';
        this.walkCycle = 0;
    }

    reset(x, y) {
        this.x = x;
        this.y = y;
        this.capacity = 10;
        this.speed = 220;
        this.carryStack = [];
    }

    update(dt, inputDir) {
        if (inputDir.x !== 0 || inputDir.y !== 0) {
            // Normalize direction vector
            const len = Math.hypot(inputDir.x, inputDir.y);
            const dx = inputDir.x / len;
            const dy = inputDir.y / len;

            this.vx = dx * this.speed;
            this.vy = dy * this.speed;

            this.x += this.vx * dt;
            this.y += this.vy * dt;

            // Facing direction
            if (Math.abs(dx) > Math.abs(dy)) {
                this.facing = dx > 0 ? 'right' : 'left';
            } else {
                this.facing = dy > 0 ? 'down' : 'up';
            }

            this.walkCycle += dt * 10;
        } else {
            this.vx = 0;
            this.vy = 0;
        }
    }

    canPickItem() {
        return this.carryStack.length < this.capacity;
    }

    addItem(type) {
        if (this.canPickItem()) {
            this.carryStack.push(type);
            soundManager.playPickup();
            return true;
        }
        return false;
    }

    removeItem(type = null) {
        if (this.carryStack.length === 0) return null;

        if (type) {
            const index = this.carryStack.lastIndexOf(type);
            if (index !== -1) {
                const item = this.carryStack.splice(index, 1)[0];
                soundManager.playDropoff();
                return item;
            }
            return null;
        } else {
            const item = this.carryStack.pop();
            soundManager.playDropoff();
            return item;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Player Shadow
        ctx.beginPath();
        ctx.ellipse(0, 14, 18, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fill();

        // Player Body Bobbing
        const bob = Math.sin(this.walkCycle) * 3;

        // Player Body (Farmer Overalls)
        ctx.beginPath();
        ctx.arc(0, -5 + bob, 16, 0, Math.PI * 2);
        ctx.fillStyle = '#3b82f6'; // Blue overalls
        ctx.fill();
        ctx.strokeStyle = '#1e3a8a';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Farmer Straw Hat
        ctx.beginPath();
        ctx.ellipse(0, -18 + bob, 22, 10, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b'; // Gold hat brim
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -22 + bob, 11, 0, Math.PI * 2);
        ctx.fillStyle = '#d97706'; // Crown
        ctx.fill();

        // Capacity Indicator Above Head
        ctx.restore();
        this.drawCarriedItemsStack(ctx, bob);
    }

    drawCarriedItemsStack(ctx, bob) {
        if (this.carryStack.length === 0) return;

        const startY = this.y - 30 + bob;
        this.carryStack.forEach((item, idx) => {
            // Stack items in a neat slightly overlapping vertical column
            const itemY = startY - (idx * 10);
            const wiggle = Math.sin(this.walkCycle + idx) * 2;

            drawItemIcon(ctx, item, this.x + wiggle, itemY, 14);
        });

        // Stack size badge
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(this.x + 22, this.y - 30, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 10px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${this.carryStack.length}/${this.capacity}`, this.x + 22, this.y - 30);
    }
}

/* --------------------------------------------------------------------------
   Dedicated Route Helper NPC
   -------------------------------------------------------------------------- */
/* --------------------------------------------------------------------------
   Dedicated Route Helper NPC (Tier 1 Walker -> Tier 2 Wheelbarrow -> Tier 3 Forklift)
   -------------------------------------------------------------------------- */
class RouteHelper {
    constructor(id, name, sourcePos, destPos, itemType, playerSpeed) {
        this.id = id;
        this.name = name;
        this.sourcePos = sourcePos; // {x, y, stationRef}
        this.destPos = destPos;     // {x, y, stationRef}
        this.itemType = itemType;
        this.playerSpeed = playerSpeed;

        this.x = sourcePos.x;
        this.y = sourcePos.y;
        this.target = 'dest'; // Starts at source -> moves to dest
        this.level = 1; // 1 = Walker (3 cap), 2 = Wheelbarrow (5 cap), 3 = Forklift (10 cap)
        this.capacity = 3;
        this.speed = playerSpeed * 0.7;
        this.carryStack = [];
        this.walkCycle = 0;
        this.state = 'walking'; // 'walking', 'waiting'
        this.waitTimer = 0;

        // Immediately pick up items from source station upon spawn!
        this.initialPickup();
    }

    initialPickup() {
        if (this.sourcePos && this.sourcePos.stationRef) {
            while (this.carryStack.length < this.capacity) {
                const picked = this.sourcePos.stationRef.giveItemToWorker(this.itemType);
                if (picked) {
                    this.carryStack.push(picked);
                } else {
                    break;
                }
            }
        }
    }

    upgrade() {
        if (this.level < 3) {
            this.level++;
            if (this.level === 2) {
                this.capacity = 5;
                this.speed = this.playerSpeed * 1.2;
                createFloatingText('🛒 WHEELBARROW UNLOCKED (5 Cap)!', this.x, this.y - 45, '#38bdf8');
            } else if (this.level === 3) {
                this.capacity = 10;
                this.speed = this.playerSpeed * 1.8;
                createFloatingText('🚜 FORKLIFT UNLOCKED (10 Cap)!', this.x, this.y - 45, '#f59e0b');
            }
        }
    }

    update(dt) {
        if (this.state === 'waiting') {
            this.waitTimer -= dt;
            if (this.waitTimer <= 0) {
                this.state = 'walking';
            }
            return;
        }

        const targetPos = this.target === 'dest' ? this.destPos : this.sourcePos;
        const dx = targetPos.x - this.x;
        const dy = targetPos.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 10) {
            // Reached Station Node
            this.handleStationArrival();
        } else {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
            this.walkCycle += dt * 8;
        }
    }

    handleStationArrival() {
        if (this.target === 'dest') {
            // Arrived at destination station -> Deposit carried items
            while (this.carryStack.length > 0) {
                const itemToDeposit = this.carryStack[this.carryStack.length - 1];
                const deposited = this.destPos.stationRef.receiveItemFromWorker(itemToDeposit);
                if (deposited) {
                    this.carryStack.pop();
                    soundManager.playDropoff();
                } else {
                    break; // Station shelf full
                }
            }
            this.target = 'source';
            this.state = 'waiting';
            this.waitTimer = 0.2; // Fast pause at station
        } else {
            // Arrived at source station -> Pick items up to capacity
            while (this.carryStack.length < this.capacity) {
                const picked = this.sourcePos.stationRef.giveItemToWorker(this.itemType);
                if (picked) {
                    this.carryStack.push(picked);
                    soundManager.playPickup();
                } else {
                    break; // Source empty
                }
            }
            this.target = 'dest';
            this.state = 'waiting';
            this.waitTimer = 0.2;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const bob = Math.sin(this.walkCycle) * 2;

        if (this.level === 1) {
            // Level 1: Walker (3 capacity)
            ctx.beginPath();
            ctx.ellipse(0, 10, 14, 6, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fill();

            // Helper Body
            ctx.beginPath();
            ctx.arc(0, -4 + bob, 12, 0, Math.PI * 2);
            ctx.fillStyle = '#10b981';
            ctx.fill();
            ctx.strokeStyle = '#047857';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Cap
            ctx.beginPath();
            ctx.ellipse(0, -14 + bob, 14, 6, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#6ee7b7';
            ctx.fill();

            // Badge
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.fillRect(-32, -42, 64, 14);
            ctx.fillStyle = '#10b981';
            ctx.font = '900 8px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText(`WALKER (${this.carryStack.length}/3)`, 0, -32);

            ctx.restore();

            // Draw carried stack above head
            this.carryStack.forEach((item, idx) => {
                drawItemIcon(ctx, item, this.x, this.y - 48 - (idx * 10) + bob, 14);
            });

        } else if (this.level === 2) {
            // Level 2: Wheelbarrow Worker (5 capacity)
            ctx.beginPath();
            ctx.ellipse(0, 12, 22, 8, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            ctx.fill();

            // Wheelbarrow tub
            ctx.fillStyle = '#b45309';
            ctx.fillRect(-16, -6, 32, 16);
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 2;
            ctx.strokeRect(-16, -6, 32, 16);

            // Wheel
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(16, 8, 6, 0, Math.PI * 2);
            ctx.fill();

            // Worker body behind wheelbarrow
            ctx.beginPath();
            ctx.arc(-14, -10 + bob, 10, 0, Math.PI * 2);
            ctx.fillStyle = '#10b981';
            ctx.fill();

            // Badge
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.fillRect(-35, -38, 70, 14);
            ctx.fillStyle = '#38bdf8';
            ctx.font = '900 8px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText(`WHEELBARROW (${this.carryStack.length}/5)`, 0, -28);

            ctx.restore();

            // Draw items inside wheelbarrow tub
            this.carryStack.forEach((item, idx) => {
                drawItemIcon(ctx, item, this.x - 10 + (idx * 6), this.y - 2, 12);
            });

        } else if (this.level === 3) {
            // Level 3: Forklift Vehicle (10 capacity)
            ctx.beginPath();
            ctx.ellipse(0, 14, 26, 10, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fill();

            // Yellow Forklift Body
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(-22, -18, 44, 24);
            ctx.fillStyle = '#d97706';
            ctx.fillRect(-22, -18, 12, 24); // Rear engine cabin

            // Black Wheels
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(-14, 8, 7, 0, Math.PI * 2);
            ctx.arc(14, 8, 7, 0, Math.PI * 2);
            ctx.fill();

            // Lifting Mast
            ctx.fillStyle = '#64748b';
            ctx.fillRect(18, -32, 4, 38);

            // Badge
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.fillRect(-36, -46, 72, 14);
            ctx.fillStyle = '#f59e0b';
            ctx.font = '900 8px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText(`FORKLIFT (${this.carryStack.length}/10)`, 0, -36);

            ctx.restore();

            // Draw stacked items on forklift front pallet
            this.carryStack.forEach((item, idx) => {
                const px = this.x + 26;
                const py = this.y - 2 - (idx * 8);
                drawItemIcon(ctx, item, px, py, 14);
            });
        }
    }
}

/* --------------------------------------------------------------------------
   Market Customer NPC (Queue & Patience Bar)
   -------------------------------------------------------------------------- */
class Customer {
    constructor(x, y, stallX, stallY, desiredItem, queueIndex = 0) {
        this.x = x;
        this.y = y;
        this.stallX = stallX;
        this.stallY = stallY;
        this.queueIndex = queueIndex;
        this.speed = 120;
        this.state = 'approaching'; // 'approaching', 'waiting', 'leaving'
        this.desiredItem = desiredItem;
        this.maxPatience = 18; // 18 seconds for player to intervene
        this.patience = this.maxPatience;
        this.walkCycle = 0;
        this.isDone = false;
        this.isSatisfied = false;
        this.shirtColor = ['#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#a855f7'][Math.floor(Math.random() * 5)];
    }

    getTargetPosition() {
        // Line up horizontally in front of the market stall
        const queueOffsetX = (this.queueIndex - 1.5) * 36;
        return {
            x: this.stallX + queueOffsetX,
            y: this.stallY + 65
        };
    }

    update(dt, stall) {
        const target = this.getTargetPosition();

        if (this.state === 'approaching') {
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 8) {
                this.x = target.x;
                this.y = target.y;
                this.state = 'waiting';
            } else {
                this.x += (dx / dist) * this.speed * dt;
                this.y += (dy / dist) * this.speed * dt;
                this.walkCycle += dt * 8;
            }
        } else if (this.state === 'waiting') {
            // Adjust smooth position if queueIndex updated
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            if (Math.hypot(dx, dy) > 2) {
                this.x += dx * dt * 5;
                this.y += dy * dt * 5;
            }

            this.patience -= dt;

            // Attempt to buy desired item from market inventory
            const bought = stall.fulfillCustomerOrder(this.desiredItem);
            if (bought) {
                this.state = 'leaving';
                this.isSatisfied = true;
                createFloatingText(`😊 Cash Paid!`, this.x, this.y - 45, '#10b981');
            } else if (this.patience <= 0) {
                this.state = 'leaving'; // Leaves frustrated
                this.isSatisfied = false;
                createFloatingText(`😠 Out of stock!`, this.x, this.y - 45, '#ef4444');
            }
        } else if (this.state === 'leaving') {
            this.y += this.speed * dt;
            this.walkCycle += dt * 8;
            if (this.y > this.stallY + 350) {
                this.isDone = true;
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const bob = Math.sin(this.walkCycle) * 2;

        // Customer Body
        ctx.beginPath();
        ctx.arc(0, -4 + bob, 12, 0, Math.PI * 2);
        ctx.fillStyle = this.shirtColor;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Customer Head
        ctx.beginPath();
        ctx.arc(0, -16 + bob, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#fde047';
        ctx.fill();

        if (this.state === 'waiting' || this.state === 'approaching') {
            // Desired item speech bubble
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(14, -30, 13, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            drawItemIcon(ctx, this.desiredItem, 14, -30, 14);

            // Patience Bar above head
            const barWidth = 28;
            const barHeight = 4;
            const barX = -barWidth / 2;
            const barY = -44;
            const patienceRatio = Math.max(0, this.patience / this.maxPatience);

            ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
            ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

            let barColor = '#10b981'; // Green
            if (patienceRatio < 0.5) barColor = '#f59e0b'; // Yellow
            if (patienceRatio < 0.25) barColor = '#ef4444'; // Red

            ctx.fillStyle = barColor;
            ctx.fillRect(barX, barY, barWidth * patienceRatio, barHeight);
        }

        ctx.restore();
    }
}

/* --------------------------------------------------------------------------
   Floating Text Particles (+ $15, +1 Feed)
   -------------------------------------------------------------------------- */
class FloatingText {
    constructor(text, x, y, color = '#f59e0b') {
        this.text = text;
        this.x = x;
        this.y = y;
        this.color = color;
        this.life = 1.0; // 1 second float
    }

    update(dt) {
        this.y -= 30 * dt;
        this.life -= dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.font = '900 16px Outfit';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

/* Helper function to render color-coded icon badges */
function drawItemIcon(ctx, type, x, y, size = 16) {
    ctx.save();
    ctx.translate(x, y);

    const half = size / 2;

    switch (type) {
        case 'wheat':
            ctx.fillStyle = '#f59e0b'; // Gold
            ctx.beginPath();
            ctx.ellipse(0, 0, half, half * 0.7, Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'egg':
            ctx.fillStyle = '#f8fafc'; // White egg
            ctx.beginPath();
            ctx.ellipse(0, 0, half * 0.7, half, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'mayo':
            ctx.fillStyle = '#fef08a'; // Yellow jar
            ctx.fillRect(-half * 0.7, -half, size * 0.7, size);
            ctx.fillStyle = '#eab308'; // Lid
            ctx.fillRect(-half * 0.7, -half, size * 0.7, 4);
            break;
        case 'milk':
            ctx.fillStyle = '#38bdf8'; // Blue bottle
            ctx.fillRect(-half * 0.6, -half * 0.8, size * 0.6, size * 0.9);
            ctx.fillStyle = '#ffffff'; // White label
            ctx.fillRect(-half * 0.6, -half * 0.2, size * 0.6, 6);
            break;
        case 'cheese':
            ctx.fillStyle = '#fbbf24'; // Cheese wedge
            ctx.beginPath();
            ctx.moveTo(-half, half);
            ctx.lineTo(half, half);
            ctx.lineTo(0, -half);
            ctx.closePath();
            ctx.fill();
            break;
        case 'artisan_cheese':
            ctx.fillStyle = '#d97706'; // Gold artisan block
            ctx.fillRect(-half, -half, size, size);
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(0, 0, half * 0.5, 0, Math.PI * 2);
            ctx.fill();
            break;
        default:
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, half, 0, Math.PI * 2);
            ctx.fill();
    }
    ctx.restore();
}
