/* ==========================================================================
   FARM EMPIRE - Game Entities with Sprout Lands Pixel-Art Sprites & Worker Vehicle Progression
   ========================================================================== */

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 20;
        this.speed = 220; // Pixels per second
        this.capacity = 10; // Max items carried (Fixed 10 capacity)
        this.carryStack = []; // Array of item types: 'wheat', 'egg', 'mayo', 'milk', 'cheese'
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

        // 3. Render Stack of Carried Items (Compact stack height spacing for 10 items)
        if (this.carryStack.length > 0) {
            this.drawCarriedItemsStack(ctx);
        }
    }

    drawCarriedItemsStack(ctx) {
        const startY = this.y - 48;
        this.carryStack.forEach((item, idx) => {
            const itemY = startY - (idx * 10);
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
        this.facing = 'down';
        this.walkCycle = 0;
        this.state = 'walking';
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
            this.handleStationArrival();
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
    }

    handleStationArrival() {
        if (this.target === 'dest') {
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
            this.waitTimer = 0.2;
        } else {
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
        const bob = Math.sin(this.walkCycle) * 2;

        if (this.level === 1) {
            // Level 1: Walker (Sprout Lands helper character sprite)
            ctx.beginPath();
            ctx.ellipse(this.x, this.y + 12, 14, 6, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            ctx.fill();

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

            // Badge
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.fillRect(this.x - 32, this.y - 48, 64, 14);
            ctx.fillStyle = '#10b981';
            ctx.font = '900 8px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText(`WALKER (${this.carryStack.length}/3)`, this.x, this.y - 38);

            ctx.restore();

            // Carried items stack above head
            this.carryStack.forEach((item, idx) => {
                drawItemIcon(ctx, item, this.x, this.y - 54 - (idx * 10) + bob, 14);
            });

        } else if (this.level === 2) {
            // Level 2: Wheelbarrow Worker
            ctx.translate(this.x, this.y);
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
            // Level 3: Forklift Vehicle
            ctx.translate(this.x, this.y);
            ctx.beginPath();
            ctx.ellipse(0, 14, 26, 10, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fill();

            // Yellow Forklift Body
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(-22, -18, 44, 24);
            ctx.fillStyle = '#d97706';
            ctx.fillRect(-22, -18, 12, 24);

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
   Market Customer NPC with Queue Position & Speech Bubble
   -------------------------------------------------------------------------- */
class Customer {
    constructor(x, y, stallX, stallY, desiredItem = 'egg', queueIndex = 0) {
        this.x = x;
        this.y = y;
        this.stallX = stallX;
        this.stallY = stallY;
        this.desiredItem = desiredItem;
        this.queueIndex = queueIndex;
        this.speed = 110;
        this.state = 'approaching';
        this.patience = 18.0; // 18 seconds patience
        this.maxPatience = 18.0;
        this.facing = 'down';
        this.walkCycle = 0;
        this.isDone = false;
    }

    update(dt, stall) {
        if (this.state === 'approaching' || this.state === 'waiting') {
            // Calculate target queue slot line position in front of stall
            const targetX = this.stallX - 40 + (this.queueIndex * 35);
            const targetY = this.stallY + 50;

            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 8) {
                this.state = (this.queueIndex === 0) ? 'buying' : 'waiting';
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
        }

        if (this.state === 'buying') {
            this.patience -= dt;
            const bought = stall.fulfillCustomerOrder(this.desiredItem);
            if (bought) {
                this.state = 'leaving';
                showToast(`🛒 Customer bought ${this.desiredItem.toUpperCase()}!`, 'success');
            } else if (this.patience <= 0) {
                this.state = 'leaving';
                showToast(`💔 Customer left unhappy! Stock market with ${this.desiredItem.toUpperCase()}.`, 'danger');
            }
        }

        if (this.state === 'waiting') {
            this.patience -= dt;
            if (this.patience <= 0) {
                this.state = 'leaving';
            }
        }

        if (this.state === 'leaving') {
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

        // Sprout Lands Customer Character Sprite
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

        // Patience Meter Bar above customer
        if (this.state === 'buying' || this.state === 'waiting') {
            const pRatio = Math.max(0, this.patience / this.maxPatience);
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(this.x - 16, this.y - 48, 32, 4);
            ctx.fillStyle = pRatio > 0.4 ? '#10b981' : '#ef4444';
            ctx.fillRect(this.x - 16, this.y - 48, 32 * pRatio, 4);

            // Speech Bubble asking for desired item
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.x + 14, this.y - 30, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            drawItemIcon(ctx, this.desiredItem, this.x + 14, this.y - 30, 12);
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

/* Helper function to render color-coded item badges */
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
