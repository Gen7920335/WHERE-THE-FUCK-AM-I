const fs = require('fs');
const path = require('path');
const { JSDOM } = require('../.tools/jsdom-test/node_modules/jsdom');

const dom = new JSDOM(
  `<body>
    <div class="panel_top"><button type="button">Native</button></div>
    <div class="panel_left"><div class="two-columns"><div>
      <div><div class="bold">임무</div></div>
      <div class="items"><div class="d-flex inactive"><span><svg class="icon icon_quest"><path d="m253.943,507.143"></path></svg>임무</span></div></div>
    </div></div></div>
    <div class="panel_right"><div class="tools tools_quests"><div class="quests-content">
      <div class="items scroll"><div class="no-wrap d-flex" data-quest-uid="541c3bb6-e792-4434-b55b-42a94097e8b0"><span>은혜 갚기</span></div></div>
    </div></div></div>
    <div class="map-cont"><div class="map-wrap" style="width: 4800px; height: 4800px"></div></div>
    <div><input name="layers" value="Ground" checked><input name="layers" value="Level 2"></div>
  </body>`,
  {
    runScripts: 'dangerously',
    url: 'https://tarkov-market.com/maps/woods',
    pretendToBeVisual: true
  }
);

const { window } = dom;
window.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
window.CanvasRenderingContext2D.prototype = { drawImage() {}, fillText() {}, strokeText() {} };
window.DOMMatrixReadOnly = class DOMMatrixReadOnly {
  constructor() {
    [this.a, this.b, this.c, this.d, this.e, this.f] = [1, 0, 0, 1, 0, 0];
  }
};
window.ResizeObserver = class ResizeObserver { observe() {} disconnect() {} };

const enhancementsPath = path.resolve(__dirname, '..', 'eft-where-am-i', 'html', 'enhancements.js');
window.eval(fs.readFileSync(enhancementsPath, 'utf8'));
window.__wtfQuestLiveSource = async () => ({
  allMarkers: [
    {
      uid: 'c40ee502-ec2a-4c82-b171-7f82040f0c10',
      map: 'woods',
      category: 'Quests',
      subCategory: 'Quest',
      questUid: '541c3bb6-e792-4434-b55b-42a94097e8b0',
      name: 'Hide the "Blue Folders" (crates by the antenna)',
      geometry: { x: -508.6796, y: 297.4152 },
      level: 1
    },
    {
      uid: 'bb4d252e-b312-43c5-970f-5b6632e0cc92',
      map: 'woods',
      category: 'Quests',
      subCategory: 'Quest',
      questUid: '541c3bb6-e792-4434-b55b-42a94097e8b0',
      name: 'Hide the "Blue Folders" (SUV)',
      geometry: { x: -441.9509, y: 287.2003 },
      level: 1
    },
    {
      uid: '5f3b01a9-6dd1-473e-8aaa-9e73208a716c',
      map: 'woods',
      category: 'Quests',
      subCategory: 'Quest',
      questUid: '541c3bb6-e792-4434-b55b-42a94097e8b0',
      name: 'Kill area',
      geometry: {
        x: -274.7302,
        y: -195.3143,
        points: [
          [-400.2854, -462.4144],
          [-13.8412, -282.6743],
          [-176.8279, 82.5524],
          [-563.3879, -98.3543]
        ]
      },
      level: 1
    },
    {
      uid: 'rect-zone-regression',
      map: 'woods',
      category: 'Quests',
      subCategory: 'Quest',
      questUid: 'rect-quest',
      name: 'Rectangular objective area',
      geometry: {
        x: -100,
        y: 100,
        rect: true,
        points: [[-120, 80], [-80, 80], [-80, 120], [-120, 120]]
      },
      level: -1
    }
  ],
  quests: [
    {
      uid: '541c3bb6-e792-4434-b55b-42a94097e8b0',
      name: 'Return the Favor',
      type: 'Elimination',
      requiredForKappa: false
    },
    { uid: 'rect-quest', name: 'Rect Quest', type: 'Elimination', requiredForKappa: false }
  ]
});
window.__wtfSetKoreanLocalization({ questNames: { 'Return the Favor': '은혜 갚기', 'Rect Quest': '사각 구역 테스트' } });
window.__wtfQuestOverlay.configure({ map: 'woods' });
window.__wtfQuestOverlay.setPinnedQuests(['은혜 갚기 (Return the Favor)', '사각 구역 테스트 (Rect Quest)']);

setTimeout(() => {
  const pointMarkers = window.document.querySelectorAll('.wtf-quest-marker');
  const zones = window.document.querySelectorAll('.wtf-quest-zone');
  if (pointMarkers.length !== 2 || zones.length !== 2) {
    throw new Error(`Quest areas must render before a text click: points=${pointMarkers.length}, zones=${zones.length}`);
  }

  const zone = window.document.querySelector('[data-marker-uid="5f3b01a9-6dd1-473e-8aaa-9e73208a716c"]');
  const rectZone = window.document.querySelector('[data-marker-uid="rect-zone-regression"]');
  if (!zone || !rectZone || zone.classList.contains('wtf-other-floor')
      || !rectZone.classList.contains('wtf-other-floor')) {
    throw new Error('Polygon/rectangle creation or quest-area floor opacity regressed.');
  }
  const renderedPoints = zone.getAttribute('points').trim().split(/\s+/);
  if (renderedPoints.length !== 4) {
    throw new Error(`Expected the native four-corner kill area, got ${zone.getAttribute('points')}`);
  }
  const [firstX, firstY] = renderedPoints[0].split(',').map(Number);
  if (Math.abs(firstX - 3124.8288) > 0.001 || Math.abs(firstY - 2039.4292) > 0.001) {
    throw new Error(`Woods quest-area projection drifted: ${renderedPoints[0]}`);
  }
  if (zone.getAttribute('fill') !== '#a87b00' || zone.getAttribute('stroke') !== '#a87b00') {
    throw new Error('Quest area no longer matches the native non-story quest color.');
  }

  console.log('PASS: polygon/rectangle quest areas render at native coordinates with floor opacity before quest text interaction.');
  dom.window.close();
}, 100);
