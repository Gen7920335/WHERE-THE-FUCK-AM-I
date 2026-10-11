// Round-3 regressions on the 2026-10 canvas UI:
// 1. Floors come from the site's own numbering (Lab: Level 2 = 2, Main = 1,
//    Basement = -1); reading "Basement" as 0 left basement markers translucent.
// 2. The toolbar fit must use its natural single-row width; the panel fills its
//    max-width, so measuring the panel kept the toolbar stuck at the old scale.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('../.tools/jsdom-test/node_modules/jsdom');

const enhancements = fs.readFileSync(
  path.resolve(__dirname, '..', 'eft-where-am-i', 'html', 'enhancements.js'),
  'utf8'
);

const dom = new JSDOM(
  `<body>
    <div id="__nuxt">
      <div class="map-cont">
        <div class="panel_top desktop-panel"><div class="map-toolbar">
          <div class="t1"></div><div class="t2"></div><div class="t3"></div>
        </div></div>
        <div class="panel_left"><div class="two-columns"></div></div>
        <div class="panel_right">
          <div class="no-wrap">
            <label class="pointer"><input type="radio" name="layers" value="on"> Level 2</label>
            <label class="pointer story"><input type="radio" name="layers" value="on" checked> Main</label>
            <label class="pointer"><input type="radio" name="layers" value="on"> Basement</label>
          </div>
          <div class="items scroll">
            <div class="no-wrap d-flex" data-quest-uid="q0"><span>Quest 0</span></div>
          </div>
        </div>
        <canvas class="doc-map-canvas" width="1000" height="800"></canvas>
        <canvas class="markers-canvas" width="1000" height="800"></canvas>
      </div>
    </div>
  </body>`,
  { runScripts: 'dangerously', url: 'https://tarkov-market.com/maps/lab', pretendToBeVisual: true }
);
const { window } = dom;
const { document } = window;
window.ResizeObserver = class ResizeObserver { observe() {} disconnect() {} };
window.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
window.CanvasRenderingContext2D.prototype = { drawImage() {}, fillText() {}, strokeText() {} };
window.chrome = { webview: { postMessage() {} } };
const contexts = new Map();
window.HTMLCanvasElement.prototype.getContext = function getContext() {
  if (!contexts.has(this)) {
    let current = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    contexts.set(this, {
      canvas: this,
      getTransform: () => ({ ...current }),
      setTransform(...args) {
        current = args.length >= 6 ? { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] } : { ...args[0] };
      }
    });
  }
  return contexts.get(this);
};
document.querySelector('canvas.doc-map-canvas').getContext('2d').setTransform(0.41, 0, 0, 0.41, 0, 0);

// Production Vue keeps component props on the vnode tree; the popup layer
// receives the floor numbers in radio order.
document.getElementById('__nuxt').__vue_app__ = {
  _container: { _vnode: { component: { props: {}, subTree: { children: [{ component: { props: { layersAsNums: [2, 1, -1] }, subTree: null } }] } } } }
};

// Toolbar geometry: three items with fixed natural widths, rendered at the
// current --wtf-top-ui-scale; the panel itself fills the viewport.
const naturalWidths = { t1: 300, t2: 400, t3: 340 };
const currentTopScale = () => Number.parseFloat(document.documentElement.style.getPropertyValue('--wtf-top-ui-scale')) || 1;
const rect = (width, height = 20) => ({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON() { return this; } });
for (const [cls, width] of Object.entries(naturalWidths)) {
  document.querySelector(`.${cls}`).getBoundingClientRect = () => rect(width * currentTopScale());
}
document.querySelector('.panel_top').getBoundingClientRect = () => rect(window.innerWidth - 30, 40);
window.getComputedStyle = ((original) => (element, ...rest) => {
  const style = original(element, ...rest);
  if (element.classList?.contains('map-toolbar')) {
    return new Proxy(style, { get: (target, key) => (key === 'columnGap' ? '10px' : Reflect.get(target, key)) });
  }
  return style;
})(window.getComputedStyle);

const nextFrame = () => new Promise((resolve) => window.requestAnimationFrame(() => resolve()));

window.eval(enhancements);

const markers = [
  { uid: 'm2', map: 'lab', category: 'Quests', subCategory: 'Quest', questUid: 'q0', name: 'Up', geometry: { x: -100, y: -100 }, level: 2 },
  { uid: 'm1', map: 'lab', category: 'Quests', subCategory: 'Quest', questUid: 'q0', name: 'Main', geometry: { x: -150, y: -120 }, level: 1 },
  { uid: 'mb', map: 'lab', category: 'Quests', subCategory: 'Quest', questUid: 'q0', name: 'Basement', geometry: { x: -200, y: -140 }, level: -1 }
];
window.__wtfQuestLiveSource = async () => ({ allMarkers: markers, quests: [{ uid: 'q0', name: 'Quest 0', type: 'SideQuest' }] });

(async () => {
  window.__wtfQuestOverlay.configure({ map: 'lab' });
  window.__wtfRouteOverlay.configure({ map: 'lab', nodes: [], maxNodes: 20, localNodeCount: 0 });
  window.__wtfQuestOverlay.setPinnedQuests(['Quest 0']);
  for (let i = 0; i < 20 && document.querySelectorAll('.wtf-quest-marker').length < 3; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const floorState = () => Object.fromEntries([...document.querySelectorAll('.wtf-quest-marker')]
    .map((marker) => [marker.dataset.floor, marker.classList.contains('wtf-other-floor') ? 'translucent' : 'opaque']));
  assert.deepEqual(floorState(), { 2: 'translucent', 1: 'opaque', '-1': 'translucent' }, 'Main shows only floor 1 opaque');

  const radios = [...document.querySelectorAll('input[name="layers"]')];
  radios[2].checked = true;
  radios[2].dispatchEvent(new window.Event('change', { bubbles: true }));
  await nextFrame();
  await nextFrame();
  assert.deepEqual(floorState(), { 2: 'translucent', 1: 'translucent', '-1': 'opaque' },
    'Basement must use the site floor number -1, not 0');

  radios[0].checked = true;
  radios[0].dispatchEvent(new window.Event('change', { bubbles: true }));
  await nextFrame();
  await nextFrame();
  assert.deepEqual(floorState(), { 2: 'opaque', 1: 'translucent', '-1': 'translucent' }, 'Level 2 shows floor 2 opaque');

  // Toolbar: shrink the UI to 65%, then back to 100%; the fit must recover.
  const natural = Object.values(naturalWidths).reduce((sum, width) => sum + width, 0) + 2 * 10;
  const expected = (window.innerWidth - 30) / (natural * 1.02);
  window.__wtfSetEnhancementSettings({ uiScale: 0.65 });
  window.dispatchEvent(new window.Event('resize'));
  await nextFrame();
  await nextFrame();
  assert.ok(Math.abs(currentTopScale() - 0.65) < 1e-9, `65% UI must scale the toolbar to 0.65, got ${currentTopScale()}`);
  window.__wtfSetEnhancementSettings({ uiScale: 1 });
  window.dispatchEvent(new window.Event('resize'));
  await nextFrame();
  await nextFrame();
  assert.ok(Math.abs(currentTopScale() - Math.min(1, expected)) < 1e-6,
    `toolbar must return to its natural fit ${Math.min(1, expected)}, got ${currentTopScale()}`);

  console.log('PASS: Lab floors use the native numbering (Basement = -1); the toolbar fit recovers after the UI size is lowered and raised.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
