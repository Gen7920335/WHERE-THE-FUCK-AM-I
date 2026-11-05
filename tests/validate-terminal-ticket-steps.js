// The Ticket on Terminal: Tarkov-Market has no Terminal markers for it, so the
// app draws numbered rings (1-11) and, on click, a popup rebuilt from the site's
// own MapPopup markup (same element tree, classes and scoped-style attributes)
// with the step text and wiki photos. Terminal also opens at the site's 270 deg
// view once; the app adds 14.7 deg on top (see validate-terminal-tilt.js).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('../.tools/jsdom-test/node_modules/jsdom');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const enhancements = read('eft-where-am-i', 'html', 'enhancements.js');
const host = read('eft-where-am-i', 'UserControls', 'WhereAmI.cs');
const project = read('eft-where-am-i', 'eft-where-am-i.csproj');
const photoDir = path.join(root, 'eft-where-am-i', 'html', 'maps', 'terminal-photos');

// --- Static: step data, photos, credits, packaging, photo host -------------
const block = enhancements.match(/const builtInQuestSteps = \{[\s\S]*?\n {2}\};/)?.[0];
assert.ok(block, 'builtInQuestSteps block is missing');
const stepCount = (block.match(/\n {10}x: -?[\d.]+, y: -?[\d.]+, en: /g) || []).length;
assert.equal(stepCount, 11, 'The Ticket must keep 11 Terminal steps');
assert.match(block, /x: 338\.7, y: -259\.6, en: 'Unlock the pier door'/, 'step 10 must stay on the measured Pier Door icon');
const sources = [...block.matchAll(/src: '(maps\/terminal-photos\/[^']+\.webp)'/g)].map((match) => match[1]);
assert.equal(sources.length, 22, 'The Ticket must reference 22 photos');
assert.equal(new Set(sources).size, 22, 'photo paths must be unique');
for (const source of sources) {
  assert.ok(fs.existsSync(path.join(root, 'eft-where-am-i', 'html', source)), `missing photo ${source}`);
}
const photoFiles = fs.readdirSync(photoDir).filter((name) => name.endsWith('.webp'));
assert.equal(photoFiles.length, 22, 'terminal-photos must hold exactly the 22 referenced photos');
const credits = fs.readFileSync(path.join(photoDir, 'CREDITS.txt'), 'utf8');
assert.match(credits, /CC BY-SA 3\.0/, 'photo credits must name the wiki license');
for (const name of photoFiles) assert.ok(credits.includes(name), `CREDITS.txt must list ${name}`);
assert.equal((block.match(/details: \{ en: '/g) || []).length, 11, 'every step needs an English description');
assert.equal((block.match(/, kr: '[^']+' \}/g) || []).length, 11 + 22, 'every description and caption needs Korean text');
assert.match(project, /<Content Include="html\\maps\\terminal-photos\\\*\*\\\*\.webp;html\\maps\\terminal-photos\\CREDITS\.txt">[\s\S]*?<ExcludeFromSingleFile>true<\/ExcludeFromSingleFile>/,
  'photos and credits must be published next to the app');
assert.match(host, /SetVirtualHostNameToFolderMapping\(\s*"appcontent",\s*htmlFolder,/,
  'the content WebView must serve the html folder as https://appcontent/');

// --- Runtime ------------------------------------------------------------------
const definition = { width: 3850, height: 4150 };
const makeDom = (url, storage = {}) => {
  const dom = new JSDOM(
    `<head><style>.map-popup[data-v-0608a649]{position:absolute}.popup-layer[data-v-f5f53a79]{position:absolute}</style></head>
    <body>
      <div class="map-cont">
        <div class="panel_top"><button type="button">Native</button></div>
        <div class="panel_left"></div>
        <div class="panel_right"><div class="tools tools_quests"><div class="items scroll"></div></div></div>
        <canvas class="doc-map-canvas" style="display: none;" width="300" height="150"></canvas>
        <canvas class="doc-map-canvas" width="1200" height="800"></canvas>
        <canvas class="markers-canvas" width="1200" height="800"></canvas>
      </div>
      <div class="no-wrap"><input name="layers" value="Ground" checked><input name="layers" value="Level 2"></div>
    </body>`,
    { runScripts: 'dangerously', url, pretendToBeVisual: true }
  );
  const { window } = dom;
  for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, value);
  window.ResizeObserver = class ResizeObserver { observe() {} disconnect() {} };
  window.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
  window.CanvasRenderingContext2D.prototype = {
    drawImage() {}, fillText() {}, strokeText() {}, clearRect() {}, save() {}, restore() {}, translate() {}, rotate() {}
  };
  const contexts = new Map();
  window.HTMLCanvasElement.prototype.getContext = function getContext() {
    if (!contexts.has(this) && this.classList.contains('markers-canvas')) {
      // The marker canvas goes through the app's canvas hooks (icon positions).
      const context = Object.create(window.CanvasRenderingContext2D.prototype);
      context.canvas = this;
      context.getTransform = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      contexts.set(this, context);
    }
    if (!contexts.has(this)) {
      let current = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
      contexts.set(this, {
        canvas: this,
        getTransform: () => ({ ...current }),
        setTransform(...args) {
          current = args.length >= 6 ? { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] } : { ...args[0] };
        },
        clearRect() {}, beginPath() {}, arc() {}, stroke() {}, fill() {}, rotate() {}, moveTo() {}, lineTo() {}, closePath() {}
      });
    }
    return contexts.get(this);
  };
  // Layout: give rings and the map container real boxes.
  const realRect = window.Element.prototype.getBoundingClientRect;
  window.Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (this.classList?.contains('wtf-quest-marker')) {
      const x = Number.parseFloat(this.style.left) || 0;
      const y = Number.parseFloat(this.style.top) || 0;
      return { left: x - 15, top: y - 15, width: 30, height: 30, right: x + 15, bottom: y + 15, x: x - 15, y: y - 15 };
    }
    return realRect.call(this);
  };
  window.chrome = { webview: { postMessage: () => {} } };
  window.document.querySelectorAll('canvas.doc-map-canvas')[1].getContext('2d').setTransform(0.5, 0, 0, 0.5, 10, 20);
  window.__wtfQuestLiveSource = async () => ({
    allMarkers: [],
    quests: [{ uid: 'ticket-uid', name: 'The Ticket', name_l10n: { kr: '티켓' }, type: 'Storyline', requiredForKappa: false }]
  });
  window.eval(enhancements);
  return dom;
};

const waitFor = async (check, label) => {
  for (let index = 0; index < 100; index += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`timed out waiting for ${label}`);
};
const click = (window, element) => element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

(async () => {
  // English page, first Terminal visit: default rotation 270 is stored for the site.
  const dom = makeDom('https://tarkov-market.com/maps/terminal');
  const { window } = dom;
  const { document } = window;
  assert.equal(window.localStorage.getItem('tm_map_rotation:terminal'), '270', 'first Terminal visit must open at 270 deg');
  window.__wtfQuestOverlay.configure({ map: 'terminal' });
  window.__wtfQuestOverlay.setPinnedQuests(['The Ticket']);
  await waitFor(() => document.querySelectorAll('.wtf-quest-marker[data-step]').length === 11, '11 rings');

  const ring = (step) => document.querySelector(`.wtf-quest-marker[data-step="${step}"]`);
  click(window, ring(1));
  const popup = () => document.querySelector('.map-cont > .popup-layer > .map-popup[data-wtf-built-in-step]');
  assert.ok(popup(), 'ring 1 must open a popup inside the site popup layer');
  const root = popup();
  assert.ok(root.hasAttribute('data-v-0608a649') && root.hasAttribute('data-v-f5f53a79'), 'popup must carry the site scoped-style attributes');
  for (const node of root.querySelectorAll('*:not(svg *):not(.wtf-native-popup-close)')) {
    assert.ok(node.hasAttribute('data-v-0608a649'), `${node.tagName}.${node.className} must carry the popup scope`);
  }
  // Same element tree as the site's quest popup.
  const children = [...root.children].map((node) => node.className);
  assert.deepEqual(children, ['inner', '', 'fs-0 mt-10', 'img-preview-cont scroll'], 'popup sections must match the site popup');
  const title = root.querySelector('.inner > .d-flex.h-space-between.v-start > .w-100 > div > .d-flex.h-space-between > a.title.plus.d-flex');
  assert.ok(title, 'quest title link must use the site classes');
  assert.ok(title.classList.contains('story') && title.classList.contains('side'), 'storyline, non-Kappa quest classes must match the site');
  assert.equal(title.textContent, 'The Ticket');
  assert.equal(title.getAttribute('href'), '/progression/quests?quest=ticket-uid');
  assert.equal(root.querySelector('.inner .title:not(a) > div').textContent, 'Find the key for the armory');
  const wiki = root.querySelector('.mt-n5 > a.ext-link.sub');
  assert.equal(wiki.textContent, 'Wiki');
  assert.equal(wiki.getAttribute('href'), 'https://escapefromtarkov.fandom.com/wiki/The_Ticket');
  assert.match(root.querySelector('.inner > div:last-child').textContent, /The Armory key spawns in one of 4 places/);
  assert.equal(root.querySelector('.ml-15.self-start > .large.pointer.text-right').textContent, '⤢');
  assert.ok(root.querySelector('.wtf-native-popup-close'), 'the app close button must be added like on site popups');
  const photo = () => root.querySelector('.fs-0.mt-10 > .p-relative > img');
  assert.equal(photo().getAttribute('src'), 'https://appcontent/maps/terminal-photos/armory-key-1-body-armory.webp');
  assert.equal(root.querySelector(':scope > div:nth-child(2) > .px-10.bold').textContent, 'Inside a dead RUAF soldier outside the armory building.');
  assert.ok(root.querySelector('.p-relative > .img-nav') && root.querySelector('.p-relative > .mouse-hint svg.icon_mid_mouse'), 'arrows and wheel hint must match the site');
  const previews = () => [...root.querySelectorAll('.img-preview-cont > img.img-preview')];
  assert.equal(previews().length, 4);
  assert.deepEqual(previews().map((node) => node.classList.contains('selected')), [true, false, false, false]);

  // Photo navigation: arrows, wheel, thumbnails, enlarge.
  click(window, root.querySelectorAll('.img-nav > div')[1]);
  assert.match(photo().getAttribute('src'), /armory-key-2-table\.webp$/, 'right arrow must show the next photo');
  click(window, root.querySelectorAll('.img-nav > div')[0]);
  click(window, root.querySelectorAll('.img-nav > div')[0]);
  assert.match(photo().getAttribute('src'), /armory-key-4-body-spawn\.webp$/, 'left arrow must wrap to the last photo');
  root.querySelector('.p-relative').dispatchEvent(new window.WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
  assert.match(photo().getAttribute('src'), /armory-key-1-body-armory\.webp$/, 'wheel down must step to the next photo');
  click(window, previews()[2]);
  assert.match(photo().getAttribute('src'), /armory-key-3-body-route\.webp$/, 'thumbnail click must select that photo');
  assert.ok(previews()[2].classList.contains('selected'));
  click(window, root.querySelector('.large.pointer.text-right'));
  assert.ok(root.classList.contains('xlsize'), 'the size toggle must enlarge the popup like the site');
  click(window, photo());
  assert.ok(!root.classList.contains('xlsize'), 'clicking the photo must toggle the size back');

  // Single-photo step: no thumbnails, no wheel hint (site shows them only for 2+).
  click(window, ring(10));
  assert.equal(popup().dataset.wtfBuiltInStep, '10', 'another ring must replace the open popup');
  assert.equal(document.querySelectorAll('.map-popup[data-wtf-built-in-step]').length, 1);
  assert.ok(!popup().querySelector('.img-preview-cont') && !popup().querySelector('.mouse-hint'));
  assert.match(popup().querySelector('.p-relative > img').getAttribute('src'), /pier-door\.webp$/);

  // The popup follows the ring on pan/zoom.
  ring(10).style.left = '345px';
  ring(10).style.top = '210px';
  window.__wtfRouteOverlay?.configure?.({ map: 'terminal', nodes: [], maxNodes: 40, localNodeCount: 0 });
  await new Promise((resolve) => window.requestAnimationFrame(() => setTimeout(resolve, 0)));

  // Like the site's popup it stays open while the map is dragged; a click
  // (press and release without moving) on the map closes it.
  const mapCanvas = document.querySelectorAll('canvas.doc-map-canvas')[1];
  const pointer = (type, x, y) => mapCanvas.dispatchEvent(new window.PointerEvent(type, { bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y }));
  pointer('pointerdown', 600, 500);
  pointer('pointermove', 640, 520);
  pointer('pointermove', 700, 540);
  pointer('pointerup', 700, 540);
  assert.ok(popup(), 'dragging the map must keep the popup open');
  window.dispatchEvent(new window.WheelEvent('wheel', { deltaY: -120, bubbles: true }));
  assert.ok(popup(), 'zooming the map must keep the popup open');
  pointer('pointerdown', 600, 500);
  pointer('pointerup', 601, 501);
  assert.ok(!popup(), 'a click on the map must close the popup');
  click(window, ring(10));
  assert.ok(popup(), 'ring 10 popup reopened');

  // Rings stand beside the site's icons (here: an icon drawn exactly on ring 10's
  // spot and one between rings 8 and 9), and never on each other.
  const markers = document.querySelector('canvas.markers-canvas').getContext('2d');
  const base = (step) => {
    const node = ring(step);
    return { x: Number.parseFloat(node.style.left) - Number(node.dataset.spreadX || 0), y: Number.parseFloat(node.style.top) - Number(node.dataset.spreadY || 0) };
  };
  const spot10 = base(10);
  const spot8 = base(8);
  markers.clearRect(0, 0, 1200, 800);
  markers.drawImage({ width: 24, height: 24 }, spot10.x - 12, spot10.y - 12, 24, 24);
  markers.drawImage({ width: 24, height: 24 }, spot8.x - 12, spot8.y - 12, 24, 24);
  assert.equal(window.__wtfNativeIconFrame().length, 2, 'the app must record where the site drew its icons');
  await new Promise((resolve) => window.requestAnimationFrame(() => setTimeout(resolve, 0)));
  await new Promise((resolve) => window.requestAnimationFrame(() => setTimeout(resolve, 0)));
  const centre = (step) => ({ x: Number.parseFloat(ring(step).style.left), y: Number.parseFloat(ring(step).style.top) });
  for (const [step, icon] of [[10, spot10], [8, spot8]]) {
    const at = centre(step);
    const distance = Math.hypot(at.x - icon.x, at.y - icon.y);
    assert.ok(distance >= 13 + 15 + 2 - 0.01, `ring ${step} must clear the site icon (distance ${distance.toFixed(1)})`);
    assert.ok(distance <= 45 + 0.01, `ring ${step} must stay next to its spot (distance ${distance.toFixed(1)})`);
  }
  const steps = [...document.querySelectorAll('.wtf-quest-marker[data-step]')].map((node) => node.dataset.step);
  for (const a of steps) {
    for (const b of steps) {
      if (a >= b) continue;
      const pa = centre(a);
      const pb = centre(b);
      const before = Math.hypot(base(a).x - base(b).x, base(a).y - base(b).y);
      if (before < 32) assert.ok(Math.hypot(pa.x - pb.x, pa.y - pb.y) >= 32 - 0.01, `rings ${a} and ${b} must not overlap`);
    }
  }
  // The open popup follows its ring to the new place.
  assert.equal(popup().style.left, ring(10).style.left, 'popup must follow the moved ring');
  markers.clearRect(0, 0, 1200, 800);
  await new Promise((resolve) => window.requestAnimationFrame(() => setTimeout(resolve, 0)));
  window.__wtfQuestOverlay.setPinnedQuests(['The Ticket']);
  await new Promise((resolve) => window.requestAnimationFrame(() => setTimeout(resolve, 0)));
  assert.equal(Number(ring(10).dataset.spreadX), 0, 'with no site icon there the ring sits on its spot');

  // Escape (also sent by the close button) closes it.
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(document.querySelectorAll('.map-popup[data-wtf-built-in-step]').length, 0, 'Escape must close the popup');
  dom.window.close();

  // Korean page: step texts and captions in Korean, quest name from the site.
  const kr = makeDom('https://tarkov-market.com/kr/maps/terminal', { 'tm_map_rotation:terminal': '0', wtf_terminal_default_rotation_v1: '1' });
  assert.equal(kr.window.localStorage.getItem('tm_map_rotation:terminal'), '0', 'a rotation the user chose must be kept');
  kr.window.__wtfQuestOverlay.configure({ map: 'terminal' });
  kr.window.__wtfQuestOverlay.setPinnedQuests(['The Ticket']);
  await waitFor(() => kr.window.document.querySelectorAll('.wtf-quest-marker[data-step]').length === 11, '11 Korean rings');
  click(kr.window, kr.window.document.querySelector('.wtf-quest-marker[data-step="6"]'));
  const krPopup = kr.window.document.querySelector('.map-popup[data-wtf-built-in-step="6"]');
  assert.equal(krPopup.querySelector('a.title > div').textContent, '티켓', 'Korean page must use the site quest name');
  assert.equal(krPopup.querySelector('a.title').getAttribute('href'), '/kr/progression/quests?quest=ticket-uid');
  assert.equal(krPopup.querySelector('.inner .title:not(a) > div').textContent, '(선택) 공구 세트 챙기기');
  assert.match(krPopup.querySelector('.inner > div:last-child').textContent, /Toolset 3개/);
  assert.match(krPopup.querySelector(':scope > div:nth-child(2) > .px-10.bold').textContent, /BRDM 앞 콘크리트 바리케이드 위/);
  kr.window.close();

  console.log('PASS: The Ticket 11 rings, site-identical popup (scope, tree, classes), 22 photos with arrows/wheel/thumbnails/enlarge, drag/zoom keep and click close, rings beside site icons, Escape close, Korean text, default 270 deg Terminal rotation kept once.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
