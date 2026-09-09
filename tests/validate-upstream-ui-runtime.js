const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('../.tools/jsdom-test/node_modules/jsdom');
const constants = fs.readFileSync('eft-where-am-i/Classes/Constants.cs', 'utf8');
const executor = fs.readFileSync('eft-where-am-i/Classes/JavaScriptExecutor.cs', 'utf8');
const selector = name => {
  const expression = constants.match(new RegExp(`public const string ${name}\\s*=([\\s\\S]*?);`))[1];
  return [...expression.matchAll(/"(?:\\.|[^"\\])*"/g)].map(m => JSON.parse(m[0])).join('');
};
const script = name => constants.match(new RegExp(`${name}\\s*=\\s*@"([\\s\\S]*?)";`))[1].replace(/""/g, '"');
const panelScript = executor.slice(executor.indexOf('public async Task<bool> IsPanelHiddenAsync()'))
  .match(/string script = \$@"([\s\S]*?)";/)[1]
  .replace('{JsLiteral(Constants.HIDE_SHOW_PANEL_BUTTON_SELECTOR)}', JSON.stringify(selector('HIDE_SHOW_PANEL_BUTTON_SELECTOR')))
  .replace(/\{\{/g, '{').replace(/\}\}/g, '}').replace(/""/g, '"');
const inputScript = executor.slice(executor.indexOf('public async Task<bool> EnsureWhereAmIInputAsync('))
  .match(/string script = \$@"([\s\S]*?)";/)[1]
  .replace('{inputSelector}', JSON.stringify(selector('WHERE_AM_I_INPUT_SELECTOR')))
  .replace(/\{\{/g, '{').replace(/\}\}/g, '}').replace(/""/g, '"');

(async () => {
  const dom = new JSDOM(`<body><header class="maps-site-chrome"></header>
    <div class="panel_top desktop-panel"><div class="toolbar-group primary-tools"><button id="where"></button></div>
    <div class="toolbar-group view-tools"><div class="hint-root"><button id="panels" aria-label="Show panels"></button></div>
    <div class="hint-root"><button id="fullscreen" aria-label="Full screen"></button></div></div>
    <div class="position-controls"><input id="map-position-file"></div></div>
    <div class="panel_left"></div><div class="panel_right"><div class="wtf-squad-panel">WTFMI squad</div></div>
    <div id="map"><div class="map-scene"><div class="marker" id="player"></div></div>
    <div class="marker" data-terminal-managed="true" id="terminal"></div></div>
    <div class="footer-wrap maps-site-chrome"></div></body>`, {runScripts:'dangerously', pretendToBeVisual:true,url:'https://tarkov-market.com/maps/woods'});
  const w = dom.window, d = w.document;
  const tick = () => new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(d.querySelector(selector('HIDE_SHOW_PANEL_BUTTON_SELECTOR')).id, 'panels');
  assert.equal(d.querySelector(selector('FULL_SCREEN_BUTTON_SELECTOR')).id, 'fullscreen');
  assert.equal(d.querySelector(selector('WHERE_AM_I_INPUT_SELECTOR')).id, 'map-position-file');
  assert.equal(w.eval(panelScript), 'true', 'icon-only Show panels must beat stale panel classes');
  d.querySelector('#panels').setAttribute('aria-label','Hide panels');
  d.querySelector('.panel_left').classList.add('collapsed');
  assert.equal(w.eval(panelScript), 'false', 'icon-only Hide panels must beat stale panel classes');
  d.querySelector('#panels').removeAttribute('aria-label');
  d.querySelector('#panels').setAttribute('aria-pressed','false');
  assert.equal(w.eval(panelScript), 'true');
  d.querySelector('#panels').removeAttribute('aria-pressed');
  assert.equal(w.eval(panelScript), 'true', 'legacy collapsed fallback must remain');
  let locationClicks = 0;
  d.querySelector('#where').onclick = () => locationClicks++;
  assert.equal(w.eval(inputScript), 'clicked');
  assert.equal(locationClicks,1,'new location control must be selected, not the rotation button');
  Object.defineProperty(d.querySelector('#map-position-file'),'offsetParent',{get:()=>d.body});
  assert.equal(w.eval(inputScript), 'ready');
  assert.equal(locationClicks,1,'visible location input must not be toggled closed');

  const counts = { active:0, callbacks:0 };
  const NativeObserver = w.MutationObserver;
  w.MutationObserver = class extends NativeObserver {
    constructor(callback) { super((...args)=>{counts.callbacks++;callback(...args);}); }
    observe(...args) { if(!this.live){ counts.active++;this.live=true; } super.observe(...args); }
    disconnect() { if(this.live){counts.active--;this.live=false;} super.disconnect(); }
  };
  const heading = script('ADD_DIRECTION_INDICATORS_SCRIPT');
  d.querySelector('#map-position-file').value = 'stamp_0,0,0_0,0.70710678,0,0.70710678_0';
  w.eval(heading);
  await tick();
  const triangle = d.querySelector('#player .triangle-indicator');
  assert.ok(triangle.style.transform.includes('rotate(270deg)'), triangle.style.transform);
  assert.equal(triangle.style.getPropertyPriority('transform'),'important','heading must override the base CSS transform');
  assert.equal(d.querySelector('#terminal .triangle-indicator'),null);
  assert.equal(d.querySelector('.map-scene > .triangle-indicator'),null,'map layers are not player markers');
  w.eval(heading);
  await tick();
  assert.equal(counts.active,1,'reinjecting must disconnect the previous observer');
  assert.equal(d.querySelectorAll('#player .triangle-indicator').length,1);
  d.querySelector('#map-position-file').value = 'stamp_0,0,0_0,0,0,1_0';
  d.querySelector('#map-position-file').dispatchEvent(new w.Event('input'));
  assert.ok(triangle.style.transform.includes('rotate(180deg)'));
  const replacement = d.querySelector('.position-controls').cloneNode(true);
  replacement.querySelector('input').value = 'stamp_0,0,0_0,1,0,0_0';
  d.querySelector('.position-controls').replaceWith(replacement);
  await tick();
  replacement.querySelector('input').dispatchEvent(new w.Event('change'));
  assert.ok(triangle.style.transform.includes('rotate(0deg)'),'SPA input replacement must bind heading updates');
  const cleanup = script('DEAD_ZONE_AUTO_PAN_SCRIPT');
  w.eval(cleanup); w.eval(cleanup);
  await tick();
  assert.equal(counts.active,2,'heading and cleanup should each have one observer');
  assert.equal(d.querySelector('header.maps-site-chrome'),null);
  assert.equal(d.querySelector('footer.maps-site-chrome, .footer-wrap.maps-site-chrome'),null);
  assert.ok(d.querySelector('.wtf-squad-panel'),'WTFMI multiplayer UI must survive cleanup');
  const idleCallbacks = counts.callbacks;
  await tick();
  assert.equal(counts.callbacks,idleCallbacks,'idle page must not cause an observer feedback loop');
  w.__eftWhereAmIMarkerObserver.disconnect();
  w.__eftWhereAmIUnwantedObserver.disconnect();
  if (w.__eftWhereAmIUnwantedFrame) w.cancelAnimationFrame(w.__eftWhereAmIUnwantedFrame);
  dom.window.close();

  const terminal = new JSDOM('<button id="terminalPanelToggle"></button><button id="terminalFullScreen"></button><input id="terminalLocationInput">');
  for(const [name,id] of [['HIDE_SHOW_PANEL_BUTTON_SELECTOR','terminalPanelToggle'],['FULL_SCREEN_BUTTON_SELECTOR','terminalFullScreen'],['WHERE_AM_I_INPUT_SELECTOR','terminalLocationInput']]) {
    assert.equal(terminal.window.document.querySelector(selector(name)).id,id);
  }
  terminal.window.close();
  console.log('PASS: new/legacy/Terminal controls, heading input replacement, observer reinjection and idle stability.');
})().catch(error => { console.error(error); process.exit(1); });
