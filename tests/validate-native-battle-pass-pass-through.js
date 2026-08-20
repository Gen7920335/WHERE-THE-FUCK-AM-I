const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const project = path.join(root, 'eft-where-am-i');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

for (const relative of [
  'eft-where-am-i/Classes/BattlePassOverlayDataService.cs',
  'eft-where-am-i/Classes/BattlePassPhotoCatalog.cs',
  'eft-where-am-i/html/battle-pass-locations.json',
  'tools/import-perofunyang-battle-pass.js'
]) {
  assert(!fs.existsSync(path.join(root, relative)), `Removed custom Battle Pass file still exists: ${relative}`);
}

const projectFile = read('eft-where-am-i/eft-where-am-i.csproj');
const hostSource = read('eft-where-am-i/UserControls/WhereAmI.cs');
const settingsSource = read('eft-where-am-i/Classes/SettingsHandler.cs');
const enhancementSource = read('eft-where-am-i/html/enhancements.js');
const terminalSource = read('eft-where-am-i/html/terminal-map.js');

for (const [name, source] of [
  ['project', projectFile],
  ['host', hostSource],
  ['settings', settingsSource],
  ['enhancements', enhancementSource],
  ['Terminal', terminalSource]
]) {
  assert(!/battle.?pass|battlepass|native-battle|wtf-blue-cross/i.test(source),
    `${name} still contains a custom Battle Pass integration trace.`);
}

assert(!fs.readdirSync(path.join(project, 'Classes')).some(name => /^BattlePass/i.test(name)),
  'A custom Battle Pass runtime class remains in the project.');
assert(!fs.readdirSync(path.join(project, 'html')).some(name => /^battle-pass/i.test(name)),
  'A custom Battle Pass runtime asset remains in the project.');

console.log('Native Battle Pass pass-through validation passed.');
