const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('../.tools/jsdom-test/node_modules/jsdom');
const dom = new JSDOM(`<body><div class="panel_top"></div>
<div class="map-popup" style="left:600px;top:400px;transform:translate(-50%,-100%)">
 <div class="ml-15 self-start"></div><p>Bunker at the northern path to the mountain.</p><button class="pro">Complete</button>
</div><div class="quests-details-col">
 <p id="require">Require</p><p id="prereq">Requires quest: Snatch</p>
 <p id="delay">⏱ Available 10h after unlock</p><p id="reward">+0.03 Rep</p>
 <p id="split-reward">Lightkeeper<span>+</span><span>0.03 Rep</span></p>
 <p id="items">Quest related items</p><p id="prev">Prev</p><p id="next">Next</p>
 <p id="unmatched">Unknown original detail</p>
</div><p id="outside">Available 10h after unlock</p></body>`, {
  url:'https://tarkov-market.com/maps/woods',runScripts:'dangerously',pretendToBeVisual:true
});
const w = dom.window;
const observers=[];
const Observer=w.MutationObserver;
w.MutationObserver=class extends Observer {constructor(cb){super(cb);observers.push(this);}};
const resizes=[];
w.ResizeObserver=class {constructor(cb){this.cb=cb;resizes.push(this);}observe(){}disconnect(){this.disconnected=true;}};
const frames=new Set();
const raf=w.requestAnimationFrame.bind(w);
w.requestAnimationFrame=cb=>{const id=raf(t=>{frames.delete(id);cb(t);});frames.add(id);return id;};
w.CanvasRenderingContext2D=function(){};
w.CanvasRenderingContext2D.prototype={drawImage(){},fillText(){},strokeText(){}};
w.chrome={webview:{postMessage(){}}};
const popup=w.document.querySelector('.map-popup');
let origin={x:400,y:-150},natural={w:500,h:650},zoom=1;
const num=key=>parseFloat(popup.style.getPropertyValue(key));
const width=()=>Math.min(natural.w,num('--wtf-popup-max-width')||Infinity);
const height=()=>Math.min(natural.h,num('--wtf-popup-max-height')||Infinity);
Object.defineProperties(popup,{offsetWidth:{get:width},offsetHeight:{get:height}});
popup.getClientRects=()=>[popup.getBoundingClientRect()];
popup.getBoundingClientRect=()=>{
 const x=origin.x+(num('--wtf-popup-shift-x')||0)*zoom;
 const y=origin.y+(num('--wtf-popup-shift-y')||0)*zoom;
 return {x,y,left:x,top:y,width:width()*zoom,height:height()*zoom,right:x+width()*zoom,bottom:y+height()*zoom};
};
w.document.querySelector('.panel_top').getBoundingClientRect=()=>({bottom:110});
const wait=()=>new Promise(r=>setTimeout(r,80));
const checkBounds=()=>{
 const r=popup.getBoundingClientRect();
 assert.ok(r.left>=7.98&&r.top>=117.98,JSON.stringify(r));
 assert.ok(r.right<=w.innerWidth-7.98&&r.bottom<=w.innerHeight-7.98,JSON.stringify(r));
 assert.equal(popup.style.transform,'translate(-50%,-100%)','native transform must remain untouched');
 assert.equal(popup.style.left,'600px','native anchor must remain untouched');
};
(async()=>{
 try {
  w.eval(fs.readFileSync('eft-where-am-i/html/enhancements.js','utf8'));
  w.__wtfSetEnhancementSettings({language:'ko'});
  w.__wtfPingOverlay.configure({map:'woods',pings:[]});
  await wait();
  checkBounds();
  for(const [x,y] of [[-500,-300],[1800,900],[200,250]]){
   origin={x,y}; popup.style.top=`${y}px`; await wait(); checkBounds();
  }
  // Late photo growth and CSS zoom, then portrait/narrow-window resize.
  natural.h=2200; zoom=1.5;
  resizes.forEach(r=>r.cb()); await wait(); checkBounds();
  w.innerWidth=360;w.innerHeight=640;
  w.dispatchEvent(new w.Event('resize')); await wait(); checkBounds();
  let mutations=0;
  const monitor=new Observer(records=>mutations+=records.length);
  monitor.observe(popup,{attributes:true});
  await wait(); await wait(); monitor.disconnect();
  assert.equal(mutations,0,'idle layout must not keep writing popup styles');
  // Native detail text is the site's own (official) localization; we never rewrite it.
  assert.equal(w.document.getElementById('prereq').textContent,'Requires quest: Snatch');
  assert.equal(w.document.getElementById('delay').textContent,'⏱ Available 10h after unlock');
  assert.equal(w.document.getElementById('unmatched').textContent,'Unknown original detail');
  assert.equal(w.getComputedStyle(popup.querySelector('.pro')).display,'none');
  let escapes=0;w.addEventListener('keydown',e=>{if(e.key==='Escape')escapes++;});
  popup.querySelector('.wtf-native-popup-close').click();assert.equal(escapes,1);
  popup.classList.add('mobile');await wait();
  assert.equal(popup.style.getPropertyValue('--wtf-popup-shift-y'),'','native mobile sheet must keep its own layout');
  assert.equal(w.getComputedStyle(popup.querySelector('.wtf-native-popup-close')).display,'none','mobile sheet owns its close control');
  popup.classList.remove('mobile');await wait();checkBounds();
  popup.remove();await wait();
  assert.ok(resizes.some(r=>r.disconnected),'removed popup observer must disconnect');
  console.log('PASS: popup bounds/corners/zoom/photo resize, idle stability, cleanup, close, native detail text left untouched.');
 } finally {observers.forEach(o=>o.disconnect());frames.forEach(id=>w.cancelAnimationFrame(id));w.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
