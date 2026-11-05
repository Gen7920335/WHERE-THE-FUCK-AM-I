// Terminal view tilt: the site rotates maps only in 90-degree steps, so on
// Terminal the app adds 14.7 deg (270 -> -75.3, the in-game wall map). The
// extra angle goes into the view transform of the site's map canvases about the
// canvas centre; icons and labels are drawn upright around their own anchor;
// map mouse input is turned back into the site's unrotated space; the player
// heading adds the same angle. Other maps must be untouched.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('../.tools/jsdom-test/node_modules/jsdom');
const { implForWrapper } = require('../.tools/jsdom-test/node_modules/jsdom/lib/generated/idl/utils.js');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const enhancements = read('eft-where-am-i', 'html', 'enhancements.js');
const constants = read('eft-where-am-i', 'Classes', 'Constants.cs');

const TILT = 14.7;
const near = (actual, expected, label, epsilon = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${label}: expected ${expected}, got ${actual}`);
const angleOf = (m) => Math.atan2(m.b, m.a) * 180 / Math.PI;
const apply = (m, x, y) => ({ x: (m.a * x) + (m.c * y) + m.e, y: (m.b * x) + (m.d * y) + m.f });
const multiply = (m, n) => ({
  a: (m.a * n.a) + (m.c * n.b), b: (m.b * n.a) + (m.d * n.b),
  c: (m.a * n.c) + (m.c * n.d), d: (m.b * n.c) + (m.d * n.d),
  e: (m.a * n.e) + (m.c * n.f) + m.e, f: (m.b * n.e) + (m.d * n.f) + m.f
});

const makeDom = (url) => {
  const dom = new JSDOM(
    `<body>
      <div class="map-cont">
        <div class="panel_top"><button type="button">Native</button></div>
        <canvas class="doc-map-canvas" style="display: none;" width="300" height="150"></canvas>
        <canvas class="doc-map-canvas" width="1200" height="800"></canvas>
        <canvas class="markers-canvas" width="1200" height="800"></canvas>
        <canvas class="players-canvas" width="1200" height="800"></canvas>
      </div>
    </body>`,
    { runScripts: 'dangerously', url, pretendToBeVisual: true }
  );
  const { window } = dom;
  window.ResizeObserver = class ResizeObserver { observe() {} disconnect() {} };
  // A small 2D context with a real matrix stack; the app hooks its prototype.
  const draws = [];
  class Context {
    constructor(canvas) { this.canvas = canvas; this.m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; this.stack = []; this.fillStyle = '#000'; this.dash = []; }
    getTransform() { return { ...this.m }; }
    setTransform(...args) {
      const s = args.length >= 6 ? { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] } : { ...args[0] };
      this.m = { a: s.a, b: s.b, c: s.c, d: s.d, e: s.e, f: s.f };
    }
    resetTransform() { this.m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; }
    save() { this.stack.push({ ...this.m }); }
    restore() { if (this.stack.length) this.m = this.stack.pop(); }
    translate(x, y) { this.m = multiply(this.m, { a: 1, b: 0, c: 0, d: 1, e: x, f: y }); }
    rotate(r) { this.m = multiply(this.m, { a: Math.cos(r), b: Math.sin(r), c: -Math.sin(r), d: Math.cos(r), e: 0, f: 0 }); }
    scale(x, y) { this.m = multiply(this.m, { a: x, b: 0, c: 0, d: y, e: 0, f: 0 }); }
    getLineDash() { return this.dash; }
    setLineDash(dash) { this.dash = dash; }
    record(op, x, y) { draws.push({ op, canvas: this.canvas.className, m: { ...this.m }, at: apply(this.m, x, y) }); }
    clearRect(x, y) { this.record('clearRect', x, y); }
    drawImage(image, ...a) {
      const [x, y, w, h] = a.length >= 8 ? a.slice(4) : a;
      this.record('drawImage', x + (w ?? image.width) / 2, y + (h ?? image.height) / 2);
    }
    fillRect(x, y, w, h) { this.record('fillRect', x + w / 2, y + h / 2); }
    strokeRect(x, y, w, h) { this.record('strokeRect', x + w / 2, y + h / 2); }
    fillText(text, x, y) { this.record('fillText', x, y); }
    strokeText(text, x, y) { this.record('strokeText', x, y); }
    measureText(text) { return { width: String(text).length * 6 }; }
    beginPath() {} arc() {} stroke() {} fill() {} moveTo() {} lineTo() {} closePath() {}
  }
  window.CanvasRenderingContext2D = Context;
  const contexts = new Map();
  window.HTMLCanvasElement.prototype.getContext = function getContext() {
    if (!contexts.has(this)) contexts.set(this, new Context(this));
    return contexts.get(this);
  };
  const container = window.document.querySelector('.map-cont');
  container.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800, x: 0, y: 0 });
  window.chrome = { webview: { postMessage: () => {} } };
  window.eval(enhancements);
  const canvas = (selector) => [...window.document.querySelectorAll(selector)].find((c) => c.style.display !== 'none');
  return { dom, window, draws, ctx: (selector) => canvas(selector).getContext('2d'), hidden: window.document.querySelector('canvas.doc-map-canvas').getContext('2d') };
};

// --- Static: heading arrow includes the tilt -----------------------------------
assert.match(constants, /__wtfMapTiltDegrees/, 'heading fallback must add the Terminal tilt to the site rotation');

// --- Terminal -----------------------------------------------------------------
{
  const { window, draws, ctx, hidden } = makeDom('https://tarkov-market.com/maps/terminal');
  near(window.__wtfMapTiltDegrees(), TILT, 'tilt on Terminal');

  // Site view at 270 deg, zoom 0.5: the tilt is added on top about the canvas centre.
  const map = ctx('canvas.doc-map-canvas');
  const site = { a: 0, b: -0.5, c: 0.5, d: 0, e: 100, f: 700 };
  map.setTransform(site.a, site.b, site.c, site.d, site.e, site.f);
  const tilted = map.getTransform();
  near(angleOf(tilted), -90 + TILT, 'map canvas view angle (270 + 14.7)');
  const radians = TILT * Math.PI / 180;
  for (const [x, y] of [[0, 0], [400, 900], [1234, 77]]) {
    const s = apply(site, x, y);
    const expected = { x: 600 + ((s.x - 600) * Math.cos(radians)) - ((s.y - 400) * Math.sin(radians)), y: 400 + ((s.x - 600) * Math.sin(radians)) + ((s.y - 400) * Math.cos(radians)) };
    const got = apply(tilted, x, y);
    near(got.x, expected.x, `map point ${x},${y} x`, 1e-6);
    near(got.y, expected.y, `map point ${x},${y} y`, 1e-6);
  }
  // DOMMatrix-style argument works too.
  map.setTransform({ a: 1, b: 0, c: 0, d: 1, e: 5, f: 6 });
  near(angleOf(map.getTransform()), TILT, 'matrix object argument is tilted');
  // Identity on the map canvas is a full-layer copy/clear: left untilted.
  map.setTransform(1, 0, 0, 1, 0, 0);
  assert.deepEqual(map.getTransform(), { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, 'identity on the map canvas stays identity');
  // Hidden canvases (display: none) are not tilted.
  hidden.setTransform(0.5, 0, 0, 0.5, 0, 0);
  near(angleOf(hidden.getTransform()), 0, 'hidden canvas untouched');

  // Marker canvas draws with identity at device scale 1: that is tilted.
  const markers = ctx('canvas.markers-canvas');
  markers.setTransform(1, 0, 0, 1, 0, 0);
  near(angleOf(markers.getTransform()), TILT, 'identity on the marker canvas is tilted');
  const tiltedIdentity = markers.getTransform();

  // Clear uses the site's own rectangle space (untilted), then the tilt is back.
  draws.length = 0;
  markers.clearRect(0, 0, 1200, 800);
  near(angleOf(draws[0].m), 0, 'clearRect runs untilted');
  near(angleOf(markers.getTransform()), TILT, 'tilt restored after clearRect');

  // Icons: drawn upright, centred where the tilted view puts their anchor.
  draws.length = 0;
  markers.drawImage({ width: 20, height: 20 }, 290, 190, 20, 20);
  const icon = draws[0];
  near(angleOf(icon.m), 0, 'icon drawn upright');
  const iconAnchor = apply(tiltedIdentity, 300, 200);
  near(icon.at.x, iconAnchor.x, 'icon anchor x', 1e-6);
  near(icon.at.y, iconAnchor.y, 'icon anchor y', 1e-6);
  draws.length = 0;
  markers.drawImage({ width: 32, height: 32 }, 0, 0, 32, 32, 284, 184, 32, 32);
  near(draws[0].at.x, iconAnchor.x, '9-argument drawImage anchor x', 1e-6);
  near(angleOf(draws[0].m), 0, '9-argument drawImage upright');

  // Label: translucent box + text turn upright around the box centre, so the text stays inside.
  draws.length = 0;
  markers.fillStyle = 'rgba(0, 0, 0, 0.5)';
  markers.fillRect(400, 300, 60, 16);
  markers.fillStyle = '#fff';
  markers.fillText('Pier', 410, 312);
  const [box, text] = draws;
  near(angleOf(box.m), 0, 'label box upright');
  near(angleOf(text.m), 0, 'label text upright');
  const boxCentre = apply(tiltedIdentity, 430, 308);
  near(box.at.x, boxCentre.x, 'label box centre x', 1e-6);
  near(box.at.y, boxCentre.y, 'label box centre y', 1e-6);
  // Text offset from the box centre is kept unrotated (upright inside the box).
  near(text.at.x - box.at.x, 410 - 430, 'text x offset inside box', 1e-6);
  near(text.at.y - box.at.y, 312 - 308, 'text y offset inside box', 1e-6);
  // Map fills (zones) are not label boxes: they keep the map tilt.
  draws.length = 0;
  markers.fillStyle = 'rgba(255, 0, 0, 0.3)';
  markers.fillRect(0, 0, 50, 50);
  near(angleOf(draws[0].m), TILT, 'zone fills turn with the map');
  // Dashed hover box stays square to the screen; solid strokes turn with the map.
  draws.length = 0;
  markers.setLineDash([4, 2]);
  markers.strokeRect(290, 190, 20, 20);
  markers.setLineDash([]);
  markers.strokeRect(290, 190, 20, 20);
  near(angleOf(draws[0].m), 0, 'dashed hover box upright');
  near(angleOf(draws[1].m), TILT, 'solid rectangles turn with the map');

  // Mouse input on the map: the site receives the point turned back by the tilt.
  const container = window.document.querySelector('.map-cont');
  const target = ctx('canvas.markers-canvas').canvas;
  const seen = [];
  container.addEventListener('mousedown', (event) => seen.push({ x: event.clientX, y: event.clientY, screen: event.__wtfScreenPoint }));
  // jsdom resets isTrusted in dispatchEvent; dispatch the way the browser does for real input.
  const dispatchTrusted = (node, event) => { const impl = implForWrapper(event); impl.isTrusted = true; implForWrapper(node)._dispatch(impl); };
  const screen = { x: apply(tiltedIdentity, 300, 200).x, y: apply(tiltedIdentity, 300, 200).y };
  dispatchTrusted(target, new window.MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: screen.x, clientY: screen.y, button: 0 }));
  assert.equal(seen.length, 1, 'site handler receives exactly one (rewritten) event');
  near(seen[0].x, 300, 'site sees the unrotated x of the icon', 1e-6);
  near(seen[0].y, 200, 'site sees the unrotated y of the icon', 1e-6);
  near(seen[0].screen.clientX, screen.x, 'our handlers keep the screen point', 1e-9);
  // Untrusted (script) events and UI targets pass through unchanged.
  seen.length = 0;
  target.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 20 }));
  assert.deepEqual([seen[0].x, seen[0].y, seen[0].screen], [10, 20, undefined], 'script events are not rewritten');
  seen.length = 0;
  dispatchTrusted(window.document.querySelector('.panel_top button'), new window.MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 20 }));
  assert.deepEqual([seen[0].x, seen[0].y], [10, 20], 'toolbar clicks are not rewritten');
  // Wheel keeps its delta and turns its anchor.
  const wheels = [];
  container.addEventListener('wheel', (event) => wheels.push([event.clientX, event.clientY, event.deltaY]));
  dispatchTrusted(target, new window.WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: screen.x, clientY: screen.y, deltaY: -120 }));
  near(wheels[0][0], 300, 'wheel anchor x', 1e-6);
  near(wheels[0][1], 200, 'wheel anchor y', 1e-6);
  assert.equal(wheels[0][2], -120, 'wheel delta kept');
  window.close();
}

// --- Another map: nothing changes ------------------------------------------------
{
  const { window, draws, ctx } = makeDom('https://tarkov-market.com/maps/customs');
  assert.equal(window.__wtfMapTiltDegrees(), 0, 'no tilt on Customs');
  const map = ctx('canvas.doc-map-canvas');
  map.setTransform(0, -0.5, 0.5, 0, 100, 700);
  assert.deepEqual(map.getTransform(), { a: 0, b: -0.5, c: 0.5, d: 0, e: 100, f: 700 }, 'Customs view matrix untouched');
  const markers = ctx('canvas.markers-canvas');
  markers.setTransform(1, 0, 0, 1, 0, 0);
  draws.length = 0;
  markers.drawImage({ width: 20, height: 20 }, 290, 190, 20, 20);
  assert.deepEqual([draws[0].at.x, draws[0].at.y], [300, 200], 'Customs icons untouched');
  const seen = [];
  const container = window.document.querySelector('.map-cont');
  container.addEventListener('mousedown', (event) => seen.push([event.clientX, event.clientY, event.__wtfScreenPoint]));
  const event = implForWrapper(new window.MouseEvent('mousedown', { bubbles: true, clientX: 300, clientY: 200 }));
  event.isTrusted = true;
  implForWrapper(ctx('canvas.markers-canvas').canvas)._dispatch(event);
  assert.deepEqual(seen, [[300, 200, undefined]], 'Customs input untouched');
  window.close();
}

// --- A map drag released over a site panel still ends on the map -----------------
// The panels stop mouseup; once a drag that began on the map reaches a panel the
// pointer is captured by the map, so the release reaches the site's drag handler.
for (const url of ['https://tarkov-market.com/maps/customs', 'https://tarkov-market.com/maps/terminal']) {
  const { window, ctx } = makeDom(url);
  const container = window.document.querySelector('.map-cont');
  const captured = [];
  container.setPointerCapture = (id) => captured.push(id);
  container.hasPointerCapture = (id) => captured.includes(id);
  const canvas = ctx('canvas.markers-canvas').canvas;
  const panel = window.document.querySelector('.panel_top button');
  const Pointer = window.PointerEvent || window.MouseEvent;
  const fire = (node, type, init) => {
    const event = new Pointer(type, { bubbles: true, cancelable: true, pointerId: 7, ...init });
    if (!('pointerId' in event)) Object.defineProperty(event, 'pointerId', { value: 7 });
    const impl = implForWrapper(event); impl.isTrusted = true; implForWrapper(node)._dispatch(impl);
  };
  const map = url.split('/').pop();
  // Drag on the map only: no capture.
  fire(canvas, 'pointerdown', { button: 0, buttons: 1, clientX: 600, clientY: 400 });
  fire(canvas, 'pointermove', { button: -1, buttons: 1, clientX: 650, clientY: 420 });
  fire(canvas, 'pointerup', { button: 0, buttons: 0, clientX: 650, clientY: 420 });
  assert.deepEqual(captured, [], `${map}: a drag that stays on the map is left alone`);
  // Hovering a panel with no button down after a click: no capture.
  fire(canvas, 'pointerdown', { button: 0, buttons: 1, clientX: 600, clientY: 400 });
  fire(canvas, 'pointerup', { button: 0, buttons: 0, clientX: 600, clientY: 400 });
  fire(panel, 'pointermove', { button: -1, buttons: 0, clientX: 20, clientY: 10 });
  assert.deepEqual(captured, [], `${map}: hovering a panel after a click is left alone`);
  // A press that starts on a panel: no capture.
  fire(panel, 'pointerdown', { button: 0, buttons: 1, clientX: 20, clientY: 10 });
  fire(panel, 'pointermove', { button: -1, buttons: 1, clientX: 25, clientY: 12 });
  fire(panel, 'pointerup', { button: 0, buttons: 0, clientX: 25, clientY: 12 });
  assert.deepEqual(captured, [], `${map}: panel clicks are left alone`);
  // Middle-button press (route node) dragged over a panel: no capture.
  fire(canvas, 'pointerdown', { button: 1, buttons: 4, clientX: 600, clientY: 400 });
  fire(panel, 'pointermove', { button: -1, buttons: 4, clientX: 20, clientY: 10 });
  fire(panel, 'pointerup', { button: 1, buttons: 0, clientX: 20, clientY: 10 });
  assert.deepEqual(captured, [], `${map}: middle-button presses are left alone`);
  // A map drag that reaches a panel: the map captures the pointer once.
  fire(canvas, 'pointerdown', { button: 0, buttons: 1, clientX: 600, clientY: 400 });
  fire(canvas, 'pointermove', { button: -1, buttons: 1, clientX: 300, clientY: 200 });
  assert.deepEqual(captured, [], `${map}: no capture while the drag is still over the map`);
  fire(panel, 'pointermove', { button: -1, buttons: 1, clientX: 20, clientY: 10 });
  fire(panel, 'pointermove', { button: -1, buttons: 1, clientX: 22, clientY: 11 });
  assert.deepEqual(captured, [7], `${map}: a map drag that reaches a panel is held on the map`);
  window.close();
}

console.log('PASS: Terminal adds 14.7 deg about the view centre (map, markers, player), icons/labels upright at their anchors, clears untilted, map input turned back (click, wheel), UI and script events untouched, heading adds the tilt; Customs unchanged; a map drag released over a panel still ends on the map.');
