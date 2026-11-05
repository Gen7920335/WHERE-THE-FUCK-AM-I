const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('../.tools/jsdom-test/node_modules/jsdom');

// Runtime check: wheel-clicking on map icons (Tarkov-Market canvas icons or our
// quest pins) must drop a route node exactly on the clicked icon, for all 40
// nodes, even when icons are packed close together. The 41st node is refused.

const root = path.resolve(__dirname, '..');
const overlay = fs.readFileSync(path.join(root, 'eft-where-am-i', 'html', 'enhancements.js'), 'utf8');

const MAX_NODES = 40;
const NODE_SIZE = 7;
// Tarkov-Market draws loot icons about 12-25 screen px wide; packed clusters
// put neighbouring icon centres about 12 px apart.
const ICON_SPACING = 12;

const dom = new JSDOM(
  `<body>
    <div class="panel_top"><button>Native</button></div>
    <div class="panel_left"></div>
    <div class="panel_right"></div>
    <div class="map-cont">
      <canvas class="markers-canvas"></canvas>
      <div class="map-wrap" style="width:4800px;height:4800px;transform:matrix(1.73,0,0,1.73,318,-144);transform-origin:0 0">
        <div class="map-scene" style="width:4800px;height:4800px;transform:matrix(0,1,-1,0,4800,0);transform-origin:0 0"></div>
      </div>
    </div>
  </body>`,
  { runScripts: 'dangerously', url: 'https://tarkov-market.com/maps/customs', pretendToBeVisual: true }
);
const { window } = dom;
window.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
window.CanvasRenderingContext2D.prototype = { drawImage() {}, fillText() {}, strokeText() {} };
window.ResizeObserver = class ResizeObserver { observe() {} disconnect() {} };

// jsdom has no layout: give route nodes a real 7px box at their rendered position.
const realRect = window.HTMLElement.prototype.getBoundingClientRect;
window.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  if (this.classList?.contains('wtf-route-node')) {
    const x = Number.parseFloat(this.style.left) || 0;
    const y = Number.parseFloat(this.style.top) || 0;
    return { left: x - NODE_SIZE / 2, top: y - NODE_SIZE / 2, right: x + NODE_SIZE / 2, bottom: y + NODE_SIZE / 2,
      width: NODE_SIZE, height: NODE_SIZE, x: x - NODE_SIZE / 2, y: y - NODE_SIZE / 2 };
  }
  return realRect.call(this);
};

const posted = [];
window.chrome = { webview: { postMessage: message => posted.push(JSON.parse(message)) } };
const alerts = [];
window.alert = message => alerts.push(String(message));
window.eval(overlay);

const nodes = [];
const configure = () => window.__wtfRouteOverlay.configure({
  map: 'customs', visible: true, maxNodes: MAX_NODES, localNodeCount: nodes.length, nodes: nodes.slice()
});
configure();

const frame = () => new Promise(resolve => window.requestAnimationFrame(() => setTimeout(resolve, 0)));
const wheelClick = (target, x, y) => target.dispatchEvent(new window.MouseEvent('pointerdown', {
  bubbles: true, cancelable: true, button: 1, clientX: x, clientY: y
}));

// 41 icon centres in a dense 7-wide grid on the canvas.
const icons = Array.from({ length: MAX_NODES + 1 }, (_, index) => ({
  x: 600 + (index % 7) * ICON_SPACING,
  y: 400 + Math.floor(index / 7) * ICON_SPACING
}));

(async () => {
  await frame();
  const canvas = window.document.querySelector('.markers-canvas');
  let worst = 0;
  for (let index = 0; index < MAX_NODES; index += 1) {
    const icon = icons[index];
    const before = posted.length;
    wheelClick(canvas, icon.x, icon.y);
    const message = posted.slice(before).find(entry => entry.action === 'map-route-node-add');
    const other = posted.slice(before).find(entry => entry.action === 'map-route-node-delete');
    assert.ok(!other, `icon ${index + 1}: wheel click on an icon ${ICON_SPACING}px from the previous node deleted it instead of placing a node`);
    assert.ok(message, `icon ${index + 1}: wheel click on an icon did not place a route node`);
    nodes.push({ id: `n${index}`, left: message.left, top: message.top, floor: message.floor ?? null,
      createdAt: index + 1, participantSlot: 1 });
    configure();
    await frame();
    const marker = window.document.querySelector(`.wtf-route-node[data-id="n${index}"]`);
    assert.ok(marker, `icon ${index + 1}: node did not render`);
    const dx = Number.parseFloat(marker.style.left) - icon.x;
    const dy = Number.parseFloat(marker.style.top) - icon.y;
    worst = Math.max(worst, Math.hypot(dx, dy));
    assert.ok(Math.hypot(dx, dy) < 0.5, `icon ${index + 1}: node rendered ${Math.hypot(dx, dy).toFixed(2)}px away from the icon centre`);
  }
  assert.equal(window.document.querySelectorAll('.wtf-route-node').length, MAX_NODES, 'all forty nodes must stay rendered');

  // The 41st node is refused with the forty-node message.
  const before = posted.length;
  wheelClick(canvas, icons[MAX_NODES].x, icons[MAX_NODES].y);
  assert.ok(!posted.slice(before).some(entry => entry.action === 'map-route-node-add'), 'a 41st node must be refused');
  assert.ok(alerts.some(text => /40/.test(text)), 'the limit message must say 40');

  // Wheel-clicking directly on an existing node still deletes that node.
  const target = icons[10];
  const beforeDelete = posted.length;
  wheelClick(canvas, target.x + 1, target.y - 1);
  const deletion = posted.slice(beforeDelete).find(entry => entry.action === 'map-route-node-delete');
  assert.ok(deletion && deletion.id === 'n10', 'wheel click on a node must delete that node');

  // Squad routes: five participants x forty nodes must all render.
  for (let slot = 2; slot <= 5; slot += 1) {
    for (let index = 0; index < MAX_NODES; index += 1) {
      nodes.push({ id: `p${slot}-${index}`, creatorId: `peer-${slot}`, left: 10 + index, top: 10 + slot,
        createdAt: 1000 + slot * 100 + index, participantSlot: slot });
    }
  }
  configure();
  await frame();
  assert.equal(window.document.querySelectorAll('.wtf-route-node').length, MAX_NODES * 5,
    'five participants with forty nodes each must all render');

  // Nodes are drawn above the Tarkov-Market marker canvas and our quest pins.
  const zIndex = selector => Number(overlay.match(new RegExp(`${selector.replace('#', '#')}\\s*\\{[^}]*?z-index:\\s*(\\d+)`))?.[1]);
  assert.ok(zIndex('#wtf-route-layer') > zIndex('#wtf-quest-layer'), 'route nodes must draw above quest pins');
  assert.ok(zIndex('#wtf-route-layer') > 5, 'route nodes must draw above the Tarkov-Market marker canvas (z-index 5)');

  console.log(`PASS: ${MAX_NODES} nodes placed on icons ${ICON_SPACING}px apart (worst offset ${worst.toFixed(3)}px), 41st refused, on-node delete kept, 5x${MAX_NODES} squad nodes rendered.`);
  dom.window.close();
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
  dom.window.close();
});
