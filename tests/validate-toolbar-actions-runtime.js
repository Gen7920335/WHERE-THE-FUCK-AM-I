const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('../.tools/jsdom-test/node_modules/jsdom');

const dom = new JSDOM(`<head><style>.panel_top {pointer-events:none}.map-toolbar {pointer-events:auto}</style></head><body>
  <div class="panel_top"><div class="map-toolbar">
    <div class="toolbar-group view-tools"><button class="toolbar-icon" aria-label="Hide panels"></button></div>
    <div class="toolbar-group primary-tools"><button class="active">Where am i?</button><button class="pro">OCR</button></div>
  </div></div>
  <div class="panel_left"><label class="pro"><input>Paid filter</label></div>
  <div class="panel_right">
    <header id="free-quest-header">Quests<button class="pro">Settings</button></header>
    <div class="guide-row"><a class="pro">Guide mode</a><svg id="guide-settings"></svg></div>
    <div class="quests-content"><div class="step-text">Reach the village</div><div class="pro step-check"><button>Complete</button></div></div>
    <div class="sub">Use your progress ✘</div><div id="free-filters"><a>Story</a><a>Kappa</a><a>All</a></div>
    <div><div class="user-layers-panel">Paid layers</div><div class="squad-panel">Native squad</div></div>
    <div id="free-progress" class="progress profile">Progress information</div>
  </div>
  <div class="map-popup"><p id="free-description">Quest location</p><button class="pro">Hide</button><button id="free-close">Close</button></div>
  <div class="popup"><div class="pro step-check"><button>Complete</button></div><p id="free-objective">Objective details</p></div>
  <div id="wtf-squad-settings">WTFMI multiplayer</div>
  <div class="map-cont"><div class="map-wrap" style="width:4800px;height:4800px"></div></div>
  </body>`, {runScripts:'dangerously', pretendToBeVisual:true, url:'https://tarkov-market.com/maps/woods'});
const w = dom.window;
const observers = [];
const Observer = w.MutationObserver;
w.MutationObserver = class extends Observer {
  constructor(callback) { super(callback); observers.push(this); }
};
const frames = new Set();
const requestFrame = w.requestAnimationFrame.bind(w);
w.requestAnimationFrame = callback => {
  const id = requestFrame(time => {frames.delete(id);callback(time);});
  frames.add(id);
  return id;
};
w.CanvasRenderingContext2D = function() {};
w.CanvasRenderingContext2D.prototype = {drawImage(){},fillText(){},strokeText(){}};
w.ResizeObserver = class { observe(){} disconnect(){} };
const messages = [];
w.chrome = {webview:{postMessage(message){messages.push(JSON.parse(message));}}};
w.confirm = () => true;
w.eval(fs.readFileSync('eft-where-am-i/html/enhancements.js','utf8'));
w.__wtfPingOverlay.configure({map:'woods',pings:[{id:'p1',left:20,top:30,owned:true}]});
w.__wtfRouteOverlay.configure({map:'woods',nodes:[{id:'n1',left:25,top:35,owned:true}],localNodeCount:1});
setTimeout(() => {
  try {
    for(const [id,action] of [['wtf-clear-pings-button','map-pings-clear'],['wtf-clear-route-button','map-route-nodes-clear']]) {
      const button = w.document.getElementById(id);
      assert.equal(button.parentElement.className,'map-toolbar','clear actions must join the interactive wrapping toolbar');
      assert.equal(w.getComputedStyle(button).pointerEvents,'auto','clear action must receive pointer input');
      assert.ok(!button.classList.contains('toolbar-icon'),'text buttons must not inherit icon-only sizing');
      assert.ok(!button.classList.contains('active'),'clear actions must not inherit toggle state');
      assert.equal(button.disabled,false);
      button.click();
      assert.ok(messages.some(m=>m.action===action),`${action} must reach the host`);
    }
    for(const button of w.document.querySelectorAll('.pro,.guide-row,.user-layers-panel,.squad-panel')) {
      assert.equal(w.getComputedStyle(button).display,'none');
      assert.equal(button.getAttribute('aria-hidden'),'true');
    }
    for(const id of ['free-quest-header','free-filters','free-progress','free-description','free-close','free-objective','wtf-squad-settings']) {
      const element = w.document.getElementById(id);
      assert.notEqual(w.getComputedStyle(element).display,'none',`${id} must remain available`);
      assert.equal(element.closest('[data-wtf-commercial-hidden="true"]'),null);
    }
    const menu = w.document.createElement('div');
    menu.className = 'popup';
    menu.innerHTML = '<button class="pro">Complete</button><button>Close</button>';
    w.document.body.appendChild(menu);
    assert.equal(w.getComputedStyle(menu.firstElementChild).display,'none','new popup must hide Pro before the next observer frame');
    assert.notEqual(w.getComputedStyle(menu.lastElementChild).display,'none');
    console.log('PASS: toolbar actions, Pro div/SVG/popup removal, immediate dynamic hiding, free filters/objectives and custom squad preservation.');
  } finally {
    observers.forEach(observer=>observer.disconnect());
    frames.forEach(id=>w.cancelAnimationFrame(id));
    dom.window.close();
  }
},100);
