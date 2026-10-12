// Game text comes from Tarkov-Market's official localization: Korean mode opens
// the site's /kr/ pages, and our overlays read the store's name_l10n fields.
// Our own translation catalog is gone, but pins still key on the English name.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('../.tools/jsdom-test/node_modules/jsdom');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const enhancements = read('eft-where-am-i', 'html', 'enhancements.js');
const host = read('eft-where-am-i', 'UserControls', 'WhereAmI.cs');
const project = read('eft-where-am-i', 'eft-where-am-i.csproj');

assert.match(host, /https:\/\/tarkov-market\.com\/kr\/maps\/\{mapName\}/, 'Korean mode must open the official /kr/ map page');
assert.match(host, /GetMapUrl\(appSettings\.latest_map, appSettings\.language\)/, 'startup must pass the language to the map URL');
assert.match(host, /GetMapUrl\(selectedMap, appSettings\.language\)/, 'map switching must keep the language');
assert.doesNotMatch(host, /QuestTranslationService|__wtfSetKoreanLocalization/, 'the custom translation pipeline must be gone');
assert.doesNotMatch(enhancements, /__wtfSetKoreanLocalization|translateQuestStep|localizeNativeGameNames/, 'no custom game-text translation');
assert.doesNotMatch(project, /game-ko\.json/, 'the custom catalog must not be published');
assert.equal(fs.existsSync(path.join(root, 'eft-where-am-i', 'translations', 'game-ko.json')), false);
assert.equal(fs.existsSync(path.join(root, 'eft-where-am-i', 'Classes', 'QuestTranslationService.cs')), false);

const dom = new JSDOM(
  `<body>
    <div class="map-cont">
      <div class="panel_top"><div class="map-toolbar"><button type="button">x</button></div></div>
      <div class="panel_left"><div class="two-columns"></div></div>
      <div class="panel_right"><div class="items scroll">
        <div class="no-wrap d-flex" data-quest-uid="q-batya"><span>바티야</span></div>
        <div class="no-wrap d-flex" data-quest-uid="q-fuel"><span>연료 위기</span></div>
      </div></div>
      <canvas class="doc-map-canvas" width="1000" height="800"></canvas>
    </div>
    <div class="no-wrap"><input name="layers" value="on" checked><input name="layers" value="on"></div>
  </body>`,
  { runScripts: 'dangerously', url: 'https://tarkov-market.com/kr/maps/interchange', pretendToBeVisual: true }
);
const { window } = dom;
const { document } = window;
window.ResizeObserver = class ResizeObserver { observe() {} disconnect() {} };
window.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
window.CanvasRenderingContext2D.prototype = { drawImage() {}, fillText() {}, strokeText() {} };
window.HTMLCanvasElement.prototype.getContext = function getContext() {
  if (!this.__ctx) {
    let current = { a: 0.55, b: 0, c: 0, d: 0.55, e: 0, f: 0 };
    this.__ctx = { canvas: this, getTransform: () => ({ ...current }), setTransform(...a) { current = { a: a[0], b: a[1], c: a[2], d: a[3], e: a[4], f: a[5] }; } };
  }
  return this.__ctx;
};
const messages = [];
window.chrome = { webview: { postMessage: (message) => messages.push(JSON.parse(message)) } };
window.eval(enhancements);

const quests = [
  { uid: 'q-batya', name: 'Batya', name_l10n: { kr: '바티야' }, type: 'Storyline' },
  { uid: 'q-fuel', name: 'Fuel Crisis', name_l10n: { kr: '연료 위기' }, type: 'SideQuest' }
];
const markers = [
  { uid: 'm1', map: 'interchange', category: 'Quests', subCategory: 'Quest', questUid: 'q-batya', name: 'Find the patch', name_l10n: { kr: '패치 찾기' }, geometry: { x: 10, y: 10 }, level: 1 },
  { uid: 'm2', map: 'interchange', category: 'Quests', subCategory: 'Quest', questUid: 'q-fuel', name: 'Mark the tank', name_l10n: { kr: '탱크 표시' }, geometry: { x: 20, y: 30 }, level: 1 }
];
window.__wtfQuestLiveSource = async () => ({ allMarkers: markers, quests });

(async () => {
  window.__wtfSetEnhancementSettings({ language: 'ko' });
  window.__wtfQuestOverlay.configure({ map: 'interchange' });
  // A pin saved by an older build in the "Korean(English)" display form.
  window.__wtfQuestOverlay.setPinnedQuests(['바티야(Batya)']);
  for (let i = 0; i < 30 && document.querySelectorAll('.wtf-quest-marker').length < 1; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const batyaMarker = document.querySelector('.wtf-quest-marker[data-quest-uid="q-batya"]');
  assert.ok(batyaMarker, 'legacy bilingual pin must resolve to the English key and render');
  assert.equal(batyaMarker.title, '바티야 · 패치 찾기', 'marker labels use the official Korean quest and objective names');

  // Pinning from a Korean row sends the English name to the host database.
  const fuelPin = document.querySelector('[data-quest-uid="q-fuel"] .wtf-quest-pin');
  fuelPin.checked = true;
  fuelPin.dispatchEvent(new window.Event('change', { bubbles: true }));
  const toggled = messages.find((message) => message.action === 'quest-toggled');
  assert.deepEqual({ name: toggled?.questName, selected: toggled?.isSelected }, { name: 'Fuel Crisis', selected: true },
    'pins must keep the English quest name as their key');
  assert.equal(document.querySelectorAll('.wtf-quest-marker').length, 2);
  assert.equal(document.querySelector('[data-quest-uid="q-batya"] span:not(.alt)').textContent, '바티야',
    'native rows keep the site text untouched');

  console.log('PASS: Korean mode uses the official /kr/ site text, overlays use name_l10n, pins stay keyed by English names.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
