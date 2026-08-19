const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const settings = read('eft-where-am-i', 'Classes', 'SettingsHandler.cs');
const models = read('eft-where-am-i', 'Classes', 'SquadModels.cs');
const network = read('eft-where-am-i', 'Classes', 'SquadNetworkService.cs');
const host = read('eft-where-am-i', 'UserControls', 'WhereAmI.cs');
const overlay = read('eft-where-am-i', 'html', 'enhancements.js');

assert.match(models, /sealed class MapPing/, 'persistent ping model is missing');
assert.match(settings, /List<MapPing>\s+map_pings/, 'pings must be serialized with application settings');
assert.match(settings, /Dictionary<string, bool>\s+ping_visible_per_map/, 'per-map visibility must be serialized');
assert.match(network, /type\s*=\s*"ping-upsert"/, 'squad ping upsert message is missing');
assert.match(network, /type\s*=\s*"ping-clear"/, 'squad ping clear message is missing');
assert.match(network, /type\s*=\s*"ping-delete"/, 'individual squad ping deletion is missing');
assert.match(network, /ping\.creatorId\s*=\s*peer\.PlayerId/, 'host must authenticate the ping creator');
assert.match(host, /case\s+"map-ping-add"/, 'map-to-host ping creation is missing');
assert.match(host, /case\s+"map-pings-toggle"/, 'visibility persistence is missing');
assert.match(host, /case\s+"map-pings-clear"/, 'delete-all persistence is missing');
assert.match(overlay, /id\s*=\s*'wtf-ping-control'/, 'left visibility control is missing');
assert.match(overlay, /id\s*=\s*'wtf-clear-pings-button'/, 'top delete-all control is missing');
assert.match(overlay, /event\.altKey/, 'ping placement must not steal ordinary map clicks');
assert.match(overlay, /nearestOverlayMarker\('\.wtf-ping-marker'/, 'repeating Alt-click near a ping must delete it');
assert.match(overlay, /action:\s*'map-ping-delete'/, 'nearby ping deletion must reach the host');
assert.doesNotMatch(overlay, /setTimeout\([^)]*ping/i, 'pings must not expire on a timer');

const roundTrip = ({ width, height, originX, originY, layoutX, layoutY, matrix, left, top }) => {
  const localX = left * width / 100;
  const localY = top * height / 100;
  const relativeX = localX - originX;
  const relativeY = localY - originY;
  const screenX = layoutX + originX + matrix.a * relativeX + matrix.c * relativeY + matrix.e;
  const screenY = layoutY + originY + matrix.b * relativeX + matrix.d * relativeY + matrix.f;
  const mappedX = screenX - layoutX - originX - matrix.e;
  const mappedY = screenY - layoutY - originY - matrix.f;
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  const recoveredX = (matrix.d * mappedX - matrix.c * mappedY) / determinant + originX;
  const recoveredY = (-matrix.b * mappedX + matrix.a * mappedY) / determinant + originY;
  return { left: recoveredX / width * 100, top: recoveredY / height * 100 };
};

for (const degrees of [0, -75.3, 17.25, 90]) {
  const radians = degrees * Math.PI / 180;
  const scale = 2.37;
  const result = roundTrip({
    width: 4097,
    height: 2142,
    originX: 2048.5,
    originY: 1071,
    layoutX: 137,
    layoutY: 83,
    matrix: {
      a: Math.cos(radians) * scale,
      b: Math.sin(radians) * scale,
      c: -Math.sin(radians) * scale,
      d: Math.cos(radians) * scale,
      e: 318,
      f: -144
    },
    left: 73.125,
    top: 26.875
  });
  assert.ok(Math.abs(result.left - 73.125) < 1e-9, `${degrees} degree X inversion drifted`);
  assert.ok(Math.abs(result.top - 26.875) < 1e-9, `${degrees} degree Y inversion drifted`);
}

console.log('Persistent map ping validation passed.');
