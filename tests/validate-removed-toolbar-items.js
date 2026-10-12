// Gen's toolbar choice: drop quest/key search, Screenshot OCR and phone sign-in
// (removed from layout and not clickable); keep view tools, Ruler, More and
// our ping/route buttons.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('../.tools/jsdom-test/node_modules/jsdom');

const enhancements = fs.readFileSync(path.resolve(__dirname, '..', 'eft-where-am-i', 'html', 'enhancements.js'), 'utf8');
assert.match(enhancements, /\.panel_top:has\(\.dd-link \[aria-expanded="true"\]\) \{\s*z-index: 40 !important;/,
  'an open More menu must sit above the side panels and the pinned-quest panel');
const dom = new JSDOM(
  `<body><div class="map-cont">
    <div class="panel_top desktop-panel"><div class="map-toolbar">
      <div class="quest-search p-relative"><input placeholder="Search quest / key"></div>
      <div class="toolbar-group view-tools">
        <div class="hint-root"><button aria-label="Hide panels"></button></div>
        <div class="hint-root"><button class="toolbar-rotation" aria-label="Rotate map: 0°">0°</button></div>
      </div>
      <div class="toolbar-group primary-tools">
        <div class="hint-root"><button id="ruler">Ruler</button></div>
        <div class="hint-root" id="ocr-root"><button id="ocr">OCR</button></div>
      </div>
      <div class="toolbar-group phone-tools"><div class="hint-root"><button>To phone</button></div></div>
      <div class="dropdown toolbar-more"><div class="dd-link"><button id="more">More</button></div>
        <div class="dd-content"><div class="overflow-tools"><button id="more-ruler">Ruler</button><button id="more-ocr">Screenshot OCR</button></div>
        <button id="where">Where am i?</button><button id="suggest">Suggest marker</button></div>
      </div>
    </div></div>
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
  await new Promise((resolve) => setTimeout(resolve, 60));
  const doc = window.document;
  const hidden = (element) => window.getComputedStyle(element).display === 'none'
    || element.closest('[data-wtf-commercial-hidden="true"]') !== null;
  assert.ok(hidden(doc.querySelector('.quest-search')), 'quest/key search must be removed');
  assert.ok(hidden(doc.querySelector('.phone-tools')), 'phone sign-in must be removed');
  assert.ok(hidden(doc.getElementById('ocr')), 'toolbar Screenshot OCR must be removed');
  assert.ok(hidden(doc.getElementById('more-ocr')), 'More-menu Screenshot OCR must be removed');
  for (const id of ['ruler', 'more', 'more-ruler', 'where', 'suggest']) {
    assert.ok(!hidden(doc.getElementById(id)), `${id} must stay`);
  }
  assert.ok(!hidden(doc.querySelector('.toolbar-rotation')), 'map rotation must stay');
  console.log('PASS: search, Screenshot OCR and phone sign-in are removed; view tools, Ruler, More and Where am i? stay.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
