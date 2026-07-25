/* ==========================================================================
   FARM EMPIRE - Farm Stations & Automation Processing Tests
   ========================================================================== */

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnvironment } = require('./setup.js');

let env;

beforeEach(() => {
    env = setupTestEnvironment();
});

test('GrainStation - Wheat Growth & Player Collection', () => {
    const { GrainStation, Player } = env;
    const station = new GrainStation(250, 180);
    const player = new Player(250, 180);

    station.feedStock = 10;
    
    // Player standing in zone collects wheat
    station.update(0.1, player);
    assert.equal(player.carryStack.length, 1);
    assert.equal(station.feedStock, 9);
});

test('CoopStation - Feeding & Egg Laying', () => {
    const { CoopStation, Player } = env;
    const coop = new CoopStation(750, 180);
    const player = new Player(750, 180);

    // Player with wheat feeds coop
    player.addItem('wheat');
    coop.update(0.1, player);
    assert.equal(player.carryStack.length, 0);
    assert.equal(coop.feedTrough, 1);

    // Move player away so player doesn't instantly pick up the produced egg
    player.x = 0;
    player.y = 0;

    // Simulate egg production over time
    coop.update(0.5, player);
    assert.equal(coop.feedTrough, 0);
    assert.equal(coop.eggStock, 1);
});

test('MayoStation - Unlock & Processing Mechanics', () => {
    const { MayoStation, Player, economy } = env;
    const mayo = new MayoStation(750, 500);
    const player = new Player(750, 500);

    assert.equal(mayo.isUnlocked, false);

    // Unlock Mayo Station with sufficient funds
    economy.addMoney(500);
    mayo.unlockPad.execute(player);
    assert.equal(mayo.isUnlocked, true);

    // Deposit egg and process mayo (player away so mayo stays in output stock)
    mayo.receiveItemFromWorker('egg');
    assert.equal(mayo.inputEggs, 1);

    player.x = 0;
    player.y = 0;

    mayo.update(0.5, player);
    assert.equal(mayo.inputEggs, 0);
    assert.equal(mayo.outputMayo, 1);
});
