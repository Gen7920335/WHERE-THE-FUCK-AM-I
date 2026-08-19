const fs = require('fs');
const path = require('path');
const { JSDOM } = require('../.tools/jsdom-test/node_modules/jsdom');

const questCount = 6;
const rows = Array.from({ length: questCount }, (_, index) =>
  `<div class="no-wrap d-flex" data-quest-uid="q${index}"><span>Quest ${index}</span></div>`
).join('');
const dom = new JSDOM(
  `<body><div class="map-cont"><div class="map-wrap"></div></div><div class="items scroll">${rows}</div></body>`,
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
    this.a = 1;
    this.b = 0;
    this.c = 0;
    this.d = 1;
    this.e = 0;
    this.f = 0;
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
const markers = Array.from({ length: questCount }, (_, index) => ({
  quest: `Quest ${index}`,
  objective: `Objective ${index}`,
  left: 10 + (index * 10),
  top: 20 + (index * 5),
  elevation: 0
}));

window.__wtfQuestOverlay.configure({ map: 'lab', markers });
window.__wtfQuestOverlay.setPinnedQuests(markers.map((marker) => marker.quest));

setTimeout(() => {
  const checked = window.document.querySelectorAll('.wtf-quest-pin:checked').length;
  const rendered = window.document.querySelectorAll('.wtf-quest-marker').length;
  if (checked !== questCount || rendered !== questCount) {
    throw new Error(`Expected ${questCount} pins, got checked=${checked}, rendered=${rendered}`);
  }

  const finalCheckbox = window.document.querySelectorAll('.wtf-quest-pin')[questCount - 1];
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
