/* ===========================================================================
 * FARM EMPIRE - Rendering Regression Tests
 * =========================================================================== */

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnvironment } = require('./setup.js');

let env;

beforeEach(() => {
    env = setupTestEnvironment();
});

test('GameEngine - renders fully contracted butterfly wings safely', () => {
    const { engine } = env;
    const wingRadii = [];

    engine.ambientWildlife = [{
        x: 100,
        y: 100,
        wingTimer: -Math.PI / 2,
        color: '#ffffff'
    }];
    engine.ctx.ellipse = (...args) => {
        assert.equal(args.length, 7);
        wingRadii.push(args[3]);
    };

    assert.doesNotThrow(() => engine.drawFarmBackground());
    assert.deepEqual(wingRadii, [0.5, 0.5]);
});
