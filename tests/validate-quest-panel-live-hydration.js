const fs = require('fs');
const path = require('path');
const { JSDOM } = require('../.tools/jsdom-test/node_modules/jsdom');

const dom = new JSDOM(
  `<body>
    <div class="panel_top desktop-panel"><button type="button">Native</button></div>
    <div class="mobile-map-ui"></div>
    <div class="panel_left"><div class="two-columns"><div>
      <div><div class="bold">Quests</div></div>
      <div class="items"><div id="native-quest-visibility" class="d-flex inactive">
        <span><svg class="icon icon_quest"><path d="m253.943,507.143 current"></path></svg>Quests</span>
      </div></div>
    </div></div></div>
    <div class="panel_right"><div class="tools tools_quests"><div class="quests-content"></div></div></div>
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
const nativeQuestFilterState = {};
let nativeQuestFilterToggleCount = 0;
window.document.querySelector('.panel_left').__vueParentComponent = {
  props: { selectedSubCategoriesMap: nativeQuestFilterState },
  vnode: {
    props: {
      onToggleSubCategory(category, subCategory) {
        if (category !== 'Quests' || subCategory !== 'Quest') {
          throw new Error(`Unexpected native filter key: ${category}_${subCategory}`);
        }
        nativeQuestFilterToggleCount += 1;
        delete nativeQuestFilterState.Quests_Quest;
        nativeQuestVisibility.classList.add('inactive');
      }
    }
  },
  parent: null
};
window.addEventListener('popstate', () => {
  if (new window.URL(window.location.href).searchParams.has('obj')) {
    nativeQuestFilterState.Quests_Quest = true;
    nativeQuestVisibility.classList.remove('inactive');
  }
});

const enhancementsPath = path.resolve(__dirname, '..', 'eft-where-am-i', 'html', 'enhancements.js');
const enhancementsSource = fs.readFileSync(enhancementsPath, 'utf8');
if (/script\[type=["']module["']\]\[src\]/.test(enhancementsSource)) {
  throw new Error('Quest source discovery still depends on Cloudflare restoring type="module" first.');
}
window.eval(enhancementsSource);
window.__wtfQuestLiveSource = async () => ({
  allMarkers: [
    {
      uid: 'marker-a',
      map: 'lab',
      category: 'Quests',
      subCategory: 'Quest',
      questUid: 'quest-a',
      name: 'Objective A',
      geometry: { x: -500, y: -321 },
      level: 1
    },
    {
      uid: 'marker-b',
      map: 'lab',
      category: 'Quests',
      subCategory: 'Quest',
      questUid: 'quest-b',
      name: 'Objective B',
      geometry: { x: -480, y: -305 },
      level: 1
    }
  ],
  quests: [
    { uid: 'quest-a', name: 'Quest A', type: 'SideQuest' },
    { uid: 'quest-b', name: 'Quest B', type: 'SideQuest' }
  ]
});

window.__wtfQuestOverlay.configure({ map: 'lab' });
window.__wtfQuestOverlay.setPinnedQuests(['Quest A', 'Quest B']);

const nextFrame = () => new Promise((resolve) => window.requestAnimationFrame(resolve));

setTimeout(async () => {
  const markersBeforeClick = window.document.querySelectorAll('.wtf-quest-marker').length;
  if (markersBeforeClick !== 2) {
    throw new Error(`Expected two restored quest markers before any panel click, got ${markersBeforeClick}.`);
  }

  const requirementsPanel = window.document.getElementById('wtf-quest-requirements-panel');
  const requirementCards = requirementsPanel?.querySelectorAll('.wtf-quest-requirements-card').length || 0;
  if (!requirementsPanel || requirementsPanel.hidden || requirementCards !== 2) {
    throw new Error(`Quest area did not hydrate from live data before interaction: cards=${requirementCards}.`);
  }

  const marker = window.document.querySelector('.wtf-quest-marker');
  marker.click();
  await nextFrame();
  await nextFrame();

  const markersAfterClick = window.document.querySelectorAll('.wtf-quest-marker').length;
  if (markersAfterClick !== 2) {
    throw new Error(`Opening one quest changed the pinned marker set: ${markersBeforeClick} -> ${markersAfterClick}.`);
  }
  if (!nativeQuestVisibility.classList.contains('inactive') || nativeQuestFilterState.Quests_Quest) {
    throw new Error('Opening quest details re-enabled the native all-quest layer.');
  }

  console.log(`PASS: live quest area hydrated before click; markers=${markersAfterClick}, nativeToggles=${nativeQuestFilterToggleCount}`);
  dom.window.close();
}, 100);
