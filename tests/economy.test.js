/* ==========================================================================
   FARM EMPIRE - Economy System Tests
   ========================================================================== */

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnvironment } = require('./setup.js');

let env;

beforeEach(() => {
    env = setupTestEnvironment();
});

test('Economy - Initial State', () => {
    const { economy } = env;
    assert.equal(economy.balance, 0);
    assert.equal(economy.loanPrincipal, 10000);
    assert.equal(economy.monthlyDues, 1000);
    assert.equal(economy.isGameOver, false);
    assert.equal(economy.isVictory, false);
});

test('Economy - Adding & Spending Money', () => {
    const { economy } = env;
    economy.addMoney(500);
    assert.equal(economy.balance, 500);
    assert.equal(economy.totalEarned, 500);

    const spentSuccess = economy.spendMoney(300);
    assert.equal(spentSuccess, true);
    assert.equal(economy.balance, 200);

    const spentFail = economy.spendMoney(500);
    assert.equal(spentFail, false);
    assert.equal(economy.balance, 200);
});

test('Economy - Pay Down Loan & Victory Condition', () => {
    const { economy } = env;
    economy.addMoney(10000);
    assert.equal(economy.balance, 10000);

    const pay1 = economy.payDownLoan(4000);
    assert.equal(pay1, true);
    assert.equal(economy.balance, 6000);
    assert.equal(economy.loanPrincipal, 6000);

    const pay2 = economy.payDownLoan(6000);
    assert.equal(pay2, true);
    assert.equal(economy.loanPrincipal, 0);
    assert.equal(economy.isVictory, true);
});

test('Economy - Monthly Dues & Foreclosure', () => {
    const { economy } = env;
    // Fast forward monthTimer past 300 seconds without enough balance
    economy.update(301);
    assert.equal(economy.isGameOver, true);

    // Reset and test successful monthly payment when funds are available
    economy.reset();
    economy.addMoney(1500);
    economy.update(301);
    assert.equal(economy.isGameOver, false);
    assert.equal(economy.monthsSurvived, 1);
    assert.equal(economy.balance, 500); // 1500 - 1000 dues = 500
});
