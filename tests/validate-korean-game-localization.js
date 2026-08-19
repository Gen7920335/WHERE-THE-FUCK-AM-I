const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const marketRoot = path.join(root, '.tools', 'vendor-analysis', 'tarkov-market');
const quests = JSON.parse(fs.readFileSync(path.join(marketRoot, 'quests-decoded.json'), 'utf8'));
const items = JSON.parse(fs.readFileSync(path.join(marketRoot, 'cache-kr.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'eft-where-am-i', 'translations', 'game-ko.json'), 'utf8'));
const enhancements = fs.readFileSync(path.join(root, 'eft-where-am-i', 'html', 'enhancements.js'), 'utf8');

const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const hasHangul = (value) => /[가-힣]/.test(value || '');
const failures = [];
const fail = (kind, english, korean, detail = '') => failures.push({ kind, english, korean, detail });

assert.equal(Object.keys(catalog.questNames).length, new Set(quests.map((quest) => normalize(quest.name)).filter(Boolean)).size);
for (const quest of quests) {
  const englishName = normalize(quest.name);
  const koreanName = catalog.questNames[englishName];
  if (!koreanName || !hasHangul(koreanName)) fail('quest-name', englishName, koreanName || '', 'missing Korean name');

  for (const step of quest.steps || []) {
    const english = normalize(step.text);
    if (!english) continue;
    const korean = catalog.questSteps[english];
    if (!korean || !hasHangul(korean)) {
      fail('quest-step', english, korean || '', 'missing Korean instruction');
      continue;
    }
    if (/(하기|하십시오|하세요|하시오)(?:\s*\([^)]*\))*$/.test(korean)) {
      fail('verbose-ending', english, korean, 'instruction must use a short action label');
    }
    if (/(?:합니다|하십시오|하세요|하시오)(?:[.\s]|$)/.test(korean)) {
      fail('formal-prose', english, korean, 'instruction must not use formal prose');
    }
    if (/[\u0000-\u001f\u007f]/.test(korean)) {
      fail('control-character', english, korean, 'invalid source control character');
    }
    if (/^(?:Locate|Obtain|Acquire|Hand over|Eliminate|Kill|Stash|Plant|Install|Extract|Survive|Destroy|Investigate|Complete|Deliver|Retrieve|Mark|Visit)\b/i.test(korean)) {
      fail('english-action', english, korean, 'untranslated action verb');
    }

    const sourceNumbers = english.match(/(?<![A-Za-z])\d[\d.,]*(?:x\d+)?|\d+(?:\.\d+)?x\d+(?:\.\d+)?/gi) || [];
    for (const token of sourceNumbers) {
      const compactToken = token.replace(/,/g, '');
      const compactKorean = korean.replace(/,/g, '');
      if (!compactKorean.toLowerCase().includes(compactToken.toLowerCase())) {
        fail('numeric-condition', english, korean, `missing ${token}`);
      }
    }
    if (/found in raid|\bFIR\b/i.test(english) && !/레이드/.test(korean)) {
      fail('fir-condition', english, korean, 'found-in-raid condition missing');
    }
    if (/\boptional\b/i.test(english) && !/선택/.test(korean)) {
      fail('optional-condition', english, korean, 'optional condition missing');
    }
    const locationTail = english.match(/\b(?:on|in|from|to|at|through|inside)\s+(.+)$/i)?.[1] || '';
    const primaryMaps = new Set(['Ground Zero', 'Factory', 'Nighttime Factory', 'Customs', 'Woods', 'Shoreline', 'Interchange', 'Reserve', 'The Lab', 'Lighthouse', 'Streets of Tarkov', 'The Labyrinth', 'Terminal', 'Icebreaker']);
    for (const [englishLocation, koreanLocation] of Object.entries(catalog.locations)) {
      const appears = primaryMaps.has(englishLocation)
        ? locationTail.toLowerCase().includes(englishLocation.toLowerCase())
        : english.toLowerCase().includes(englishLocation.toLowerCase());
      if (!appears) continue;
      if (!korean.includes(koreanLocation)) fail('location', english, korean, `missing ${koreanLocation}`);
    }
  }
}

const itemNameIndex = items.itemsData.fields.indexOf('name');
for (const row of items.itemsData.items) {
  const english = normalize(row[itemNameIndex]);
  if (!english) continue;
  const korean = catalog.itemNames[english];
  if (!korean || !hasHangul(korean)) fail('item-name', english, korean || '', 'missing Korean item name');
}

assert.match(enhancements, /return `\$\{korean\}\(\$\{source\}\)`;/, 'UI must render Korean(English) without an added space');
assert.match(enhancements, /getCanonicalQuestName\(row\)/, 'quest selection must retain the canonical English name');
assert.match(enhancements, /localizeNativeQuestDetailText\(\)/, 'native side-panel quest details must be localized');
assert.match(enhancements, /normalizedQuestTranslations/, 'rendered objective variants must use normalized lookup');

if (failures.length) {
  console.error(JSON.stringify({ failureCount: failures.length, failures: failures.slice(0, 100) }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  questRecords: quests.length,
  questNames: Object.keys(catalog.questNames).length,
  questStepOccurrences: quests.reduce((count, quest) => count + (quest.steps || []).filter((step) => normalize(step.text)).length, 0),
  questStepStrings: Object.keys(catalog.questSteps).length,
  itemRecords: items.itemsData.items.length,
  itemNames: Object.keys(catalog.itemNames).length,
  locations: Object.keys(catalog.locations).length,
  failures: 0
}, null, 2));
