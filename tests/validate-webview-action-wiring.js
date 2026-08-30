const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const webSources = [
  'eft-where-am-i/html/panel.html',
  'eft-where-am-i/html/settings.html',
  'eft-where-am-i/html/enhancements.js'
].map(read).join('\n');
const hostSources = [
  'eft-where-am-i/UserControls/WhereAmI.cs',
  'eft-where-am-i/UserControls/SettingPage.cs'
].map(read).join('\n');

const emitted = new Set([...webSources.matchAll(/action:\s*['"]([^'"]+)['"]/g)].map(match => match[1]));
const handled = new Set([...hostSources.matchAll(/case\s+"([^"]+)"\s*:/g)].map(match => match[1]));
const missing = [...emitted].filter(action => !handled.has(action)).sort();

assert.ok(emitted.size >= 30, `Unexpectedly small WebView action surface: ${emitted.size}`);
assert.deepEqual(missing, [], `WebView actions without C# handlers: ${missing.join(', ')}`);

console.log(`WebView action wiring validation passed: ${emitted.size} emitted actions are handled.`);
