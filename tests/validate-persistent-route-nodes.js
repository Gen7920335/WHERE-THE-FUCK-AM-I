const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const models = read('eft-where-am-i', 'Classes', 'SquadModels.cs');
const settings = read('eft-where-am-i', 'Classes', 'SettingsHandler.cs');
const network = read('eft-where-am-i', 'Classes', 'SquadNetworkService.cs');
const host = read('eft-where-am-i', 'UserControls', 'WhereAmI.cs');
const overlay = read('eft-where-am-i', 'html', 'enhancements.js');

assert.match(models, /sealed class MapRouteNode/, 'route node model is missing');
assert.match(settings, /List<MapRouteNode>\s+map_route_nodes/, 'route nodes must persist in settings');
assert.match(settings, /route_visible_per_map/, 'route visibility must persist per map');
assert.match(host, /currentRouteNodeCount\s*>=\s*20/, 'host must enforce the twenty-node limit');
assert.match(host, /case\s+"map-route-node-delete"/, 'route node deletion is missing');
assert.match(host, /case\s+"map-route-nodes-clear"/, 'current-map route clear-all is missing');
assert.match(host, /RemoveSavedRouteNodes\(appSettings\.latest_map\)/, 'route clear-all must target only the active map');
assert.match(host, /\.Where\(node\s*=>\s*string\.Equals\([\s\S]*?node\.map,[\s\S]*?appSettings\.latest_map/, 'route snapshots must be filtered to the active map');
assert.match(network, /type\s*=\s*"route-node-upsert"/, 'route nodes must synchronize with the squad');
assert.match(network, /node\.participantSlot\s*=\s*peer\.ParticipantSlot/, 'host must authenticate route ownership and color');
assert.match(overlay, /event\.button\s*!==\s*1/, 'placement must use the wheel button');
assert.match(overlay, /nearestOverlayMarker\('\.wtf-route-node\[data-owned="true"\]'/, 'repeating a wheel click near an owned node must delete it');
assert.match(overlay, /stroke-dasharray:\s*4 5/, 'route connections must be dashed');
assert.match(overlay, /\.wtf-route-line\s*\{[\s\S]*?opacity:\s*\.48/, 'route connections must be translucent');
assert.match(overlay, /nodesByParticipant/, 'route lines must only join nodes belonging to the same participant');
assert.match(overlay, /participantNodes\[index\s*-\s*1\][\s\S]*participantNodes\[index\]/, 'deleting a middle node must reconnect the adjacent remaining nodes');
assert.match(overlay, /applyParticipantColor\(line, participantNodes\[index\]\)/, 'route lines must use their participant color');
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
assert.match(overlay, /slice\(0,\s*100\)/, 'renderer must cap the five twenty-node participant routes');
assert.match(overlay, /route\.localNodeCount/, 'the twenty-node limit must be per local participant');
assert.match(overlay, /contextmenu[\s\S]*map-route-node-delete/, 'right-click deletion must suppress the browser menu');
assert.match(overlay, /wtf-clear-route-button[\s\S]*map-route-nodes-clear/, 'the top panel must expose route clear-all');
assert.match(overlay, /searchParams\.delete\('view'\)[\s\S]*searchParams\.set\('obj'/, 'native quest marker details must not activate the all-markers view bypass');
assert.match(overlay, /nearestOverlayMarker\s*=\s*\([^)]*radius\s*=\s*24/, 'nearby deletion must use a forgiving screen-space radius');

console.log('Persistent route node validation passed.');
