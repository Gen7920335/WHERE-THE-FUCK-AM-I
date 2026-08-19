const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const calculatorSource = fs.readFileSync(
  path.join(root, 'eft-where-am-i', 'Classes', 'ResponsiveMapZoom.cs'),
  'utf8'
);
const hostSource = fs.readFileSync(
  path.join(root, 'eft-where-am-i', 'UserControls', 'WhereAmI.cs'),
  'utf8'
);

const readConstant = (name) => {
  const match = calculatorSource.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`));
  assert.ok(match, `missing ${name}`);
  return Number(match[1]);
};

const targetWidth = readConstant('DesktopLayoutTargetWidth');
const minimumZoom = readConstant('MinimumZoomFactor');
const maximumZoom = readConstant('MaximumZoomFactor');

const calculate = (cssWidth, currentZoom) => {
  const widthAtOneHundredPercent = cssWidth * currentZoom;
  const target = Math.min(maximumZoom, widthAtOneHundredPercent / targetWidth);
  return Math.round(Math.min(maximumZoom, Math.max(minimumZoom, target)) * 1000) / 1000;
};

assert.equal(targetWidth, 920, 'desktop layout needs a margin above Tarkov Market\'s 900px breakpoint');
assert.equal(calculate(839, 1), 0.912, '175% portrait viewport should automatically zoom out');
assert.equal(calculate(992, 1), 1, '150% portrait viewport should stay at 100%');
assert.equal(calculate(920, 0.912), 0.912, 'the adjusted viewport must be stable');
assert.equal(calculate(469, 1), 0.51, 'very narrow windows should still reach the desktop layout');

assert.match(hostSource, /webView2\.Resize\s*\+=/, 'window resizing must schedule an adaptive zoom update');
assert.match(hostSource, /ScheduleResponsiveMapZoomUpdate\(\);[\s\S]*jsExecutor == null/, 'navigation must schedule adaptive zoom before waiting for desktop-only DOM');
assert.match(hostSource, /webView2\.ZoomFactor\s*=\s*targetZoom/, 'the calculated zoom must be applied to WebView2');

console.log('Responsive panel layout validation passed.');
