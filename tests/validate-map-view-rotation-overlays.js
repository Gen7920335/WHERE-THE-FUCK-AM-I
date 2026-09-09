const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('../.tools/jsdom-test/node_modules/jsdom');

const root = path.resolve(__dirname, '..');
const overlay = fs.readFileSync(
  path.join(root, 'eft-where-am-i', 'html', 'enhancements.js'),
  'utf8'
);

assert.match(
  overlay,
  /const mapSceneTransformInfo = \(mapWrap\) =>[\s\S]*querySelector\('\.map-scene'\)/,
  'custom overlays must inspect Tarkov Market\'s rotated map scene'
);
assert.match(
  overlay,
  /if \(sceneTransform\) point = transformPoint\(point\.x, point\.y, sceneTransform\)/,
  'quest, ping, route, and squad positions must include the scene rotation'
);
assert.match(
  overlay,
  /if \(sceneTransform\) point = inverseTransformPoint\(point\.x, point\.y, sceneTransform\)/,
  'map clicks must invert the scene rotation before storing coordinates'
);
assert.match(
  overlay,
  /wtfOverlayState\.mapObserver\.observe\(mapScene,[\s\S]*attributeFilter: \['style', 'class'\]/,
  'the overlay updater must react when the Rotate map button changes the scene transform'
);

const transformPoint = (point, transform) => {
  const relativeX = point.x - transform.originX;
  const relativeY = point.y - transform.originY;
  return {
    x: transform.layoutX + transform.originX
      + transform.matrix.a * relativeX + transform.matrix.c * relativeY + transform.matrix.e,
    y: transform.layoutY + transform.originY
      + transform.matrix.b * relativeX + transform.matrix.d * relativeY + transform.matrix.f
  };
};

const inverseTransformPoint = (point, transform) => {
  const { a, b, c, d, e, f } = transform.matrix;
  const determinant = a * d - b * c;
  const mappedX = point.x - transform.layoutX - transform.originX - e;
  const mappedY = point.y - transform.layoutY - transform.originY - f;
  return {
    x: (d * mappedX - c * mappedY) / determinant + transform.originX,
    y: (-b * mappedX + a * mappedY) / determinant + transform.originY
  };
};

const sceneMatrices = {
  0: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  90: { a: 0, b: 1, c: -1, d: 0, e: 2142, f: 0 },
  180: { a: -1, b: 0, c: 0, d: -1, e: 4097, f: 2142 },
  270: { a: 0, b: -1, c: 1, d: 0, e: 0, f: 4097 }
};

const sourceSize = { width: 4097, height: 2142 };
const sourcePercent = { left: 73.125, top: 26.875 };
const sourcePoint = {
  x: sourceSize.width * sourcePercent.left / 100,
  y: sourceSize.height * sourcePercent.top / 100
};
const panZoom = {
  matrix: { a: 1.73, b: 0, c: 0, d: 1.73, e: 318, f: -144 },
  originX: 0,
  originY: 0,
  layoutX: 19,
  layoutY: 31
};

for (const [degrees, matrix] of Object.entries(sceneMatrices)) {
  const scene = {
    matrix,
    originX: 0,
    originY: 0,
    layoutX: 0,
    layoutY: 0
  };
  const rotated = transformPoint(sourcePoint, scene);
  const screen = transformPoint(rotated, panZoom);
  const recoveredRotated = inverseTransformPoint(screen, panZoom);
  const recovered = inverseTransformPoint(recoveredRotated, scene);
  const left = recovered.x / sourceSize.width * 100;
  const top = recovered.y / sourceSize.height * 100;
  assert.ok(Math.abs(left - sourcePercent.left) < 1e-9, `${degrees}° X coordinate drifted`);
  assert.ok(Math.abs(top - sourcePercent.top) < 1e-9, `${degrees}° Y coordinate drifted`);
}

const atZero = transformPoint(sourcePoint, {
  matrix: sceneMatrices[0], originX: 0, originY: 0, layoutX: 0, layoutY: 0
});
const atNinety = transformPoint(sourcePoint, {
  matrix: sceneMatrices[90], originX: 0, originY: 0, layoutX: 0, layoutY: 0
});
assert.notDeepEqual(atNinety, atZero, 'a rotated quest marker must move with the map');
assert.equal(atNinety.x, sourceSize.height - sourcePoint.y, '90° marker X is incorrect');
assert.equal(atNinety.y, sourcePoint.x, '90° marker Y is incorrect');

console.log('Map view rotation overlay validation passed.');

const dom = new JSDOM(
  `<body>
    <div class="panel_top"><button>Native</button></div>
    <div class="panel_left"></div>
    <div class="panel_right"></div>
    <div class="map-cont">
      <div class="map-wrap" style="width:4800px;height:4800px;transform:matrix(1.73,0,0,1.73,318,-144);transform-origin:0 0">
        <div class="map-scene" style="width:4800px;height:4800px;transform:matrix(0,1,-1,0,4800,0);transform-origin:0 0"></div>
      </div>
    </div>
  </body>`,
  {
    runScripts: 'dangerously',
    url: 'https://tarkov-market.com/maps/woods',
    pretendToBeVisual: true
  }
);

const { window } = dom;
window.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
window.CanvasRenderingContext2D.prototype = { drawImage() {}, fillText() {}, strokeText() {} };
window.ResizeObserver = class ResizeObserver { observe() {} disconnect() {} };
const postedMessages = [];
window.chrome = { webview: { postMessage: message => postedMessages.push(JSON.parse(message)) } };
window.eval(overlay);
window.__wtfQuestLiveSource = async () => ({
  allMarkers: [{
    uid: 'rotate-marker',
    map: 'woods',
    category: 'Quests',
    subCategory: 'Quest',
    questUid: 'rotate-quest',
    name: 'Rotating quest objective',
    geometry: { x: -508.6796, y: 297.4152 },
    level: 1
  }],
  quests: [{ uid: 'rotate-quest', name: 'Rotation Test', type: 'Exploration' }]
});
window.__wtfQuestOverlay.configure({ map: 'woods' });
window.__wtfQuestOverlay.setPinnedQuests(['Rotation Test']);

setTimeout(() => {
  const marker = window.document.querySelector('.wtf-quest-marker');
  assert.ok(marker, 'quest marker did not render in the runtime rotation fixture');
  const leftPercent = Number(marker.dataset.left);
  const topPercent = Number(marker.dataset.top);
  const source = { x: leftPercent * 48, y: topPercent * 48 };
  const expectedAtNinety = {
    left: (318 + 1.73 * (4800 - source.y)),
    top: (-144 + 1.73 * source.x)
  };
  assert.ok(Math.abs(Number.parseFloat(marker.style.left) - expectedAtNinety.left) < 0.001,
    'quest marker X did not follow the live 90° map-scene transform');
  assert.ok(Math.abs(Number.parseFloat(marker.style.top) - expectedAtNinety.top) < 0.001,
    'quest marker Y did not follow the live 90° map-scene transform');

  const scene = window.document.querySelector('.map-scene');
  scene.style.transform = 'matrix(-1,0,0,-1,4800,4800)';
  setTimeout(() => {
    const expectedAtOneEighty = {
      left: 318 + 1.73 * (4800 - source.x),
      top: -144 + 1.73 * (4800 - source.y)
    };
    assert.ok(Math.abs(Number.parseFloat(marker.style.left) - expectedAtOneEighty.left) < 0.001,
      'quest marker X did not refresh after the Rotate map mutation');
    assert.ok(Math.abs(Number.parseFloat(marker.style.top) - expectedAtOneEighty.top) < 0.001,
      'quest marker Y did not refresh after the Rotate map mutation');

    const clickSource = { left: 30, top: 40 };
    const clickX = 318 + 1.73 * (4800 - clickSource.left * 48);
    const clickY = -144 + 1.73 * (4800 - clickSource.top * 48);
    window.document.querySelector('.map-cont').dispatchEvent(new window.MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      altKey: true,
      button: 0,
      clientX: clickX,
      clientY: clickY
    }));
    const ping = postedMessages.find(message => message.action === 'map-ping-add');
    assert.ok(ping, 'rotated map click did not create a ping');
    assert.ok(Math.abs(ping.left - clickSource.left) < 1e-9, 'rotated click X inversion drifted');
    assert.ok(Math.abs(ping.top - clickSource.top) < 1e-9, 'rotated click Y inversion drifted');

    console.log('PASS: live map-scene rotation moves quest markers and preserves click coordinates.');
    dom.window.close();
  }, 50);
}, 100);
