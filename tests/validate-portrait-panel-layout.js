const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('../.tools/jsdom-test/node_modules/jsdom');

const dom = new JSDOM(
  `<head><style>.desktop-panel { display: none; }.mobile-map-ui { display: block; }</style></head><body>
    <div class="map-cont">
      <div class="panel_top desktop-panel"><div><button type="button">Toolbar</button></div></div>
      <div class="mobile-map-ui">Native mobile UI</div>
      <div class="panel_left"><div class="tools">Left</div></div>
      <div class="panel_right"><div class="tools_quests">Right</div></div>
      <div class="map-wrap"></div>
    </div>
  </body>`,
  {
    runScripts: 'dangerously',
    url: 'https://tarkov-market.com/maps/customs',
    pretendToBeVisual: true
  }
);

const { window } = dom;
let viewportWidth = 800;
let viewportHeight = 1200;
Object.defineProperty(window.document.documentElement, 'clientWidth', {
  configurable: true,
  get: () => viewportWidth
});
Object.defineProperty(window.document.documentElement, 'clientHeight', {
  configurable: true,
  get: () => viewportHeight
});
Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => viewportWidth });
Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => viewportHeight });

window.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
window.CanvasRenderingContext2D.prototype = {
  drawImage() {},
  fillText() {},
  strokeText() {}
};
window.ResizeObserver = class ResizeObserver {
  observe() {}
  disconnect() {}
};

const rect = (x, y, width, height) => ({
  x,
  y,
  width,
  height,
  left: x,
  right: x + width,
  top: y,
  bottom: y + height,
  toJSON() { return this; }
});
const mapContainer = window.document.querySelector('.map-cont');
const topPanel = window.document.querySelector('.panel_top');
const leftPanel = window.document.querySelector('.panel_left');
const rightPanel = window.document.querySelector('.panel_right');
mapContainer.getBoundingClientRect = () => rect(0, 80, viewportWidth, viewportHeight - 80);
topPanel.getBoundingClientRect = () => rect(100, 80, 600, 100);
leftPanel.getBoundingClientRect = () => rect(0, 80, 215, viewportHeight - 100);
rightPanel.getBoundingClientRect = () => rect(viewportWidth - 286, 80, 286, viewportHeight - 90);

const enhancementsPath = path.resolve(
  __dirname,
  '..',
  'eft-where-am-i',
  'html',
  'enhancements.js'
);
window.eval(fs.readFileSync(enhancementsPath, 'utf8'));
window.__wtfSetEnhancementSettings({ uiScale: 1 });

const nextFrame = () => new Promise((resolve) => window.requestAnimationFrame(resolve));

(async () => {
  await nextFrame();
  const root = window.document.documentElement;
  const value = (name) => Number.parseFloat(root.style.getPropertyValue(name));
  const shell = window.document.getElementById('wtf-portrait-panel-shell');
  const nativeMobileUi = window.document.querySelector('.mobile-map-ui');

  assert.equal(root.dataset.wtfLayout, 'portrait', 'height > width must activate portrait mode');
  assert.equal(window.getComputedStyle(topPanel).display, 'block', 'WTFMI must retain the desktop toolbar below 900 CSS px');
  assert.equal(window.getComputedStyle(nativeMobileUi).display, 'none', 'native mobile controls must not overlap the WTFMI portrait UI');
  assert.ok(shell && !shell.hidden, 'portrait panels need one visible shared shell');
  assert.equal(value('--wtf-portrait-panel-width'), 776);
  assert.equal(value('--wtf-portrait-left-width'), 194);
  assert.equal(value('--wtf-portrait-right-width'), 582);
  assert.equal(
    value('--wtf-portrait-panel-top') + value('--wtf-portrait-panel-height'),
    1108,
    'portrait unified panel must remain docked 12px above the map bottom'
  );
  assert.equal(value('--wtf-top-ui-scale'), 0.5, 'portrait map toolbar must be half size');
  assert.equal(
    value('--wtf-portrait-right-width') / value('--wtf-portrait-left-width'),
    3,
    'portrait columns must keep the requested 1:3 ratio'
  );
  assert.ok(
    value('--wtf-portrait-content-scale') > 0.81
      && value('--wtf-portrait-content-scale') < 0.82,
    'portrait scale must be calculated independently from map width'
  );

  viewportWidth = 1600;
  viewportHeight = 2560;
  window.dispatchEvent(new window.Event('resize'));
  await nextFrame();
  assert.equal(root.dataset.wtfLayout, 'portrait', 'a 2560x1600 display rotated vertically must stay in portrait mode');
  assert.equal(
    value('--wtf-portrait-right-width') / value('--wtf-portrait-left-width'),
    3,
    'the 1:3 split must not drift at the target portrait resolution'
  );
  assert.ok(
    value('--wtf-portrait-content-scale') <= 1,
    'automatic portrait scaling must stay bounded on a large vertical display'
  );
  assert.equal(
    value('--wtf-portrait-panel-top') + value('--wtf-portrait-panel-height'),
    2468,
    'bottom docking must remain stable at the target portrait resolution'
  );

  leftPanel.classList.add('collapsed');
  rightPanel.classList.add('collapsed');
  window.dispatchEvent(new window.Event('resize'));
  await nextFrame();
  assert.equal(root.dataset.wtfPanelsCollapsed, 'true');
  assert.equal(shell.hidden, true, 'the shared shell must collapse with the native panels');

  leftPanel.classList.remove('collapsed');
  rightPanel.classList.remove('collapsed');
  viewportWidth = 1200;
  viewportHeight = 800;
  window.dispatchEvent(new window.Event('resize'));
  await nextFrame();
  assert.equal(root.dataset.wtfLayout, 'landscape', 'landscape must retain the original side layout');
  assert.equal(shell.hidden, true, 'portrait shell must disappear in landscape');

  console.log('Portrait unified panel validation passed.');
  dom.window.close();
})().catch((error) => {
  console.error(error);
  dom.window.close();
  process.exitCode = 1;
});
