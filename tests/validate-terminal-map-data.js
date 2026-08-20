const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const htmlRoot = path.join(root, 'eft-where-am-i', 'html');
const source = fs.readFileSync(path.join(htmlRoot, 'terminal-map-data.js'), 'utf8');
const pageHtml = fs.readFileSync(path.join(htmlRoot, 'terminal-map.html'), 'utf8');
const pageCss = fs.readFileSync(path.join(htmlRoot, 'terminal-map.css'), 'utf8');
const pageScript = fs.readFileSync(path.join(htmlRoot, 'terminal-map.js'), 'utf8');
const projectionSource = fs.readFileSync(path.join(root, 'eft-where-am-i', 'Classes', 'TarkovMarketMapProjection.cs'), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, { filename: 'terminal-map-data.js' });
const data = sandbox.window.__wtfTerminalData;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(data && Array.isArray(data.filters) && Array.isArray(data.markers), 'Terminal data was not exported.');
assert(pageHtml.includes('id="terminalMapStage"'), 'Terminal map clipping stage is missing.');
assert(!pageHtml.includes('terminalMapBackdrop'), 'Artificial rectangular Terminal map backdrop must remain removed.');
assert(!pageCss.includes('.terminal-map-backdrop'), 'Artificial Terminal backdrop styles must remain removed.');
for (const tile of ['main', 'quay']) {
  assert(pageHtml.includes(`terminal-sea-tile-${tile}`), `Stepped Terminal sea tile is missing: ${tile}.`);
}
assert(pageScript.includes('#Ocean { display: none !important; }'), 'The source-wide Ocean polygon must be replaced by stepped sea tiles.');
assert(pageScript.includes('const SEA_PADDING_X = 80;'), 'Terminal sea footprint needs horizontal land clearance.');
assert(pageScript.includes('const SEA_PADDING_Y = 55;'), 'Terminal sea footprint needs vertical land clearance.');
assert(!pageHtml.includes('terminal-sea-tile-south'), 'The marked-up two-rectangle sea footprint must not retain the old south tile.');
assert(!pageHtml.includes('terminal-sea-tile-pier'), 'The marked-up two-rectangle sea footprint must not retain the old pier tile.');
assert(
  pageCss.includes('clip-path: polygon(14% 0, 100% 0, 100% 100%, 14% 100%);'),
  'The western approach road and sea must share one vertical crop edge.'
);
assert(pageHtml.includes('class="panel_left scroll terminal-side-panel"'), 'Market-style left panel is missing.');
assert(pageHtml.includes('class="panel_right terminal-right-panel"'), 'Market-style right panel is missing.');
assert(
  pageHtml.indexOf('data-terminal-accordion="quests"') < pageHtml.indexOf('data-terminal-accordion="squad"'),
  'Upstream quest panel must remain ahead of WTFMI-only right-panel additions.'
);
assert(pageCss.includes('font-family: "Bender"'), 'Market-style Bender font declaration is missing.');
assert(pageCss.includes('background-size: 250px 250px, 250px 250px, 50px 50px, 50px 50px'), 'Market grid hierarchy is missing.');
assert(
  pageCss.includes('.terminal-filter-row.selected { color: var(--market-text); font-weight: 400; }'),
  'Active filter text must retain the upstream brown text color and regular weight.'
);
assert(
  pageCss.includes('.terminal-filter-row.selected .terminal-filter-icon { color: var(--market-green); }'),
  'Only the active filter icon should use the upstream green accent.'
);

const expectedPanelSections = ['extractions', 'bosses', 'quests', 'keys', 'map', 'loot'];
assert(
  data.sections.map((section) => section.id).join(',') === expectedPanelSections.join(','),
  'Terminal left-panel sections do not match the upstream Where Am I ordering.'
);
const questFilter = data.filters.find((filter) => filter.id === 'quest-ticket');
assert(questFilter?.title === 'Quest', 'Left-panel quest filter must use the generic upstream label.');
assert(questFilter?.detailTitle === 'The Ticket', 'Right-panel quest list must use the quest name.');
assert(pageScript.includes('const setQuestSelected ='), 'Quest selection must be independent from left-panel visibility.');
const enhancementScript = fs.readFileSync(path.join(htmlRoot, 'enhancements.js'), 'utf8');
assert(!/wtf-battle-pass|__wtfBattlePassOverlay|native-battle-pass-hidden/i.test(enhancementScript),
  'Terminal must not restore the removed custom Battle Pass overlay.');
assert(
  pageScript.includes(".terminal-side-panel, .terminal-right-panel, .panel_top"),
  'Panel interactions must not bubble into the map-background popup closer.'
);
assert(
  data.filters.filter((filter) => filter.defaultVisible !== false).map((filter) => filter.id).join(',') === 'extract-zubr,quest-ticket',
  'Only the upstream-style extraction and quest rows should be active by default.'
);

const scriptRotation = Number(pageScript.match(/MAP_ROTATION_DEGREES\s*=\s*(-?[\d.]+)/)?.[1]);
const projectionRotation = Number(projectionSource.match(/TerminalMapRotationDegrees\s*=\s*(-?[\d.]+)/)?.[1]);
assert(Number.isFinite(scriptRotation), 'Terminal JavaScript rotation constant is missing.');
assert(scriptRotation === -75.3, `Unexpected Terminal display rotation: ${scriptRotation}.`);
assert(scriptRotation === projectionRotation, 'Terminal map and squad direction rotations are out of sync.');
const filterIds = new Set(data.filters.map((filter) => filter.id));
assert(filterIds.size === data.filters.length, 'Duplicate Terminal filter id.');

const markerIds = new Set();
for (const marker of data.markers) {
  assert(!markerIds.has(marker.id), `Duplicate marker id: ${marker.id}`);
  markerIds.add(marker.id);
  assert(filterIds.has(marker.filter), `Unknown filter ${marker.filter} on ${marker.id}`);
  assert(Number.isFinite(marker.left) && marker.left >= 0 && marker.left <= 100, `Invalid left coordinate on ${marker.id}`);
  assert(Number.isFinite(marker.top) && marker.top >= 0 && marker.top <= 100, `Invalid top coordinate on ${marker.id}`);
  if (marker.image) {
    const imagePath = path.join(htmlRoot, marker.image);
    assert(fs.existsSync(imagePath), `Missing popup image for ${marker.id}: ${marker.image}`);
    const imageBytes = fs.readFileSync(imagePath);
    if (marker.image.toLowerCase().endsWith('.png')) {
      assert(imageBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `PNG guide has the wrong binary format: ${marker.image}`);
    }
    if (/\.jpe?g$/i.test(marker.image)) {
      assert(imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff, `JPEG guide has the wrong binary format: ${marker.image}`);
    }
  }
}

const questMarkers = data.markers.filter((marker) => marker.filter === 'quest-ticket');
assert(questMarkers.length === 11, `Expected 11 Terminal objectives, found ${questMarkers.length}.`);
assert(questMarkers.map((marker) => marker.order).join(',') === '1,2,3,4,5,6,7,8,9,10,11', 'Terminal objective order is incomplete.');

const boss = data.markers.find((marker) => marker.id === 'terminal-boss-area');
for (const name of ['Glukhar', 'Killa', 'Reshala', 'Sanitar', 'Tagilla']) {
  assert(boss?.details.includes(name), `Boss entry is missing ${name}.`);
}
assert(data.markers.some((marker) => marker.id === 'zubr-extract'), 'Zubr Boat extraction is missing.');
assert(data.markers.filter((marker) => marker.filter === 'loot-sz1').length === 7, 'Expected all 7 SZ-1 explosive spawns.');
assert(data.markers.filter((marker) => marker.filter === 'map-panels').length === 10, 'Expected all 10 electrical panel locations.');

console.log(JSON.stringify({ filters: data.filters.length, markers: data.markers.length, quests: questMarkers.length }, null, 2));
