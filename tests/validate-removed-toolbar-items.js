// Gen's toolbar: search, hide panels, rotation, Ruler, then the ping/route clear
// buttons. Phone sign-in and Screenshot OCR are removed. Full screen, the More
// menu (with its "Where am i?" toggle) and the location row are hidden but stay
// in the DOM, because the host clicks them on load and types screenshot names
// into the row. In portrait only the ping/route buttons wrap to a second row.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('../.tools/jsdom-test/node_modules/jsdom');

const root = path.resolve(__dirname, '..');
const enhancements = fs.readFileSync(path.join(root, 'eft-where-am-i', 'html', 'enhancements.js'), 'utf8');
const executor = fs.readFileSync(path.join(root, 'eft-where-am-i', 'Classes', 'JavaScriptExecutor.cs'), 'utf8');
assert.doesNotMatch(executor, /input\.offsetParent/, 'the hidden location input must still count as available');
assert.match(executor, /if \(coordinateButton && !coordinateButton\.disabled\)/, 'the hidden "Where am i?" toggle must still be clickable');
assert.match(enhancements, /\.map-toolbar > \.primary-tools \{\s*display: flex !important;/, 'Ruler must stay a direct toolbar button');

const dom = new JSDOM(
  `<body><div class="map-cont">
    <div class="panel_top desktop-panel"><div class="map-toolbar">
      <div class="quest-search p-relative"><input id="search" placeholder="Search quest / key"></div>
      <div class="toolbar-group view-tools">
        <div class="hint-root"><button id="hide-panels" aria-label="Hide panels"></button></div>
        <div class="hint-root" id="fullscreen-root"><button id="fullscreen" aria-label="Full screen"></button></div>
        <div class="hint-root"><button id="rotate" class="toolbar-rotation" aria-label="Rotate map: 0°">0°</button></div>
      </div>
      <div class="toolbar-group primary-tools">
        <div class="hint-root"><button id="ruler">Ruler</button></div>
        <div class="hint-root"><button id="ocr">OCR</button></div>
      </div>
      <div class="toolbar-group phone-tools"><div class="hint-root"><button id="phone">To phone</button></div></div>
      <div class="dropdown toolbar-more" id="more"><div class="dd-link"><button id="more-button">More</button></div></div>
    </div>
    <div class="toolbar-context" id="location-row"><input id="map-position-file" type="text"></div></div>
  </div></body>`,
  { runScripts: 'dangerously', url: 'https://tarkov-market.com/kr/maps/interchange', pretendToBeVisual: true }
);
const { window } = dom;
window.ResizeObserver = class ResizeObserver { observe() {} disconnect() {} };
window.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
window.CanvasRenderingContext2D.prototype = { drawImage() {}, fillText() {}, strokeText() {} };
window.chrome = { webview: { postMessage() {} } };
window.eval(enhancements);

(async () => {
  window.__wtfPingOverlay.configure({ map: 'interchange', pings: [] });
  window.__wtfRouteOverlay.configure({ map: 'interchange', nodes: [], maxNodes: 20, localNodeCount: 0 });
  await new Promise((resolve) => setTimeout(resolve, 60));
  const doc = window.document;
  const shown = (element) => window.getComputedStyle(element).display !== 'none'
    && !element.closest('[data-wtf-commercial-hidden="true"]')
    && [...ancestors(element)].every((node) => window.getComputedStyle(node).display !== 'none');
  function* ancestors(element) {
    for (let node = element.parentElement; node && node !== doc.body; node = node.parentElement) yield node;
  }
  for (const id of ['search', 'hide-panels', 'rotate', 'ruler', 'wtf-clear-pings-button', 'wtf-clear-route-button']) {
    assert.ok(shown(doc.getElementById(id)), `${id} must be visible`);
  }
  for (const id of ['fullscreen', 'ocr', 'phone', 'more-button', 'map-position-file']) {
    assert.ok(!shown(doc.getElementById(id)), `${id} must be hidden`);
  }
  // Script-only controls are hidden by CSS alone, so the host can still click them.
  for (const id of ['fullscreen-root', 'more', 'location-row']) {
    const element = doc.getElementById(id);
    assert.notEqual(element.inert, true, `${id} must stay scriptable`);
    assert.notEqual(element.getAttribute('data-wtf-commercial-hidden'), 'true', `${id} must stay scriptable`);
  }
  let fullscreenClicks = 0;
  doc.getElementById('fullscreen').addEventListener('click', () => { fullscreenClicks += 1; });
  doc.getElementById('fullscreen').click();
  assert.equal(fullscreenClicks, 1, 'the host must still be able to enter full screen');

  const pingButton = doc.getElementById('wtf-clear-pings-button');
  assert.ok(pingButton.previousElementSibling?.matches('.wtf-toolbar-break'), 'a line break must precede the clear buttons');
  assert.equal(window.getComputedStyle(pingButton.previousElementSibling).display, 'none', 'landscape keeps one row');
  doc.documentElement.dataset.wtfLayout = 'portrait';
  assert.equal(window.getComputedStyle(pingButton.previousElementSibling).display, 'block', 'portrait breaks before the clear buttons');
  assert.equal(pingButton.nextElementSibling?.id, 'wtf-clear-route-button', 'route clear button follows the ping button');

  console.log('PASS: toolbar is search / hide panels / rotate / Ruler / clear buttons; full screen, More and the location row are hidden but scriptable; portrait wraps only the clear buttons.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
