const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('../.tools/jsdom-test/node_modules/jsdom');
const source=fs.readFileSync('eft-where-am-i/Classes/Constants.cs','utf8');
const script=source.match(/ADD_DIRECTION_INDICATORS_SCRIPT\s*=\s*@"([\s\S]*?)";/)[1].replace(/""/g,'"');
const projection=fs.readFileSync('eft-where-am-i/Classes/TarkovMarketMapProjection.cs','utf8');
const maps=[...projection.matchAll(/\["([\w-]+)"\] = new\((\d+), (\d+), (\d+),/g)].map(m=>({slug:m[1],rotation:+m[4]}));
const matrix=degrees=>{const a=degrees*Math.PI/180;return `matrix(${Math.cos(a)},${Math.sin(a)},${-Math.sin(a)},${Math.cos(a)},0,0)`;};
const error=(a,b)=>Math.abs(((a-b+540)%360)-180);
const tick=()=>new Promise(r=>setTimeout(r,15));
(async()=>{
 let cases=0;
 for(const map of maps){
  const dom=new JSDOM(`<div class="panel_top"><input id="map-position-file"></div><div class="map-cont">
   <div class="map-wrap" style="transform:matrix(1.7,0,0,1.7,200,-90)"><div class="map-scene"></div></div>
   <div class="squad-layer"><div class="marker"></div></div>
   <div class="marker" data-terminal-managed="true"></div></div>`,{runScripts:'dangerously',pretendToBeVisual:true,url:`https://tarkov-market.com/maps/${map.slug}`});
  const w=dom.window,d=w.document,input=d.querySelector('input'),marker=d.querySelector('.marker'),scene=d.querySelector('.map-scene');
  try {
   w.eval(script);
   const triangle=marker.querySelector('.triangle-indicator');
   for(const view of [0,90,180,270]){
    scene.style.transform=matrix(view);
    // Native screen-space marker can already carry BOTH view and heading.
    for(const nativeHeading of [0,37]){
     marker.style.transform=matrix(view+nativeHeading);
     for(const yaw of [0,45,90,135,180,225,270,315]){
      const half=yaw*Math.PI/360;
      input.value=`2026-09-09[12-00]_0, 0, 0_0, ${Math.sin(half)}, 0, ${Math.cos(half)}_0`;
      input.dispatchEvent(new w.Event('input'));
      const actual=+triangle.style.transform.match(/rotate\(([-\d.]+)deg\)/)[1]+view+nativeHeading;
      // Two-point world->image reference, independently expressed as a
      // coordinate swap followed by clockwise map rotation and inversion.
      const world=[Math.cos(yaw*Math.PI/180),Math.sin(yaw*Math.PI/180)];
      const a=-map.rotation*Math.PI/180;
      const dx=-(world[0]*Math.cos(a)-world[1]*Math.sin(a));
      const dy=-(world[0]*Math.sin(a)+world[1]*Math.cos(a));
      const expected=Math.atan2(dx,-dy)*180/Math.PI+view;
      assert.ok(error(actual,expected)<1e-7,`${map.slug} yaw=${yaw} view=${view} actual=${actual} expected=${expected}`);
      assert.equal(triangle.hidden,false);cases++;
     }
    }
   }
   // View changes without a fresh screenshot must still settle correctly.
   scene.style.transform=matrix(0);marker.style.transform=matrix(0);await tick();
   const before=triangle.style.transform;
   marker.style.transform=matrix(37);await tick();
   const first=+before.match(/rotate\(([-\d.]+)deg\)/)[1];
   const after=+triangle.style.transform.match(/rotate\(([-\d.]+)deg\)/)[1];
   assert.ok(error(first,after+37)<1e-7);
   input.value='invalid';input.dispatchEvent(new w.Event('change'));assert.equal(triangle.hidden,true);
   input.value='stamp_0, 0, 0_0, 0, 0, 0_0';input.dispatchEvent(new w.Event('change'));assert.equal(triangle.hidden,true);
   assert.equal(d.querySelector('[data-terminal-managed] .triangle-indicator'),null);
   await tick();let callbacks=0;
   const idle=new w.MutationObserver(()=>callbacks++);idle.observe(marker,{attributes:true,subtree:true});
   await tick();await tick();idle.disconnect();assert.equal(callbacks,0);
  } finally {w.__eftWhereAmIMarkerObserver.disconnect();w.clearTimeout(w.__eftWhereAmIHeadingInitTimer);w.close();}
 }
 assert.equal(maps.length,12);
 console.log(`PASS: ${cases} headings across 12 maps, 8 directions, 4 view rotations, native parent heading; style refresh, invalid input, idle stability and Terminal isolation.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
