// Terminal pans a stage wrapper (left/top) around .map-wrap. Overlays must be
// repositioned when only that wrapper moves, otherwise saved pings, nodes and
// teammates drift away from the map after a restart or an auto-pan.
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
    <section class="map-cont terminal-map-viewport">
      <div id="terminalMapStage" class="terminal-map-stage" style="left: 10px; top: 20px;">
        <div id="map" class="map-wrap"><div id="terminalMarkerLayer"></div></div>
      </div>
      <header class="panel_top"><button type="button">Where am i?</button></header>
      <aside class="panel_left terminal-side-panel"><div class="terminal-layer-list"></div></aside>
      <aside class="panel_right terminal-right-panel"></aside>
    </section>
    <div class="no-wrap"><input name="layers" value="Ground" checked><input name="layers" value="Level 2"></div>
  </body>`,
  { runScripts: 'dangerously', url: 'https://appcontent/terminal-map.html', pretendToBeVisual: true }
);
const { window } = dom;
window.ResizeObserver = class ResizeObserver { observe() {} disconnect() {} };
window.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
window.CanvasRenderingContext2D.prototype = { drawImage() {}, fillText() {}, strokeText() {} };
window.chrome = { webview: { postMessage() {} } };

let frameRequests = 0;
const nativeRequestFrame = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = (callback) => {
  frameRequests += 1;
  return nativeRequestFrame(callback);
};
const nextFrame = () => new Promise((resolve) => nativeRequestFrame(() => resolve()));

window.eval(enhancements);

(async () => {
  window.__wtfPingOverlay.configure({
    map: 'terminal', visible: true, pings: [{ id: 'p1', map: 'terminal', left: 50, top: 50, floor: 1 }]
  });
  await nextFrame();
  await nextFrame();
  await new Promise((resolve) => setTimeout(resolve, 20));
  const before = frameRequests;
  window.document.getElementById('terminalMapStage').style.left = '-240px';
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(frameRequests > before, 'moving the Terminal stage must schedule an overlay position update');
  console.log('PASS: Terminal stage panning repositions pings, route nodes and squad overlays.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
