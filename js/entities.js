/* ==========================================================================
   FARM EMPIRE - Game Entities with Sprout Lands Pixel-Art Character Sprites
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

            // Facing direction for Sprout Lands sprite sheet
            if (Math.abs(dx) > Math.abs(dy)) {
                this.facing = dx > 0 ? 'right' : 'left';
            } else {
                this.facing = dy > 0 ? 'down' : 'up';
            }

            this.walkCycle += dt * 8;
        } else {
            this.vx = 0;
            this.vy = 0;
            this.walkCycle = 0;
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

        // 1. Player Drop Shadow
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 14, 16, 7, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();

        // 2. Render Sprout Lands Farmer Character Sprite Sheet
        const sprChar = assets.get('char');
        if (sprChar && sprChar.complete) {
            // Facing row: 0=down, 1=up, 2=left, 3=right
            let facingRow = 0;
            if (this.facing === 'up') facingRow = 1;
            else if (this.facing === 'left') facingRow = 2;
            else if (this.facing === 'right') facingRow = 3;

            const frame = Math.floor(this.walkCycle) % 4;
            const srcX = frame * 48;
            const srcY = facingRow * 48;

            ctx.drawImage(sprChar, srcX, srcY, 48, 48, this.x - 30, this.y - 42, 60, 60);
        } else {
            // Fallback circle farmer
            const bob = Math.sin(this.walkCycle) * 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y - 5 + bob, 16, 0, Math.PI * 2);
            ctx.fillStyle = '#3b82f6';
            ctx.fill();
        }

        ctx.restore();

        // 3. Render Stack of Carried Items
        const bob = Math.sin(this.walkCycle) * 2;
        this.drawCarriedItemsStack(ctx, bob);
    }

    drawCarriedItemsStack(ctx, bob) {
        if (this.carryStack.length === 0) return;

        const startY = this.y - 40 + bob;
        this.carryStack.forEach((item, idx) => {
            const itemY = startY - (idx * 14);
            const wiggle = Math.sin(this.walkCycle + idx) * 2;

            drawItemIcon(ctx, item, this.x + wiggle, itemY);
        });

        // Stack size badge
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(this.x + 22, this.y - 35, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 10px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${this.carryStack.length}/${this.capacity}`, this.x + 22, this.y - 35);
    }
}

/* --------------------------------------------------------------------------
   Dedicated Route Helper NPC (Sprout Lands Styled)
   -------------------------------------------------------------------------- */
class RouteHelper {
    constructor(id, name, sourcePos, destPos, itemType, playerSpeed) {
        this.id = id;
        this.name = name;
        this.sourcePos = sourcePos;
        this.destPos = destPos;
        this.itemType = itemType;
        this.speed = playerSpeed * 0.33;

        this.x = sourcePos.x;
        this.y = sourcePos.y;
        this.target = 'dest';
        this.carriedItem = null;
        this.capacity = 1;
        this.facing = 'down';
        this.walkCycle = 0;
        this.state = 'walking';
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
            this.handleStationArrival();
        } else {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;

            if (Math.abs(dx) > Math.abs(dy)) {
                this.facing = dx > 0 ? 'right' : 'left';
            } else {
                this.facing = dy > 0 ? 'down' : 'up';
            }

            this.walkCycle += dt * 6;
        }
    }

    handleStationArrival() {
        if (this.target === 'dest') {
            if (this.carriedItem) {
                const deposited = this.destPos.stationRef.receiveItemFromWorker(this.carriedItem);
                if (deposited) {
                    this.carriedItem = null;
                    soundManager.playDropoff();
                }
            }
            this.target = 'source';
            this.state = 'waiting';
            this.waitTimer = 0.5;
        } else {
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

        // Helper Shadow
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 12, 14, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fill();

        // Sprout Lands Helper Sprite
        const sprChar = assets.get('char');
        if (sprChar && sprChar.complete) {
            let facingRow = 0;
            if (this.facing === 'up') facingRow = 1;
            else if (this.facing === 'left') facingRow = 2;
            else if (this.facing === 'right') facingRow = 3;

            const frame = Math.floor(this.walkCycle) % 4;
            const srcX = frame * 48;
            const srcY = facingRow * 48;

            ctx.drawImage(sprChar, srcX, srcY, 48, 48, this.x - 24, this.y - 36, 48, 48);
        }

        // Helper Label Badge
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(this.x - 26, this.y - 44, 52, 14);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - 26, this.y - 44, 52, 14);

        ctx.fillStyle = '#10b981';
        ctx.font = '900 8px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HELPER', this.x, this.y - 37);

        ctx.restore();

        // Carried Item
        if (this.carriedItem) {
            drawItemIcon(ctx, this.carriedItem, this.x, this.y - 52);
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
        this.state = 'approaching';
        this.desiredItem = Math.random() > 0.4 ? 'mayo' : 'egg';
        this.patience = 12;
        this.facing = 'down';
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

                if (Math.abs(dx) > Math.abs(dy)) {
                    this.facing = dx > 0 ? 'right' : 'left';
                } else {
                    this.facing = dy > 0 ? 'down' : 'up';
                }

                this.walkCycle += dt * 8;
            }
        } else if (this.state === 'buying') {
            this.patience -= dt;
            const bought = stall.sellToCustomer(this.desiredItem);
            if (bought) {
                this.state = 'leaving';
            } else if (this.patience <= 0) {
                this.state = 'leaving';
            }
        } else if (this.state === 'leaving') {
            this.y += this.speed * dt;
            this.facing = 'down';
            this.walkCycle += dt * 8;
            if (this.y > this.stallY + 400) {
                this.isDone = true;
            }
        }
    }

    draw(ctx) {
        ctx.save();

        // Customer Shadow
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 10, 12, 5, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fill();

        // Sprout Lands Customer Sprite
        const sprChar = assets.get('char');
        if (sprChar && sprChar.complete) {
            let facingRow = 0;
            if (this.facing === 'up') facingRow = 1;
            else if (this.facing === 'left') facingRow = 2;
            else if (this.facing === 'right') facingRow = 3;

            const frame = Math.floor(this.walkCycle) % 4;
            const srcX = frame * 48;
            const srcY = facingRow * 48;

            ctx.drawImage(sprChar, srcX, srcY, 48, 48, this.x - 24, this.y - 36, 48, 48);
        }

        // Desired item speech bubble
        if (this.state === 'buying') {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.x + 16, this.y - 30, 12, 0, Math.PI * 2);
            ctx.fill();
            drawItemIcon(ctx, this.desiredItem, this.x + 16, this.y - 30, 14);
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
        this.life = 1.0;
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
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.ellipse(0, 0, half, half * 0.7, Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'egg':
            ctx.fillStyle = '#fffbeb';
            ctx.beginPath();
            ctx.ellipse(0, 0, half * 0.7, half, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'mayo':
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(-half * 0.7, -half, size * 0.7, size);
            ctx.fillStyle = '#eab308';
            ctx.fillRect(-half * 0.7, -half, size * 0.7, 4);
            break;
        case 'milk':
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(-half * 0.6, -half * 0.8, size * 0.6, size * 0.9);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-half * 0.6, -half * 0.2, size * 0.6, 6);
            break;
        case 'cheese':
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.moveTo(-half, half);
            ctx.lineTo(half, half);
            ctx.lineTo(0, -half);
            ctx.closePath();
            ctx.fill();
            break;
        case 'artisan_cheese':
            ctx.fillStyle = '#d97706';
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
