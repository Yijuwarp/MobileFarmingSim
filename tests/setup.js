/* ==========================================================================
   FARM EMPIRE - Test Setup & DOM/Canvas Environment Mocks for Node.js
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createMockCanvasContext() {
    return {
        save: () => {},
        restore: () => {},
        scale: () => {},
        translate: () => {},
        rotate: () => {},
        beginPath: () => {},
        arc: () => {},
        ellipse: () => {},
        rect: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        clearRect: () => {},
        fill: () => {},
        stroke: () => {},
        fillText: () => {},
        drawImage: () => {},
        setLineDash: () => {},
        createRadialGradient: () => ({ addColorStop: () => {} }),
        imageSmoothingEnabled: true,
        globalAlpha: 1.0,
        fillStyle: '#000000',
        strokeStyle: '#000000',
        lineWidth: 1,
        font: '10px sans-serif',
        textAlign: 'left',
        textBaseline: 'alphabetic',
        shadowColor: '',
        shadowBlur: 0
    };
}

function createMockElement(id = '', tagName = 'div') {
    const children = [];
    const classList = new Set();
    const style = {};

    return {
        id,
        tagName: tagName.toUpperCase(),
        classList: {
            add: (cls) => classList.add(cls),
            remove: (cls) => classList.delete(cls),
            contains: (cls) => classList.has(cls)
        },
        style,
        innerText: '',
        value: '',
        appendChild: (child) => children.push(child),
        removeChild: (child) => {
            const idx = children.indexOf(child);
            if (idx >= 0) children.splice(idx, 1);
        },
        remove: () => {},
        addEventListener: () => {},
        getContext: () => createMockCanvasContext(),
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 800, height: 600 })
    };
}

function setupTestEnvironment() {
    const elements = {};

    const mockDocument = {
        getElementById: (id) => {
            if (!elements[id]) {
                elements[id] = createMockElement(id, id === 'gameCanvas' ? 'canvas' : 'div');
            }
            return elements[id];
        },
        createElement: (tag) => createMockElement('', tag),
        addEventListener: () => {},
        removeEventListener: () => {}
    };

    class MockAudioContext {
        constructor() {
            this.state = 'running';
            this.currentTime = 0;
            this.destination = {};
        }
        resume() { return Promise.resolve(); }
        createOscillator() {
            return {
                type: 'sine',
                frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
                connect: () => {},
                start: () => {},
                stop: () => {}
            };
        }
        createGain() {
            return {
                gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
                connect: () => {}
            };
        }
    }

    class MockImage {
        constructor() {
            this.src = '';
            this.complete = true;
            this.onload = null;
        }
    }

    const sandbox = {
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        Math,
        Date,
        performance: { now: () => Date.now() },
        window: {
            innerWidth: 1280,
            innerHeight: 720,
            addEventListener: () => {},
            removeEventListener: () => {},
            AudioContext: MockAudioContext
        },
        document: mockDocument,
        Image: MockImage,
        AudioContext: MockAudioContext,
        requestAnimationFrame: (cb) => setTimeout(cb, 16)
    };

    sandbox.globalThis = sandbox;
    sandbox.window.window = sandbox.window;

    const context = vm.createContext(sandbox);

    const projectRoot = path.resolve(__dirname, '..');
    const scripts = [
        'js/audio.js',
        'js/economy.js',
        'js/entities.js',
        'js/stations.js',
        'js/engine.js',
        'js/main.js'
    ];

    scripts.forEach(script => {
        let code = fs.readFileSync(path.join(projectRoot, script), 'utf8');
        // Wrap script in an IIFE that assigns exported classes/variables to globalThis
        code = `(function() {\n${code}\n`;
        const exportsToBind = ['SoundSystem', 'soundManager', 'EconomyManager', 'economy', 'Player', 'RouteHelper', 'Customer', 'FloatingText', 'drawItemIcon', 'ActionPad', 'GrainStation', 'CoopStation', 'MarketStall', 'MayoStation', 'CowStation', 'CheeseStation', 'BankDesk', 'AssetManager', 'assets', 'Particle', 'GameEngine', 'engine', 'showToast', 'GameController', 'spawnRouteHelper', 'createFloatingText', 'showForeclosureModal', 'showVictoryModal', 'game'];
        exportsToBind.forEach(symbol => {
            code += `if (typeof ${symbol} !== 'undefined') globalThis.${symbol} = ${symbol};\n`;
        });
        code += `})();`;
        vm.runInContext(code, context);
    });

    if (!context.game && context.GameController) {
        context.game = new context.GameController();
    }

    return context;
}

module.exports = { setupTestEnvironment };
