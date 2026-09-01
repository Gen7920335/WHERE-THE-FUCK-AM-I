const fs = require('fs');
const path = require('path');
const { JSDOM } = require('../.tools/jsdom-test/node_modules/jsdom');

const dom = new JSDOM(
  `<body>
    <div class="panel_top"></div>
    <div class="panel_left">
      <div class="items scroll">
        <div class="no-wrap d-flex" data-quest-uid="stale-native-id"><span>quest a</span></div>
      </div>
    </div>
    <div class="panel_right"></div>
    <div class="map-cont"><div class="map-wrap" style="width: 4800px; height: 4800px"></div></div>
  </body>`,
  {
    runScripts: 'dangerously',
    url: 'https://tarkov-market.com/maps/woods',
    pretendToBeVisual: true
  }
);

const { window } = dom;
window.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
window.CanvasRenderingContext2D.prototype = {};
window.DOMMatrixReadOnly = class DOMMatrixReadOnly {
  constructor() {
    [this.a, this.b, this.c, this.d, this.e, this.f] = [1, 0, 0, 1, 0, 0];
  }
};
window.ResizeObserver = class ResizeObserver {
  observe() {}
  disconnect() {}
};

const enhancementsPath = path.resolve(__dirname, '..', 'eft-where-am-i', 'html', 'enhancements.js');
window.eval(fs.readFileSync(enhancementsPath, 'utf8'));
window.__wtfQuestLiveSource = async () => ({
  allMarkers: [{
    uid: 'marker-a',
    map: 'woods',
    category: 'Quests',
    subCategory: 'Quest',
    questUid: 'live-quest-id',
    name: 'Objective A',
    geometry: { x: 0, y: 0 },
    level: 1
  }],
  quests: [{ uid: 'live-quest-id', name: 'Quest A', type: 'SideQuest' }]
});

let markerLayerMutations = 0;
const observer = new window.MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.target?.id === 'wtf-quest-layer' && mutation.type === 'childList') {
      markerLayerMutations += 1;
    }
  }
});
observer.observe(window.document.documentElement, { childList: true, subtree: true });

window.__wtfQuestOverlay.configure({ map: 'woods' });
window.__wtfQuestOverlay.setPinnedQuests(['Quest A']);

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

setTimeout(async () => {
  const marker = window.document.querySelector('.wtf-quest-marker');
  if (!marker || marker.dataset.questUid !== 'live-quest-id') {
    throw new Error(`Live quest identity did not win over the stale native row: ${marker?.dataset.questUid}`);
  }

  const mutationsAtSettledPoint = markerLayerMutations;
  await delay(150);
  if (markerLayerMutations !== mutationsAtSettledPoint) {
    throw new Error(
      `Quest marker layer kept rebuilding after hydration: ${mutationsAtSettledPoint} -> ${markerLayerMutations}`
    );
  }
  if (markerLayerMutations > 4) {
    throw new Error(`Quest marker layer rebuilt too many times during startup: ${markerLayerMutations}`);
  }

  console.log(`PASS: conflicting native/live quest identities settled after ${markerLayerMutations} marker rebuilds`);
  observer.disconnect();
  dom.window.close();
}, 150);
