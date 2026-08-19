const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const models = read('eft-where-am-i', 'Classes', 'SquadModels.cs');
const settings = read('eft-where-am-i', 'Classes', 'SettingsHandler.cs');
const host = read('eft-where-am-i', 'UserControls', 'WhereAmI.cs');
const overlay = read('eft-where-am-i', 'html', 'enhancements.js');

assert.match(models, /sealed class MapRouteNode/, 'route node model is missing');
assert.match(settings, /List<MapRouteNode>\s+map_route_nodes/, 'route nodes must persist in settings');
assert.match(settings, /route_visible_per_map/, 'route visibility must persist per map');
assert.match(host, /currentRouteNodeCount\s*>=\s*10/, 'host must enforce the ten-node limit');
assert.match(host, /case\s+"map-route-node-delete"/, 'route node deletion is missing');
assert.match(overlay, /event\.button\s*!==\s*1/, 'placement must use the wheel button');
assert.match(overlay, /nearestOverlayMarker\('\.wtf-route-node'/, 'repeating a wheel click near a node must delete it');
assert.match(overlay, /stroke-dasharray:\s*4 5/, 'route connections must be dashed');
assert.match(overlay, /stroke:\s*rgba\([^)]*,\s*\.48\)/, 'route connections must be translucent');
assert.match(overlay, /\.wtf-ping-marker, \.wtf-route-node/, 'route nodes must use the shared transformed map coordinates');
assert.doesNotMatch(overlay, /setTimeout\([^)]*route/i, 'route nodes must not expire on a timer');

const readPixels = (selector, property) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = overlay.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(block, `missing ${selector} style`);
  const value = block[1].match(new RegExp(`${property}:\\s*([0-9.]+)px`));
  assert.ok(value, `missing ${property} in ${selector}`);
  return Number(value[1]);
};

assert.ok(
  readPixels('.wtf-route-node', 'width') < readPixels('.wtf-ping-marker', 'width'),
  'route nodes must be smaller than ping markers'
);
assert.match(overlay, /slice\(0,\s*10\)/, 'renderer must cap untrusted snapshots at ten nodes');
assert.match(overlay, /contextmenu[\s\S]*map-route-node-delete/, 'right-click deletion must suppress the browser menu');
assert.match(overlay, /nearestOverlayMarker\s*=\s*\([^)]*radius\s*=\s*24/, 'nearby deletion must use a forgiving screen-space radius');

console.log('Persistent route node validation passed.');
