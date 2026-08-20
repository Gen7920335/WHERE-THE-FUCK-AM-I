const fs = require('fs');
const path = require('path');
const { JSDOM } = require('../.tools/jsdom-test/node_modules/jsdom');

const questCount = 12;
const rows = Array.from({ length: questCount }, (_, index) =>
  `<div class="no-wrap d-flex" data-quest-uid="q${index}"><span>Quest ${index}</span></div>`
).join('');
const dom = new JSDOM(
  `<body>
    <div class="panel_left"><div class="two-columns"><div>
      <div><div class="bold">Quests</div></div>
      <div class="items"><div id="native-quest-visibility" class="d-flex"><span>Quest</span></div></div>
    </div></div></div>
    <div class="map-cont"><div class="map-wrap" style="width: 5500px; height: 4200px"></div></div>
    <div class="no-wrap"><input name="layers" value="Ground" checked><input name="layers" value="Level 2"></div>
    <div class="items scroll">${rows}</div>
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
  constructor(value = '') {
    const entries = String(value).match(/matrix\(([^)]+)\)/)?.[1]
      ?.split(',')
      .map(Number);
    [this.a, this.b, this.c, this.d, this.e, this.f] = entries?.length === 6
      ? entries
      : [1, 0, 0, 1, 0, 0];
  }
};
window.ResizeObserver = class ResizeObserver {
  observe() {}
  disconnect() {}
};
const messages = [];
window.chrome = { webview: { postMessage: (message) => messages.push(JSON.parse(message)) } };

const enhancementsPath = path.resolve(__dirname, '..', 'eft-where-am-i', 'html', 'enhancements.js');
window.eval(fs.readFileSync(enhancementsPath, 'utf8'));
const questNames = Object.fromEntries(Array.from({ length: questCount }, (_, index) => [
  `Quest ${index}`,
  `퀘스트 ${index}`
]));
window.__wtfSetKoreanLocalization({ questNames });
const markers = Array.from({ length: questCount }, (_, index) => ({
  uid: `m${index}`,
  map: 'lab',
  category: 'Quests',
  subCategory: 'Quest',
  questUid: `q${index}`,
  name: `Objective ${index}`,
  geometry: {
    x: (((10 + (index * 5)) / 100) * 5500 - 6100) / 10,
    y: (((20 + (index * 4)) / 100) * 4200 - 4050) / 10
  },
  level: index % 3 === 0 ? 2 : 1
}));
const quests = Array.from({ length: questCount }, (_, index) => ({
  uid: `q${index}`,
  name: `Quest ${index}`,
  type: index === 1 ? 'Storyline' : 'SideQuest',
  requiredForKappa: index !== 1 && index % 2 === 0
}));
window.__wtfQuestLiveSource = async () => ({ allMarkers: markers, quests });

window.__wtfQuestOverlay.configure({ map: 'lab' });
window.__wtfQuestOverlay.setPinnedQuests(quests.map((quest) => `퀘스트 ${quest.name.slice(6)} (${quest.name})`));

setTimeout(async () => {
  const checked = window.document.querySelectorAll('.wtf-quest-pin:checked').length;
  const rendered = window.document.querySelectorAll('.wtf-quest-marker').length;
  if (checked !== questCount || rendered !== questCount) {
    throw new Error(`Expected ${questCount} pins, got checked=${checked}, rendered=${rendered}`);
  }
  const snapshot = window.__wtfQuestOverlay.debugSnapshot();
  if (snapshot.source !== 'test-live-store' || snapshot.availableMarkers !== questCount) {
    throw new Error(`Expected live marker source, got ${JSON.stringify(snapshot)}`);
  }
  const firstPath = window.document.querySelector('.wtf-quest-marker-icon path');
  if (!firstPath
      || firstPath.getAttribute('stroke') !== '#000'
      || firstPath.getAttribute('stroke-width') !== '20'
      || firstPath.getAttribute('fill') !== '#70a800'
      || !firstPath.getAttribute('d').startsWith('m253.943,502.885')) {
    throw new Error('Quest marker SVG does not match the native Tarkov-Market renderer.');
  }
  const firstMarkerScale = window.document.querySelector('.wtf-quest-marker')
    .style.getPropertyValue('--wtf-quest-marker-scale');
  if (Number(firstMarkerScale) !== 1) {
    throw new Error(`Expected native marker scale 1 at/above base zoom, got ${firstMarkerScale}.`);
  }

  const mapWrap = window.document.querySelector('.map-wrap');
  mapWrap.style.transform = 'matrix(0.1025, 0, 0, 0.1025, 0, 0)';
  window.dispatchEvent(new window.Event('resize'));
  await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
  await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
  const reducedMarkerScale = window.document.querySelector('.wtf-quest-marker')
    .style.getPropertyValue('--wtf-quest-marker-scale');
  if (Number(reducedMarkerScale) !== 0.5) {
    throw new Error(`Expected native marker scale floor 0.5 below base zoom, got ${reducedMarkerScale}.`);
  }
  mapWrap.style.transform = 'matrix(1, 0, 0, 1, 0, 0)';
  const routeMessageCount = messages.length;
  window.document.querySelector('.wtf-quest-marker').dispatchEvent(new window.MouseEvent('pointerdown', {
    bubbles: true,
    button: 1,
    clientX: 110,
    clientY: 84
  }));
  const routeMessage = messages.slice(routeMessageCount).find((message) => message.action === 'map-route-node-add');
  if (!routeMessage || Math.abs(routeMessage.left - 2) > 1e-8 || Math.abs(routeMessage.top - 2) > 1e-8) {
    throw new Error(`Wheel-click on quest marker did not preserve the exact click point: ${JSON.stringify(routeMessage)}`);
  }
  const markerElements = [...window.document.querySelectorAll('.wtf-quest-marker')];
  if (!markerElements[0].classList.contains('wtf-other-floor')
      || markerElements[1].classList.contains('wtf-other-floor')
      || markerElements[1].querySelector('path').getAttribute('fill') !== '#8598a6'
      || markerElements[3].querySelector('path').getAttribute('fill') !== '#a87b00') {
    throw new Error('Native quest color or floor-opacity behavior does not match.');
  }

  window.__wtfQuestOverlay.setPinnedQuests([]);
  for (const checkbox of window.document.querySelectorAll('.wtf-quest-pin')) {
    checkbox.checked = true;
    checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
  }
  const checkedAfterClicks = window.document.querySelectorAll('.wtf-quest-pin:checked').length;
  const renderedAfterClicks = window.document.querySelectorAll('.wtf-quest-marker').length;
  if (checkedAfterClicks !== questCount || renderedAfterClicks !== questCount) {
    throw new Error(`Checkbox activation failed: checked=${checkedAfterClicks}, rendered=${renderedAfterClicks}`);
  }

  const finalCheckbox = window.document.querySelectorAll('.wtf-quest-pin')[questCount - 1];
  window.document.querySelector('.items.scroll').remove();
  window.dispatchEvent(new window.Event('resize'));
  const renderedWithoutPanel = window.document.querySelectorAll('.wtf-quest-marker').length;
  if (renderedWithoutPanel !== questCount) {
    throw new Error(`Expected ${questCount} markers with the quest panel hidden, got ${renderedWithoutPanel}`);
  }

  const firstMarker = window.document.querySelector('.wtf-quest-marker');
  firstMarker.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const query = new window.URL(window.location.href).searchParams;
  if (query.get('view') !== 'q0' || query.get('obj') !== 'm0'
      || window.document.querySelector('.wtf-quest-popup')) {
    throw new Error(`Native details routing failed: ${window.location.href}`);
  }
  const nativeQuestVisibility = window.document.getElementById('native-quest-visibility');
  nativeQuestVisibility.classList.add('inactive');
  await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
  await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
  const hiddenQuery = new window.URL(window.location.href).searchParams;
  if (!window.document.getElementById('wtf-quest-layer').hidden
      || hiddenQuery.has('view') || hiddenQuery.has('obj')) {
    throw new Error(`Disabled native quest visibility revived a selected marker: ${window.location.href}`);
  }
  nativeQuestVisibility.classList.remove('inactive');
  await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
  await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
  if (window.document.getElementById('wtf-quest-layer').hidden) {
    throw new Error('Quest overlay did not follow the re-enabled native quest visibility state.');
  }
  window.history.replaceState({}, '', '/maps/lab');
  window.dispatchEvent(new window.PopStateEvent('popstate'));
  window.__wtfQuestOverlay.setPinnedQuests(quests.map((quest) => quest.name));

  finalCheckbox.checked = false;
  finalCheckbox.dispatchEvent(new window.Event('change', { bubbles: true }));
  const afterUnpin = window.document.querySelectorAll('.wtf-quest-marker').length;
  const lastMessage = messages.at(-1);
  if (afterUnpin !== questCount - 1
      || lastMessage?.questName !== `Quest ${questCount - 1}`
      || lastMessage?.isSelected !== false) {
    throw new Error(`Unpin failed: after=${afterUnpin}, message=${JSON.stringify(lastMessage)}`);
  }

  console.log(`PASS: restored=${checked}, rendered=${rendered}, afterUnpin=${afterUnpin}`);
  dom.window.close();
}, 80);
