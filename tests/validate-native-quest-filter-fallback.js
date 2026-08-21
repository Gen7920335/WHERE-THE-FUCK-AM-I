const fs = require('fs');
const path = require('path');
const { JSDOM } = require('../.tools/jsdom-test/node_modules/jsdom');

const dom = new JSDOM(
  `<body>
    <div class="panel_top"><button type="button">Native</button></div>
    <div class="panel_left"><div class="two-columns"><div>
      <div><div class="bold">임무</div></div>
      <div class="items"><div id="native-quest-visibility" class="d-flex">
        <span><svg class="icon icon_quest"><path d="m253.943,507.143 current"></path></svg>임무</span>
      </div></div>
    </div></div></div>
    <div class="panel_right"></div>
    <div class="map-cont"><div class="map-wrap" style="width: 5500px; height: 4200px"></div></div>
  </body>`,
  {
    runScripts: 'dangerously',
    url: 'https://tarkov-market.com/maps/lab',
    pretendToBeVisual: true
  }
);

const { window } = dom;
window.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
window.CanvasRenderingContext2D.prototype = {
  drawImage() {},
  fillText() {},
  strokeText() {}
};
window.DOMMatrixReadOnly = class DOMMatrixReadOnly {
  constructor() {
    [this.a, this.b, this.c, this.d, this.e, this.f] = [1, 0, 0, 1, 0, 0];
  }
};
window.ResizeObserver = class ResizeObserver {
  observe() {}
  disconnect() {}
};

const nativeQuestVisibility = window.document.getElementById('native-quest-visibility');
let nativeToggleCount = 0;
nativeQuestVisibility.addEventListener('click', () => {
  nativeToggleCount += 1;
  nativeQuestVisibility.classList.toggle('inactive');
});
window.addEventListener('popstate', () => {
  if (new window.URL(window.location.href).searchParams.has('obj')) {
    nativeQuestVisibility.classList.remove('inactive');
  }
});

const enhancementsPath = path.resolve(__dirname, '..', 'eft-where-am-i', 'html', 'enhancements.js');
window.eval(fs.readFileSync(enhancementsPath, 'utf8'));
window.__wtfQuestLiveSource = async () => ({
  allMarkers: [{
    uid: 'marker-1',
    map: 'lab',
    category: 'Quests',
    subCategory: 'Quest',
    questUid: 'quest-1',
    name: 'Objective',
    geometry: { x: -500, y: -321 },
    level: 1
  }],
  quests: [{ uid: 'quest-1', name: 'Quest 1', type: 'SideQuest' }]
});
window.__wtfQuestOverlay.configure({ map: 'lab' });
window.__wtfQuestOverlay.setPinnedQuests(['Quest 1']);

const nextFrame = () => new Promise((resolve) => window.requestAnimationFrame(resolve));

setTimeout(async () => {
  const marker = window.document.querySelector('.wtf-quest-marker');
  if (!marker) throw new Error('Expected one pinned quest marker.');
  if (!nativeQuestVisibility.classList.contains('inactive') || nativeToggleCount < 1) {
    throw new Error('Selecting a pinned quest did not disable the native quest layer.');
  }

  nativeQuestVisibility.classList.remove('inactive');
  marker.click();
  await nextFrame();
  await nextFrame();
  if (!nativeQuestVisibility.classList.contains('inactive') || nativeToggleCount < 1) {
    throw new Error('Current icon_quest fallback did not disable the native quest layer.');
  }

  nativeQuestVisibility.classList.remove('inactive');
  await nextFrame();
  await nextFrame();
  if (!nativeQuestVisibility.classList.contains('inactive')) {
    throw new Error('Delayed native quest-layer reactivation escaped the fallback guard.');
  }

  console.log(`PASS: native quest fallback toggles=${nativeToggleCount}`);
  dom.window.close();
}, 80);
