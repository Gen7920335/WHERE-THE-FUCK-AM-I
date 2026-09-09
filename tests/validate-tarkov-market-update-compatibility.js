const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const constants = read('eft-where-am-i/Classes/Constants.cs');
const executor = read('eft-where-am-i/Classes/JavaScriptExecutor.cs');
const whereAmI = read('eft-where-am-i/UserControls/WhereAmI.cs');
const settingsPage = read('eft-where-am-i/UserControls/SettingPage.cs');

assert.match(
  constants,
  /WHERE_AM_I_INPUT_SELECTOR\s*=\s*"#map-position-file, "[\s\S]*?\.position-controls[\s\S]*?#terminalLocationInput"/,
  'the dedicated Tarkov-Market and Terminal location inputs must be selected directly'
);
assert.doesNotMatch(constants, /WHERE_AM_I_BUTTON_SELECTOR/, 'the obsolete positional button selector must stay removed');
assert.match(
  constants,
  /panel_top\.desktop-panel > div > div:nth-child\(3\) > button, #terminalFullScreen/,
  'the updated Tarkov-Market fullscreen control and Terminal fallback must both remain wired'
);

assert.match(executor, /SemaphoreSlim whereAmIInputLock/, 'location input opening must be serialized');
assert.match(executor, /EnsureWhereAmIInputAsync/, 'the location input must be opened through the guarded helper');
assert.match(executor, /SetWhereAmIInputValueAsync/, 'coordinates must use the dedicated input setter');
assert.match(executor, /#terminalWhereButton/, 'the local Terminal map must retain its location button');
assert.match(executor, /\['where am i\?', '내 위치는\?'\]/, 'the live button must be matched by label');
assert.match(executor, /label\.includes\('rotate'\).*text\.includes\('°'\)/s, 'the structural fallback must identify the rotate control');
assert.doesNotMatch(
  executor,
  /document\.querySelector\('input\[placeholder\]'\)/,
  'coordinates must never fall back to an unrelated search input'
);

assert.ok(
  (whereAmI.match(/EnsureWhereAmIInputAsync\(/g) || []).length >= 3,
  'navigation, initialization, and screenshot handling must all guard the input'
);
assert.match(whereAmI, /SetWhereAmIInputValueAsync\(filenameWithoutExt\)/, 'screenshots must target the dedicated input');
assert.doesNotMatch(whereAmI, /whereAmIClick|CheckInputAble|SetInputValueAsync/, 'the stale one-shot flow must stay removed');

for (const [source, profile] of [
  [whereAmI, 'Content'],
  [whereAmI, 'PanelUI'],
  [settingsPage, 'Settings']
]) {
  assert.match(source, new RegExp(`"WHERE-THE-FUCK-AM-I", "WebView2", "${profile}"`));
}
assert.doesNotMatch(whereAmI, /MyAppWebView2.*Guid\.NewGuid/, 'map WebView profiles must persist between runs');
assert.doesNotMatch(settingsPage, /MyAppWebView2.*Guid\.NewGuid/, 'settings WebView profile must persist between runs');

console.log('Tarkov-Market toolbar compatibility validation passed.');
