/* ==========================================================================
   FARM EMPIRE - Game Entities (Player, Upgraded Vehicles, Customers, VFX)
   ========================================================================== */

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 20;
        this.speed = 220; // Pixels per second
        this.capacity = 10; // Max items carried
        this.carryStack = [];
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
            const len = Math.hypot(inputDir.x, inputDir.y);
            const dx = inputDir.x / len;
            const dy = inputDir.y / len;

            this.vx = dx * this.speed;
            this.vy = dy * this.speed;

            this.x += this.vx * dt;
            this.y += this.vy * dt;

            if (Math.abs(dx) > Math.abs(dy)) {
                this.facing = dx > 0 ? 'right' : 'left';
            } else {
                this.facing = dy > 0 ? 'down' : 'up';
            }

            this.walkCycle += dt * 9;
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
            engine.spawnHarvestLeaves(this.x, this.y - 10, 2);
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
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fill();

        // 2. Render Pixel Art Top-Down Farmer Character Sprite Sheet
        const sprChar = assets.get('char');
        if (sprChar && sprChar.complete) {
            let facingRow = 0;
            if (this.facing === 'up') facingRow = 1;
            else if (this.facing === 'left') facingRow = 2;
            else if (this.facing === 'right') facingRow = 3;

            const frame = Math.floor(this.walkCycle) % 4;
            const srcX = frame * 48;
            const srcY = facingRow * 48;

            ctx.drawImage(sprChar, srcX, srcY, 48, 48, this.x - 30, this.y - 42, 60, 60);
        } else {
            // High-Contrast Pixel Art Farmer Fallback
            const bob = Math.sin(this.walkCycle) * 3;
            ctx.fillStyle = '#1d4ed8'; // Blue Overalls
            ctx.fillRect(this.x - 12, this.y - 20 + bob, 24, 22);

            ctx.fillStyle = '#fde047'; // Yellow Straw Hat
            ctx.beginPath();
            ctx.ellipse(this.x, this.y - 24 + bob, 18, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#b45309';
            ctx.fillRect(this.x - 8, this.y - 28 + bob, 16, 6);
        }

        ctx.restore();

        // 3. Render Stack of Carried Items
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
        ctx.arc(this.x + 24, this.y - 35, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 10px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${this.carryStack.length}/${this.capacity}`, this.x + 24, this.y - 35);
    }
}

/* --------------------------------------------------------------------------
   Dedicated Route Helper NPC (Tier 1 Walker -> Tier 2 Wheelbarrow -> Tier 3 Forklift)
   -------------------------------------------------------------------------- */
class RouteHelper {
    constructor(id, name, sourcePos, destPos, itemType, playerSpeed) {
        this.id = id;
        this.name = name;
        this.sourcePos = sourcePos;
        this.destPos = destPos;
        this.itemType = itemType;
        this.playerSpeed = playerSpeed;

        this.x = sourcePos.x;
        this.y = sourcePos.y;
        this.target = 'dest';
        this.level = 1; // 1 = Walker (3 cap), 2 = Wheelbarrow (5 cap), 3 = Forklift (10 cap)
        this.capacity = 3;
        this.speed = playerSpeed * 0.75;
        this.carryStack = [];
        this.facing = 'down';
        this.walkCycle = 0;
        this.state = 'walking';
        this.waitTimer = 0;
        this.smokeTimer = 0;

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
                this.speed = this.playerSpeed * 1.25;
                createFloatingText('🛒 WHEELBARROW UNLOCKED (5 Cap)!', this.x, this.y - 45, '#38bdf8');
                engine.spawnMoneySparks(this.x, this.y - 20, 8);
            } else if (this.level === 3) {
                this.capacity = 10;
                this.speed = this.playerSpeed * 1.85;
                createFloatingText('🚜 FORKLIFT UNLOCKED (10 Cap)!', this.x, this.y - 45, '#fbbf24');
                engine.spawnMoneySparks(this.x, this.y - 20, 12);
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

            this.walkCycle += dt * 9;

            // Tier 3 Forklift Exhaust Smoke Particle
            if (this.level === 3) {
                this.smokeTimer += dt;
                if (this.smokeTimer >= 0.15) {
                    engine.spawnExhaustSmoke(this.x - 18, this.y - 12);
                    this.smokeTimer = 0;
                }
            }
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
                    break;
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
                    break;
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
            // Level 1: Walker (Sprout Lands character sprite)
            ctx.beginPath();
            ctx.ellipse(this.x, this.y + 12, 14, 6, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
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
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.fillRect(this.x - 32, this.y - 48, 64, 14);
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 1;
            ctx.strokeRect(this.x - 32, this.y - 48, 64, 14);

            ctx.fillStyle = '#34d399';
            ctx.font = '900 8px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText(`WALKER (${this.carryStack.length}/3)`, this.x, this.y - 38);

            ctx.restore();

            // Carried items stack above head
            this.carryStack.forEach((item, idx) => {
                drawItemIcon(ctx, item, this.x, this.y - 54 - (idx * 10) + bob, 14);
            });

        } else if (this.level === 2) {
            // Level 2: Wooden Wheelbarrow Worker
            ctx.translate(this.x, this.y);
            ctx.beginPath();
            ctx.ellipse(0, 12, 22, 8, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fill();

            // Wheelbarrow tub
            ctx.fillStyle = '#b45309';
            ctx.fillRect(-18, -6, 34, 16);
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(-18, -6, 34, 16);

            // Wheel
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(16, 8, 6, 0, Math.PI * 2);
            ctx.fill();

            // Worker behind wheelbarrow
            ctx.beginPath();
            ctx.arc(-14, -10 + bob, 10, 0, Math.PI * 2);
            ctx.fillStyle = '#10b981';
            ctx.fill();

            // Badge
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.fillRect(-36, -38, 72, 14);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1;
            ctx.strokeRect(-36, -38, 72, 14);

            ctx.fillStyle = '#38bdf8';
            ctx.font = '900 8px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText(`WHEELBARROW (${this.carryStack.length}/5)`, 0, -28);

            ctx.restore();

            // Draw items inside wheelbarrow tub
            this.carryStack.forEach((item, idx) => {
                drawItemIcon(ctx, item, this.x - 12 + (idx * 6), this.y - 2, 12);
            });

        } else if (this.level === 3) {
            // Level 3: Heavy Industrial Forklift Vehicle
            ctx.translate(this.x, this.y);
            ctx.beginPath();
            ctx.ellipse(0, 14, 28, 10, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fill();

            // Yellow Metallic Body
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(-24, -18, 48, 24);
            ctx.fillStyle = '#d97706';
            ctx.fillRect(-24, -18, 14, 24);

            // Engine Grill & Exhaust Pipe
            ctx.fillStyle = '#334155';
            ctx.fillRect(-22, -26, 6, 10);

            // Black Wheels
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(-14, 8, 7, 0, Math.PI * 2);
            ctx.arc(14, 8, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#94a3b8';
            ctx.beginPath();
            ctx.arc(-14, 8, 3, 0, Math.PI * 2);
            ctx.arc(14, 8, 3, 0, Math.PI * 2);
            ctx.fill();

            // Lifting Mast & Fork Pallet
            ctx.fillStyle = '#64748b';
            ctx.fillRect(20, -32, 5, 38);
            ctx.fillRect(20, 2, 14, 4);

            // Badge
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.fillRect(-38, -46, 76, 14);
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 1;
            ctx.strokeRect(-38, -46, 76, 14);

            ctx.fillStyle = '#fbbf24';
            ctx.font = '900 8px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText(`FORKLIFT (${this.carryStack.length}/10)`, 0, -36);

            ctx.restore();

            // Draw stacked items on front pallet
            this.carryStack.forEach((item, idx) => {
                const px = this.x + 28;
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
        this.speed = 115;
        this.state = 'approaching';
        this.patience = 18.0;
        this.maxPatience = 18.0;
        this.facing = 'down';
        this.walkCycle = 0;
        this.isDone = false;
        this.shirtColor = ['#38bdf8', '#a855f7', '#f43f5e', '#34d399'][queueIndex % 4];
    }

    update(dt, stall) {
        if (this.state === 'approaching' || this.state === 'waiting') {
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
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();

        // Customer Sprite
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
        } else {
            const bob = Math.sin(this.walkCycle) * 2;
            ctx.fillStyle = this.shirtColor;
            ctx.fillRect(this.x - 10, this.y - 18 + bob, 20, 18);
            ctx.fillStyle = '#fde047';
            ctx.beginPath();
            ctx.arc(this.x, this.y - 22 + bob, 8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Patience Meter Bar above customer
        if (this.state === 'buying' || this.state === 'waiting') {
            const pRatio = Math.max(0, this.patience / this.maxPatience);
            ctx.fillStyle = 'rgba(15,23,42,0.85)';
            ctx.fillRect(this.x - 16, this.y - 48, 32, 5);
            ctx.fillStyle = pRatio > 0.4 ? '#10b981' : '#f87171';
            ctx.fillRect(this.x - 16, this.y - 48, 32 * pRatio, 5);

            // Speech Bubble asking for desired item
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.x + 14, this.y - 30, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 2;
            ctx.stroke();

            drawItemIcon(ctx, this.desiredItem, this.x + 14, this.y - 30, 13);
        }

        ctx.restore();
    }
}

/* --------------------------------------------------------------------------
   Floating Text Particles (+ $15, +1 Feed)
   -------------------------------------------------------------------------- */
class FloatingText {
    constructor(text, x, y, color = '#fbbf24') {
        this.text = text;
        this.x = x;
        this.y = y;
        this.color = color;
        this.life = 1.0;
    }

    update(dt) {
        this.y -= 32 * dt;
        this.life -= dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.font = '900 16px Outfit';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 6;
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
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.ellipse(0, 0, half, half * 0.7, Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 1;
            ctx.stroke();
            break;
        case 'egg':
            ctx.fillStyle = '#fffbeb';
            ctx.beginPath();
            ctx.ellipse(0, 0, half * 0.7, half, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 1;
            ctx.stroke();
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
        default:
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, half, 0, Math.PI * 2);
            ctx.fill();
    }
    ctx.restore();
}
