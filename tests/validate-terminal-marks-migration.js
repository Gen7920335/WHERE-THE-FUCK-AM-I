// Terminal used to be our own map page (v1.1.18 and earlier), so its saved pings
// and route nodes are in that page's space. The first run after the update drops
// them once, keeps every other map's marks, and records that it was done so
// marks placed on the new Terminal map are never dropped.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const settings = fs.readFileSync(path.join(root, 'eft-where-am-i', 'Classes', 'SettingsHandler.cs'), 'utf8');

const flag = 'terminal_marks_tarkov_market_space';
assert.match(settings, new RegExp(`public bool ${flag} \\{ get; set; \\} = false;`),
  'settings saved by older versions have no flag, so it must default to false');

const load = settings.slice(settings.indexOf('private void Load()'), settings.indexOf('public void Save()'));
assert.match(load, /DeserializeObject<AppSettings>\(json\)[\s\S]*if \(RemovePreTarkovMarketTerminalMarks\(_settings\)\)\s*\{\s*Save\(\);/,
  'loading saved settings must drop old Terminal marks and save the result');
assert.match(load, new RegExp(`new AppSettings \\{ ${flag} = true \\}`),
  'a fresh install has no old marks: start with the flag set');

const body = settings.slice(settings.indexOf('public static bool RemovePreTarkovMarketTerminalMarks'));
const method = body.slice(0, body.indexOf('public void Save()'));
assert.match(method, new RegExp(`if \\(settings == null \\|\\| settings\\.${flag}\\)\\s*\\{\\s*return false;`),
  'once done, the cleanup must never run again (new Terminal marks stay)');
assert.match(method, /map_pings\?\.RemoveAll\(ping => ping != null && IsTerminal\(ping\.map\)\)/, 'old Terminal pings are dropped');
assert.match(method, /map_route_nodes\?\.RemoveAll\(node => node != null && IsTerminal\(node\.map\)\)/, 'old Terminal route nodes are dropped');
assert.match(method, /string\.Equals\(map, "terminal", StringComparison\.OrdinalIgnoreCase\)/, 'only Terminal marks are dropped');
assert.match(method, new RegExp(`settings\\.${flag} = true;\\s*return true;`), 'the cleanup records that it ran');

console.log('PASS: old Terminal pings/route nodes dropped once on the first run after the update; other maps and later Terminal marks kept.');
