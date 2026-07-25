/* ==========================================================================
   FARM EMPIRE - Game Entities (Player, Dedicated Route Helpers, Customers, Particles)
   ========================================================================== */

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 20;
        this.speed = 220; // Pixels per second
        this.capacity = 5; // Max items carried
        this.carryStack = []; // Array of item types: 'wheat', 'egg', 'mayo', 'milk', 'cheese', 'artisan_cheese'
        this.vx = 0;
        this.vy = 0;
        this.facing = 'down';
        this.walkCycle = 0;
    }

    reset(x, y) {
        this.x = x;
        this.y = y;
        this.capacity = 5;
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

        const startY = this.y - 32 + bob;
        this.carryStack.forEach((item, idx) => {
            const itemY = startY - (idx * 14);
            const wiggle = Math.sin(this.walkCycle + idx) * 2;

            drawItemIcon(ctx, item, this.x + wiggle, itemY);
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
class RouteHelper {
    constructor(id, name, sourcePos, destPos, itemType, playerSpeed) {
        this.id = id;
        this.name = name;
        this.sourcePos = sourcePos; // {x, y, stationRef}
        this.destPos = destPos;     // {x, y, stationRef}
        this.itemType = itemType;
        this.speed = playerSpeed * 0.33; // Exactly 1/3 of player speed!

        this.x = sourcePos.x;
        this.y = sourcePos.y;
        this.target = 'dest'; // 'source' or 'dest'
        this.carriedItem = null;
        this.capacity = 1; // Carries 1 item at a time per route
        this.walkCycle = 0;
        this.state = 'walking'; // 'walking', 'waiting'
        this.waitTimer = 0;
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
            this.walkCycle += dt * 6;
        }
    }

    handleStationArrival() {
        if (this.target === 'dest') {
            // Arrived at destination station -> Deposit item
            if (this.carriedItem) {
                const deposited = this.destPos.stationRef.receiveItemFromWorker(this.carriedItem);
                if (deposited) {
                    this.carriedItem = null;
                    soundManager.playDropoff();
                }
            }
            this.target = 'source';
            this.state = 'waiting';
            this.waitTimer = 0.5; // Short pause at station
        } else {
            // Arrived at source station -> Pick item
            if (!this.carriedItem) {
                const picked = this.sourcePos.stationRef.giveItemToWorker(this.itemType);
                if (picked) {
                    this.carriedItem = picked;
                    soundManager.playPickup();
                }
            }
            this.target = 'dest';
            this.state = 'waiting';
            this.waitTimer = 0.5;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Helper Shadow
        ctx.beginPath();
        ctx.ellipse(0, 10, 14, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fill();

        const bob = Math.sin(this.walkCycle) * 2;

        // Helper Body (Green Apron)
        ctx.beginPath();
        ctx.arc(0, -4 + bob, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981'; // Helper Emerald Green
        ctx.fill();
        ctx.strokeStyle = '#047857';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Helper Cap
        ctx.beginPath();
        ctx.ellipse(0, -14 + bob, 14, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#6ee7b7';
        ctx.fill();

        // Helper Label Badge (Floats cleanly above cap)
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(-26, -42, 52, 14);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-26, -42, 52, 14);

        ctx.fillStyle = '#10b981';
        ctx.font = '900 8px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HELPER 1/3', 0, -35);

        ctx.restore();

        // Draw Carried Item Above Helper
        if (this.carriedItem) {
            drawItemIcon(ctx, this.carriedItem, this.x, this.y - 50 + bob);
        }
    }
}

/* --------------------------------------------------------------------------
   Market Customer NPC
   -------------------------------------------------------------------------- */
class Customer {
    constructor(x, y, stallX, stallY) {
        this.x = x;
        this.y = y;
        this.stallX = stallX;
        this.stallY = stallY;
        this.speed = 100;
        this.state = 'approaching'; // 'approaching', 'buying', 'leaving'
        this.desiredItem = Math.random() > 0.4 ? 'mayo' : 'egg';
        this.patience = 12; // Seconds
        this.walkCycle = 0;
        this.isDone = false;
    }

    update(dt, stall) {
        if (this.state === 'approaching') {
            const dx = this.stallX - this.x;
            const dy = (this.stallY + 40) - this.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 10) {
                this.state = 'buying';
            } else {
                this.x += (dx / dist) * this.speed * dt;
                this.y += (dy / dist) * this.speed * dt;
                this.walkCycle += dt * 8;
            }
        } else if (this.state === 'buying') {
            this.patience -= dt;
            const bought = stall.sellToCustomer(this.desiredItem);
            if (bought) {
                this.state = 'leaving';
            } else if (this.patience <= 0) {
                this.state = 'leaving'; // Leaves frustrated
            }
        } else if (this.state === 'leaving') {
            this.y += this.speed * dt;
            this.walkCycle += dt * 8;
            if (this.y > this.stallY + 400) {
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
        ctx.fillStyle = '#8b5cf6'; // Purple shirt
        ctx.fill();

        // Customer Head
        ctx.beginPath();
        ctx.arc(0, -16 + bob, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#fde047';
        ctx.fill();

        // Desired item speech bubble
        if (this.state === 'buying') {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(16, -26, 12, 0, Math.PI * 2);
            ctx.fill();
            drawItemIcon(ctx, this.desiredItem, 16, -26, 12);
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
