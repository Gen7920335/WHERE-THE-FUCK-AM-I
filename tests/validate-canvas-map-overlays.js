// 2026-10 Tarkov-Market UI: normal maps have no .map-wrap/.map-scene; the view
// matrix only reaches the doc canvas through setTransform. Quest pins, pings,
// route nodes and squad markers must follow that matrix.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('../.tools/jsdom-test/node_modules/jsdom');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const enhancements = read('eft-where-am-i', 'html', 'enhancements.js');
const constants = read('eft-where-am-i', 'Classes', 'Constants.cs');
const project = read('eft-where-am-i', 'eft-where-am-i.csproj');

// Static checks for the non-JSDOM parts of the 2026-10 fixes.
assert.match(constants, /window\.__wtfMapViewport = function\(\)/, 'dead-zone pan needs a viewport helper');
assert.match(constants, /document\.querySelector\('#map'\) \|\| document\.querySelector\('\.map-cont'\)/,
  'dead-zone pan must fall back to .map-cont when #map is gone');
assert.match(constants, /!marker\.hidden && rect\.width > 0 && rect\.height > 0/,
  'hidden player markers must not drive auto-pan from (0, 0)');
assert.doesNotMatch(constants.slice(constants.indexOf('window.__deadZoneCalc')), /var mapEl = document\.querySelector\('#map'\);/,
  'dead-zone calc must not require #map');
assert.match(project, /<None Include="\.\.\\LICENSE" Link="LICENSE">[\s\S]*?<CopyToPublishDirectory>/,
  'LICENSE must be published with the portable build');
assert.match(project, /<PublishReferencesDocumentationFiles>false<\/PublishReferencesDocumentationFiles>/,
  'package XML documentation must stay out of the portable build');

const definition = { width: 4000, height: 3900, rotate: 90, xOffset: 2166, yOffset: 2004, ratio: 2 };
const projectPercent = (x, y) => {
  const radians = -definition.rotate * (Math.PI / 180);
  const rotatedX = (x * Math.cos(radians)) - (y * Math.sin(radians));
  const rotatedY = (x * Math.sin(radians)) + (y * Math.cos(radians));
  return {
    left: ((definition.xOffset - (rotatedX * definition.ratio)) / definition.width) * 100,
    top: ((definition.yOffset - (rotatedY * definition.ratio)) / definition.height) * 100
  };
};

const dom = new JSDOM(
  `<body>
    <div class="map-cont">
      <div class="panel_top"><button type="button">Native</button></div>
      <div class="panel_left"><div class="two-columns"><div>
        <div><div class="bold">Quests</div></div>
        <div class="items"><div id="native-quest-visibility" class="d-flex"><span>Quest</span></div></div>
      </div></div></div>
      <div class="panel_right"><div class="items scroll">
        <div class="no-wrap d-flex" data-quest-uid="q0"><span>Quest 0</span></div>
        <div class="no-wrap d-flex" data-quest-uid="q1"><span>Quest 1</span></div>
      </div></div>
      <canvas class="doc-map-canvas" style="display: none;" width="300" height="150"></canvas>
      <canvas class="doc-map-canvas" width="1200" height="800"></canvas>
      <canvas class="markers-canvas" width="1200" height="800"></canvas>
      <canvas class="players-canvas" width="1200" height="800"></canvas>
    </div>
    <div class="no-wrap"><input name="layers" value="Ground" checked><input name="layers" value="Level 2"></div>
  </body>`,
  { runScripts: 'dangerously', url: 'https://tarkov-market.com/maps/interchange', pretendToBeVisual: true }
);
const { window } = dom;
const { document } = window;
window.ResizeObserver = class ResizeObserver { observe() {} disconnect() {} };
window.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
window.CanvasRenderingContext2D.prototype = { drawImage() {}, fillText() {}, strokeText() {} };
window.confirm = () => true;

// Minimal 2D context: the site keeps its view matrix on the context after drawing.
const contexts = new Map();
window.HTMLCanvasElement.prototype.getContext = function getContext() {
  if (!contexts.has(this)) {
    let current = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    contexts.set(this, {
      canvas: this,
      getTransform: () => ({ ...current }),
      setTransform(...args) {
        current = args.length >= 6
          ? { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] }
          : { ...args[0] };
      },
      clearRect() {}, beginPath() {}, arc() {}, stroke() {}, fill() {}, rotate() {}, moveTo() {}, lineTo() {}, closePath() {}
    });
  }
  return contexts.get(this);
};

let frameRequests = 0;
const nativeRequestFrame = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = (callback) => {
  frameRequests += 1;
  return nativeRequestFrame(callback);
};
const nextFrame = () => new Promise((resolve) => nativeRequestFrame(() => resolve()));

const messages = [];
window.chrome = { webview: { postMessage: (message) => messages.push(JSON.parse(message)) } };

const [hiddenDocCanvas, docCanvas] = document.querySelectorAll('canvas.doc-map-canvas');
const docContext = docCanvas.getContext('2d');
// First native draw before our script loads: zoom 0.55, panned.
docContext.setTransform(0.55, 0, 0, 0.55, -457.5, -630.5);

window.eval(enhancements);

const markers = [
  { uid: 'm0', map: 'interchange', category: 'Quests', subCategory: 'Quest', questUid: 'q0', name: 'Objective 0', geometry: { x: -50, y: 20 }, level: 1 },
  { uid: 'm1', map: 'interchange', category: 'Quests', subCategory: 'Quest', questUid: 'q1', name: 'Objective 1', geometry: { x: 120, y: -80 }, level: 1 },
  {
    uid: 'z0', map: 'interchange', category: 'Quests', subCategory: 'Quest', questUid: 'q0', name: 'Zone 0',
    geometry: { points: [[-10, -10], [10, -10], [10, 10], [-10, 10]] }, level: 1
  }
];
const quests = [
  { uid: 'q0', name: 'Quest 0', type: 'SideQuest', requiredForKappa: true },
  { uid: 'q1', name: 'Quest 1', type: 'Storyline', requiredForKappa: false }
];
window.__wtfQuestLiveSource = async () => ({ allMarkers: markers, quests });

const expectedScreen = (matrix, left, top) => {
  const mapX = (left / 100) * definition.width;
  const mapY = (top / 100) * definition.height;
  return {
    x: (matrix.a * mapX) + (matrix.c * mapY) + matrix.e,
    y: (matrix.b * mapX) + (matrix.d * mapY) + matrix.f
  };
};
const near = (actual, expected, label) => {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: expected ${expected}, got ${actual}`);
};
const assertMarkerAt = (element, matrix, percent, label) => {
  const expected = expectedScreen(matrix, percent.left, percent.top);
  near(Number.parseFloat(element.style.left), expected.x, `${label} x`);
  near(Number.parseFloat(element.style.top), expected.y, `${label} y`);
};

(async () => {
  window.__wtfQuestOverlay.configure({ map: 'interchange' });
  window.__wtfQuestOverlay.setPinnedQuests(['Quest 0', 'Quest 1']);
  for (let index = 0; index < 20 && document.querySelectorAll('.wtf-quest-marker').length < 2; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  await nextFrame();
  await nextFrame();

  for (const id of ['wtf-quest-layer']) {
    assert.ok(document.getElementById(id)?.parentElement === document.querySelector('.map-cont'), `${id} must live in .map-cont`);
  }
  const questMarkers = [...document.querySelectorAll('.wtf-quest-marker')];
  assert.equal(questMarkers.length, 2, 'both pinned quest points must render on the canvas UI');
  let matrix = { a: 0.55, b: 0, c: 0, d: 0.55, e: -457.5, f: -630.5 };
  assertMarkerAt(questMarkers[0], matrix, projectPercent(-50, 20), 'quest marker (initial view)');
  const zone = document.querySelector('.wtf-quest-zone');
  assert.ok(zone, 'pinned quest areas must render on the canvas UI');
  const firstZonePoint = zone.getAttribute('points').split(' ')[0].split(',').map(Number);
  const zoneExpected = expectedScreen(matrix, projectPercent(-10, -10).left, projectPercent(-10, -10).top);
  near(firstZonePoint[0], zoneExpected.x, 'quest zone x');
  near(firstZonePoint[1], zoneExpected.y, 'quest zone y');

  // The native view rotates by 90 degrees and zooms; overlays must follow the next redraw.
  matrix = { a: 0, b: 1.1, c: -1.1, d: 0, e: 4400, f: -900 };
  docContext.setTransform(1, 0, 0, 1, 0, 0);
  docContext.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
  await nextFrame();
  await nextFrame();
  assertMarkerAt(questMarkers[1], matrix, projectPercent(120, -80), 'quest marker (rotated view)');

  // Pings: Alt+left click converts through the inverse native matrix.
  const mapContainer = document.querySelector('.map-cont');
  let siteClicks = 0;
  mapContainer.addEventListener('click', () => { siteClicks += 1; });
  window.__wtfPingOverlay.configure({ map: 'interchange', pings: [], visible: true });
  assert.ok(document.getElementById('wtf-ping-layer'), 'ping layer must exist on the canvas UI');
  const clickPoint = expectedScreen(matrix, 40, 60);
  let before = messages.length;
  docCanvas.dispatchEvent(new window.MouseEvent('pointerdown', {
    bubbles: true, cancelable: true, altKey: true, button: 0, clientX: clickPoint.x, clientY: clickPoint.y
  }));
  docCanvas.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, altKey: true, button: 0 }));
  const ping = messages.slice(before).find((message) => message.action === 'map-ping-add');
  assert.ok(ping, 'Alt+click must add a ping on the canvas UI');
  near(ping.left, 40, 'ping left');
  near(ping.top, 60, 'ping top');
  assert.equal(siteClicks, 0, 'the click that placed a ping must not reach the site');
  docCanvas.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  assert.equal(siteClicks, 1, 'ordinary clicks must still reach the site');

  window.__wtfPingOverlay.configure({
    map: 'interchange', visible: true, pings: [{ id: 'p1', map: 'interchange', left: 40, top: 60, floor: 1 }]
  });
  await nextFrame();
  await nextFrame();
  assertMarkerAt(document.querySelector('.wtf-ping-marker'), matrix, { left: 40, top: 60 }, 'ping marker');

  // Route nodes: wheel click adds a node; rendered nodes follow the view.
  window.__wtfRouteOverlay.configure({ map: 'interchange', nodes: [], maxNodes: 20, localNodeCount: 0, visible: true });
  assert.ok(document.getElementById('wtf-route-layer'), 'route layer must exist on the canvas UI');
  const nodePoint = expectedScreen(matrix, 55, 35);
  before = messages.length;
  docCanvas.dispatchEvent(new window.MouseEvent('pointerdown', {
    bubbles: true, cancelable: true, button: 1, clientX: nodePoint.x, clientY: nodePoint.y
  }));
  const node = messages.slice(before).find((message) => message.action === 'map-route-node-add');
  assert.ok(node, 'wheel click must add a route node on the canvas UI');
  near(node.left, 55, 'route node left');
  near(node.top, 35, 'route node top');
  window.__wtfRouteOverlay.configure({
    map: 'interchange', maxNodes: 20, localNodeCount: 2, visible: true,
    nodes: [
      { id: 'n1', map: 'interchange', left: 55, top: 35, floor: 1, createdAt: 1 },
      { id: 'n2', map: 'interchange', left: 45, top: 50, floor: 1, createdAt: 2 }
    ]
  });
  await nextFrame();
  await nextFrame();
  const routeNodes = [...document.querySelectorAll('.wtf-route-node')];
  assert.equal(routeNodes.length, 2);
  assertMarkerAt(routeNodes[0], matrix, { left: 55, top: 35 }, 'route node');
  const line = document.querySelector('.wtf-route-line');
  near(Number(line.getAttribute('x2')), Number.parseFloat(routeNodes[1].style.left), 'route line end');

  // Squad: teammate position and heading follow the native view (rotated 90 degrees).
  window.__wtfSquadOverlay.configure({
    map: 'interchange',
    members: [{ name: 'Mate', left: 30, top: 70, direction: 30 }]
  });
  await nextFrame();
  await nextFrame();
  const mate = document.querySelector('.wtf-squad-marker');
  assert.ok(mate, 'squad marker must render on the canvas UI');
  assertMarkerAt(mate, matrix, { left: 30, top: 70 }, 'squad marker');
  assert.equal(mate.style.getPropertyValue('--wtf-squad-direction'), '120deg', 'squad heading must include the view rotation');

  // Repeated identical redraws must not schedule overlay work (CPU guard).
  await nextFrame();
  const requestsBefore = frameRequests;
  for (let index = 0; index < 50; index += 1) {
    docContext.setTransform(1, 0, 0, 1, 0, 0);
    docContext.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
  }
  assert.equal(frameRequests, requestsBefore, 'unchanged native redraws must not schedule overlay updates');
  assert.equal(hiddenDocCanvas.__wtfNativeView, undefined, 'the hidden overview canvas must not drive overlays');

  console.log('PASS: canvas UI quest points/areas, pings, route nodes and squad markers follow the native view matrix (pan, zoom, 90° rotation); click guard and CPU guard hold.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
