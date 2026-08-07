/* ==========================================================================
   FARM EMPIRE - Entities & Worker Progression Tests
   ========================================================================== */

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnvironment } = require('./setup.js');

let env;

beforeEach(() => {
    env = setupTestEnvironment();
});

test('Player - Item Capacity & Pickup/Dropoff Stack', () => {
    const { Player } = env;
    const player = new Player(100, 100);

    assert.equal(player.capacity, 10);
    assert.equal(player.carryStack.length, 0);

    // Pick 10 items
    for (let i = 0; i < 10; i++) {
        const added = player.addItem('wheat');
        assert.equal(added, true);
    }
    assert.equal(player.carryStack.length, 10);
    assert.equal(player.canPickItem(), false);

    // 11th item should fail
    const addedOverLimit = player.addItem('wheat');
    assert.equal(addedOverLimit, false);

    // Remove top item
    const popped = player.removeItem();
    assert.equal(popped, 'wheat');
    assert.equal(player.carryStack.length, 9);
});

test('RouteHelper - Vehicle Progression & Upgrades', () => {
    const { RouteHelper, game } = env;
    const helper = new RouteHelper(
        'worker_1', 'Feeder',
        { x: 100, y: 100, stationRef: game.grainStation },
        { x: 200, y: 200, stationRef: game.coopStation },
        'wheat',
        220
    );

    // Level 1: Walker
    assert.equal(helper.level, 1);
    assert.equal(helper.capacity, 3);

    // Upgrade to Level 2: Wheelbarrow
    helper.upgrade();
    assert.equal(helper.level, 2);
    assert.equal(helper.capacity, 5);

    // Upgrade to Level 3: Forklift
    helper.upgrade();
    assert.equal(helper.level, 3);
    assert.equal(helper.capacity, 10);
});

test('Customer - Queue & Purchase Fulfillment', () => {
    const { Customer, game } = env;
    const customer = new Customer(1250, 480, game.marketStall.x, game.marketStall.y, 'egg', 0);
    
    assert.equal(customer.state, 'approaching');
    assert.equal(customer.desiredItem, 'egg');

    // Add egg to market stall stock
    game.marketStall.stock['egg'] = 5;

    // Simulate customer buying state
    customer.state = 'buying';
    customer.update(0.1, game.marketStall);

    assert.equal(customer.state, 'leaving');
    assert.equal(game.marketStall.stock['egg'], 4);
});

test('GameController - objective guides the active delivery step', () => {
    const { game } = env;

    let objective = game.getFarmObjective();
    assert.equal(objective.icon, '🌾');
    assert.equal(objective.text, 'Collect wheat at the grain patch');

    game.player.carryStack.push('wheat');
    objective = game.getFarmObjective();
    assert.equal(objective.icon, '🐔');
    assert.equal(objective.text, 'Bring wheat to the chicken coop');

    game.player.carryStack = ['egg'];
    objective = game.getFarmObjective();
    assert.equal(objective.icon, '🛒');
    assert.equal(objective.text, 'Stock eggs at the roadside market');
});
