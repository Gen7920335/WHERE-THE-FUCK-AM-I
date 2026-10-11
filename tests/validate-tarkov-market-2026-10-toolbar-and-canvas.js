const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('../.tools/jsdom-test/node_modules/jsdom');

// Tarkov-Market 2026-10 UI: the location button moved into the toolbar's More
// (⋯) dropdown and the player dot is drawn on canvas.players-canvas.
const constants = fs.readFileSync('eft-where-am-i/Classes/Constants.cs', 'utf8');
const executor = fs.readFileSync('eft-where-am-i/Classes/JavaScriptExecutor.cs', 'utf8');
const selector = name => {
  const expression = constants.match(new RegExp(`public const string ${name}\\s*=([\\s\\S]*?);`))[1];
  return [...expression.matchAll(/"(?:\\.|[^"\\])*"/g)].map(m => JSON.parse(m[0])).join('');
};
const script = name => constants.match(new RegExp(`${name}\\s*=\\s*@"([\\s\\S]*?)";`))[1].replace(/""/g, '"');
const inputTemplate = executor.slice(executor.indexOf('public async Task<bool> EnsureWhereAmIInputAsync('))
  .match(/string scriptTemplate = \$@"([\s\S]*?)";/)[1]
  .replace('{inputSelector}', JSON.stringify(selector('WHERE_AM_I_INPUT_SELECTOR')))
  .replace(/\{\{/g, '{').replace(/\}\}/g, '}').replace(/""/g, '"');
const inputScript = menuOpened => inputTemplate.replace('__MENU_OPENED__', String(menuOpened));
const error = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const matrix = degrees => {
  const a = degrees * Math.PI / 180;
  return `matrix(${Math.cos(a)},${Math.sin(a)},${-Math.sin(a)},${Math.cos(a)},0,0)`;
};

// --- More (⋯) dropdown location button -------------------------------------
for (const label of ['Where am I?', '']) {
  const dom = new JSDOM(`<body><div class="panel_top desktop-panel"><div>
    <div class="toolbar-group primary-tools"><button id="search">Search</button></div>
    <button class="toolbar-rotation" aria-label="0°">0°</button>
    <div class="dropdown toolbar-more"><div><button id="more">⋯</button></div>
      <div class="dd-content"><div><button id="ruler">Ruler</button><button id="where">${label}</button></div></div>
    </div></div></div></body>`, { runScripts: 'dangerously', url: 'https://tarkov-market.com/maps/customs' });
  const w = dom.window, d = w.document;
  const visible = new Set(['search', 'more']);
  for (const button of d.querySelectorAll('button')) {
    Object.defineProperty(button, 'offsetParent', { get: () => visible.has(button.id) ? d.body : null });
  }
  const clicks = [];
  for (const button of d.querySelectorAll('button')) button.addEventListener('click', () => clicks.push(button.id));
  d.querySelector('#more').addEventListener('click', () => { visible.add('ruler'); visible.add('where'); });

  assert.equal(w.eval(inputScript(false)), 'menu-opened');
  assert.deepEqual(clicks, ['more']);
  assert.equal(w.eval(inputScript(true)), 'clicked', `label "${label}" must resolve the location button`);
  assert.deepEqual(clicks, ['more', 'where'], 'only the More toggle and the location button may be clicked');

  visible.delete('ruler'); visible.delete('where');
  assert.equal(w.eval(inputScript(true)), 'waiting-for-menu', 'an opened menu must not be toggled closed again');
  assert.deepEqual(clicks, ['more', 'where']);
  w.close();
}

// --- Canvas player heading and shared player point ---------------------------
class FakeContext {
  constructor(canvas) { this.canvas = canvas; this.matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; this.rotations = []; this.strokes = 0; }
  setTransform(...args) {
    this.matrix = args.length === 1 ? { ...args[0] } : Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((k, i) => [k, args[i]]));
    this.rotations = [];
  }
  getTransform() { return { ...this.matrix }; }
  clearRect() { this.strokes = 0; }
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  fill() {}
  stroke() { this.strokes++; }
  rotate(angle) { this.rotations.push(angle * 180 / Math.PI); }
  save() {}
  restore() {}
}

const maps = ['customs', 'reserve', 'lab', 'factory'];
let cases = 0;
for (const slug of maps) {
  for (const withScene of [true, false]) {
    const dom = new JSDOM(`<body><div class="panel_top"><button class="toolbar-rotation" aria-label="0°">0°</button>
      <input id="map-position-file"></div><div class="map-cont" id="map">
      ${withScene ? '<div class="map-wrap"><div class="map-scene"><div class="marker" id="legacy"></div></div></div>' : ''}
      <canvas class="players-canvas"></canvas></div></body>`,
      { runScripts: 'dangerously', pretendToBeVisual: true, url: `https://tarkov-market.com/maps/${slug}` });
    const w = dom.window, d = w.document;
    w.HTMLCanvasElement.prototype.getContext = function () { return this.__ctx || (this.__ctx = new FakeContext(this)); };
    const canvas = d.querySelector('canvas.players-canvas');
    Object.defineProperty(canvas, 'clientWidth', { get: () => 800 });
    Object.defineProperty(canvas, 'clientHeight', { get: () => 600 });
    canvas.width = 1600; canvas.height = 1200;
    canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 800, height: 600, right: 810, bottom: 620 });
    d.querySelector('#map').getBoundingClientRect = () => ({ left: 4, top: 6, width: 900, height: 700, right: 904, bottom: 706 });
    const input = d.querySelector('#map-position-file');
    try {
      w.eval(script('ADD_DIRECTION_INDICATORS_SCRIPT'));
      w.eval(script('DEAD_ZONE_AUTO_PAN_SCRIPT'));
      const overlay = d.querySelector('canvas.eft-heading-canvas');
      assert.ok(overlay, 'heading overlay canvas must be created next to players-canvas');
      w.eval(script('ADD_DIRECTION_INDICATORS_SCRIPT'));
      assert.equal(d.querySelectorAll('canvas.eft-heading-canvas').length, 1, 'reinjection must not stack overlays');

      const site = canvas.getContext('2d');
      const draw = () => {
        site.clearRect(0, 0, 1600, 1200);
        site.setTransform(2, 0, 0, 2, 400, 300);
        site.beginPath(); site.arc(0, 0, 6, 0, Math.PI * 2); site.stroke();
        // Teammate dot drawn afterwards must not move the local arrow.
        site.setTransform(2, 0, 0, 2, 900, 900);
        site.beginPath(); site.arc(0, 0, 6, 0, Math.PI * 2); site.stroke();
      };

      for (const view of [0, 90, 180, 270]) {
        if (withScene) d.querySelector('.map-scene').style.transform = matrix(view);
        else d.querySelector('.toolbar-rotation').setAttribute('aria-label', `${view}°`);
        for (const yaw of [0, 45, 90, 135, 180, 225, 270, 315]) {
          const half = yaw * Math.PI / 360;
          input.value = `2026-10-09[12-00]_0, 0, 0_0, ${Math.sin(half)}, 0, ${Math.cos(half)}_0`;
          input.dispatchEvent(new w.Event('input'));
          draw();
          const arrow = overlay.getContext('2d');
          assert.equal(arrow.matrix.e, 400); assert.equal(arrow.matrix.f, 300);
          assert.equal(arrow.rotations.length, 1, 'arrow must be drawn once for the local player only');
          let expected;
          if (withScene) {
            const triangle = d.querySelector('#legacy .triangle-indicator');
            // The legacy marker sits inside the rotated scene; the canvas is screen-space.
            expected = +triangle.style.transform.match(/rotate\(([-\d.]+)deg\)/)[1] + view;
          } else {
            // Same heading as the identity-view DOM marker, plus the toolbar rotation.
            const ref = new JSDOM(`<input id="map-position-file"><div class="map-cont"><div class="map-scene"><div class="marker"></div></div></div>`,
              { runScripts: 'dangerously', url: `https://tarkov-market.com/maps/${slug}` });
            ref.window.document.querySelector('input').value = input.value;
            ref.window.eval(script('ADD_DIRECTION_INDICATORS_SCRIPT'));
            expected = +ref.window.document.querySelector('.triangle-indicator').style.transform.match(/rotate\(([-\d.]+)deg\)/)[1] + view;
            ref.window.__eftWhereAmIMarkerObserver.disconnect(); ref.window.clearTimeout(ref.window.__eftWhereAmIHeadingInitTimer); ref.window.close();
          }
          assert.ok(error(arrow.rotations[0], expected) < 1e-7, `${slug} scene=${withScene} view=${view} yaw=${yaw}: ${arrow.rotations[0]} vs ${expected}`);
          cases++;
        }
      }

      // Canvas pixels (400,300) at 2x DPR inside a rect at (10,20) -> client (210,170).
      assert.deepEqual({ ...w.__wtfPlayerCanvasPoint() }, { x: 210, y: 170 });
      if (!withScene) {
        const calc = JSON.parse(w.__deadZoneCalc(50));
        assert.notEqual(calc.reason, 'no-marker', 'auto-pan must find the canvas player');
      }

      input.value = 'invalid'; input.dispatchEvent(new w.Event('input'));
      draw();
      assert.equal(overlay.getContext('2d').rotations.length, 0, 'invalid heading must clear the arrow');
      site.clearRect(0, 0, 1600, 1200);
      assert.equal(w.__wtfPlayerCanvasPoint(), null, 'a cleared canvas has no player point');
    } finally {
      w.__eftWhereAmIMarkerObserver?.disconnect();
      w.__eftWhereAmIUnwantedObserver?.disconnect();
      w.clearTimeout(w.__eftWhereAmIHeadingInitTimer);
      w.close();
    }
  }
}

console.log(`PASS: More-menu location button (label and positional), no re-toggle; ${cases} canvas headings with scene and toolbar rotation, shared player point for calibration and auto-pan.`);
