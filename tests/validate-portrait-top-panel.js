const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const panelHtml = fs.readFileSync(path.join(root, 'eft-where-am-i', 'html', 'panel.html'), 'utf8');
const whereAmI = fs.readFileSync(path.join(root, 'eft-where-am-i', 'UserControls', 'WhereAmI.cs'), 'utf8');

assert.match(panelHtml, /function setPortraitMode\(enabled\)/);
assert.match(panelHtml, /html\.portrait-mode button\s*\{[\s\S]*?font-size:\s*50%\s*!important/);
assert.match(panelHtml, /html\.portrait-mode button\s*\{[\s\S]*?width:\s*50%\s*!important/);
assert.match(panelHtml, /html\.portrait-mode \.scale-stack\s*\{[\s\S]*?grid-column:\s*4\s*\/\s*6\s*!important/);
assert.match(panelHtml, /html\.portrait-mode \.scale-control input\[type="range"\][\s\S]*?min-width:\s*4\.5rem/);
assert.match(panelHtml, /::-webkit-slider-thumb\s*\{[\s\S]*?height:\s*1\.1rem[\s\S]*?width:\s*1\.1rem/);

assert.match(whereAmI, /bool portrait = ClientSize\.Height > ClientSize\.Width;/);
assert.match(whereAmI, /setPortraitMode\(\{portrait\.ToString\(\)\.ToLowerInvariant\(\)\}\)/);
assert.match(whereAmI, /SizeChanged \+= WhereAmI_SizeChanged;/);

console.log('Portrait top panel validation passed.');
