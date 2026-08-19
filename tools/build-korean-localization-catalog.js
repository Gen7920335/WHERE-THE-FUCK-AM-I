const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const analysisRoot = path.join(root, '.tools', 'vendor-analysis', 'tarkov-market');
const questPath = path.join(analysisRoot, 'quests-decoded.json');
const itemPath = path.join(analysisRoot, 'cache-kr.json');
const outputPath = path.join(root, 'eft-where-am-i', 'translations', 'game-ko.json');

if (!fs.existsSync(questPath) || !fs.existsSync(itemPath)) {
  throw new Error('Run the Tarkov Market locale analysis first; decoded quest and item caches are required.');
}

const quests = JSON.parse(fs.readFileSync(questPath, 'utf8'));
const cache = JSON.parse(fs.readFileSync(itemPath, 'utf8'));

const locationNames = {
  'Ground Zero': '그라운드 제로',
  'Factory': '공장',
  'Nighttime Factory': '야간 공장',
  'Customs': '세관',
  'Woods': '삼림',
  'Shoreline': '해안선',
  'Interchange': '인터체인지',
  'Reserve': '리저브',
  'The Lab': '연구소',
  'Lighthouse': '등대',
  'Streets of Tarkov': '타르코프 시내',
  'The Labyrinth': '미궁',
  'Terminal': '터미널',
  'Icebreaker': '쇄빙선',
  'Health Resort': '헬스 리조트',
  'East Wing': '동관',
  'West Wing': '서관',
  'Dorms': '기숙사',
  'three-story dorm': '3층 기숙사',
  'two-story dorm': '2층 기숙사',
  'TerraGroup complex': 'TerraGroup 단지',
  'TerraGroup office': 'TerraGroup 사무소',
  'weather station': '기상 관측소',
  'hydroelectric power station': '수력 발전소',
  'power station': '발전소',
  'underground tunnel': '지하 터널',
  'Mira Ave': '미라 대로',
  'Nakatani Basement Stairs': '나카타니 지하 계단',
  'Emercom Checkpoint': 'EMERCOM 검문소',
  'Emercom station': 'EMERCOM 구호소'
};

const questNameOverrides = {
  'First in Line': '가장 먼저',
  'Background Check': '신원 조사',
  'Audit': '회계 감사',
  'Acquaintance': '첫 만남',
  'Introduction': '소개장',
  'Setup': '위장 작전',
  'Population Census': '인구 조사',
  'The Door': '수상한 문',
  'Checking': '확인 작업',
  'Debut': '첫 무대',
  'Shortage': '물자 부족',
  '[KORD BREACH] For Humanity, for the Chosen': '[KORD BREACH] 인류를 위하여, 선택받은 자들을 위하여',
  '[KORD BREACH] Historical Perspectives': '[KORD BREACH] 역사의 관점'
};

const itemOverrides = {
  'Secure Flash drive': '보안 USB 플래시 드라이브',
  'Intelligence folder': '정보 문서 파일',
  'Gas analyzer': '가스 분석기',
  'Metal fuel tank': '금속 연료통',
  'Expeditionary fuel tank': '휴대용 연료통',
  'Bottle of water (0.6L)': '물병(0.6L)',
  'Topographic survey maps': '지형 측량 지도',
  'TerraGroup Blue Folders materials': 'TerraGroup 파란색 문서철',
  'Documents with intelligence': '기밀 정보 문서',
  'MS2000 Marker': 'MS2000 마커',
  'WI-FI Camera': 'Wi-Fi 카메라',
  'Toolset': '공구 세트',
  'Medical bloodset': '채혈 세트',
  'Salewa first aid kit': 'Salewa 응급 처치 키트'
};

const missingStepOverrides = {
  'Locate and obtain the case with military equipment': '[군용 장비 상자] 획득',
  'Investigate the shack next to the sordi tower on Shoreline': '해안선 SORDI 타워 옆 판잣집 조사',
  'Investigate the second floor of the weather station building on Shoreline': '해안선 기상 관측소 건물 2층 조사',
  'Investigate the hydroelectric power station on Shoreline': '해안선 수력 발전소 조사',
  'Obtain and hand over the case with military equipment': '[군용 장비 상자] 획득 후 전달',
  "Stash Therapist's letter at the reception desk on the second floor of the TerraGroup office on Ground Zero (in one raid)": '그라운드 제로 TerraGroup 사무소 2층 접수대에 테라피스트의 편지 은닉(한 번의 레이드에서)',
  'Extract from the location through the Nakatani Basement Stairs or Emercom Checkpoint exfil (in one raid)': '나카타니 지하 계단 또는 EMERCOM 검문소로 탈출(한 번의 레이드에서)',
  'Plant a WI-FI Camera in the Ural truck near the hydroelectric power station on Shoreline': '해안선 수력 발전소 인근 Ural 트럭에 WI-FI 카메라 설치',
  "Plant a WI-FI Camera in the excavator at the stream near the smugglers' base on Shoreline": '해안선 밀수꾼 기지 인근 개울가 굴착기에 WI-FI 카메라 설치',
  'Plant a WI-FI Camera on the concrete mixer truck at the collapsed crane on Streets of Tarkov': '타르코프 시내 무너진 크레인의 콘크리트 믹서 트럭에 WI-FI 카메라 설치',
  'Plant a WI-FI Camera on the bio toilet near the Rodina cinema on Streets of Tarkov': '타르코프 시내 Rodina 영화관 인근 간이 화장실에 WI-FI 카메라 설치',
  'Plant a WI-FI Camera in the cargo truck cabin near Mira Ave on Ground Zero': '그라운드 제로 미라 대로 인근 화물 트럭 운전석에 WI-FI 카메라 설치',
  'Plant a WI-FI Camera inside the yellow bus in the underground tunnel on Ground Zero': '그라운드 제로 지하 터널의 노란 버스 안에 WI-FI 카메라 설치',
  'Hand over any Black Division plate carriers (x5)': 'Black Division 플레이트 캐리어 아무거나 전달 (x5)',
  'Locate and obtain the Wi-Fi Camera from the Ural truck near the hydroelectric power station on Shoreline': '해안선 수력 발전소 인근 Ural 트럭에서 Wi-Fi 카메라 회수',
  "Locate and obtain the Wi-Fi Camera from the excavator at the stream near the smugglers' base on Shoreline": '해안선 밀수꾼 기지 인근 개울가 굴착기에서 Wi-Fi 카메라 회수',
  'Locate and obtain the Wi-Fi Camera from the concrete mixer truck at the collapsed crane on Streets of Tarkov': '타르코프 시내 무너진 크레인의 콘크리트 믹서 트럭에서 Wi-Fi 카메라 회수',
  'Locate and obtain the Wi-Fi Camera from the bio toilet near the Rodina cinema on Streets of Tarkov': '타르코프 시내 Rodina 영화관 인근 간이 화장실에서 Wi-Fi 카메라 회수',
  'Locate and obtain the Wi-Fi Camera from the cargo truck cabin near Mira Ave on Ground Zero': '그라운드 제로 미라 대로 인근 화물 트럭 운전석에서 Wi-Fi 카메라 회수',
  'Locate and obtain the Wi-Fi Camera from yellow bus in the underground tunnel on Ground Zero': '그라운드 제로 지하 터널의 노란 버스에서 Wi-Fi 카메라 회수',
  'Hand over the camera': '카메라 전달',
  'Locate and obtain the Black Division encryption keys': 'Black Division 암호화 키 획득',
  'Hand over the found item': '획득한 아이템 전달',
  'Locate and obtain the Briefcase with documents': '문서 가방 획득',
  'Locate and obtain the 14-4 KORD SSD': '14-4 KORD SSD 획득',
  'Hand over the found intel': '획득한 정보 전달',
  'Eliminate Black Division operatives while wearing a Black Division plate carrier on Shoreline (x6)': '해안선에서 Black Division 플레이트 캐리어 착용 후 Black Division 대원 처치 (x6)',
  'Eliminate Black Division operatives while wearing a Black Division plate carrier on Streets of Tarkov (x6)': '타르코프 시내에서 Black Division 플레이트 캐리어 착용 후 Black Division 대원 처치 (x6)',
  'Eliminate Black Division operatives while wearing a Black Division plate carrier on Ground Zero (x6)': '그라운드 제로에서 Black Division 플레이트 캐리어 착용 후 Black Division 대원 처치 (x6)',
  "Locate and obtain the laptop from Fence's stash on Streets of Tarkov": '타르코프 시내 펜스의 은닉처에서 노트북 획득',
  'Decrypt the data from the secret facility laptop': '비밀 시설 노트북의 데이터 복호화',
  "Read the data recovered from Fence's laptop": '펜스의 노트북에서 복구한 데이터 확인',
  'Hand over the laptop': '노트북 전달',
  'Eliminate Black Division operatives in The Lab (x15)': '연구소에서 Black Division 대원 처치 (x15)',
  'Plant a TP-200 TNT brick at the Health Resort west side fence breach on Shoreline': '해안선 헬스 리조트 서쪽 담장 파손부에 TP-200 TNT 블록 설치',
  'Plant a TP-200 TNT brick at the Health Resort north side fence breach on Shoreline': '해안선 헬스 리조트 북쪽 담장 파손부에 TP-200 TNT 블록 설치',
  'Plant a TP-200 TNT brick at the Health Resort east side fence breach on Shoreline': '해안선 헬스 리조트 동쪽 담장 파손부에 TP-200 TNT 블록 설치',
  'Destroy the transmitter on the factory chimney near the unfinished construction site on Customs': '세관 미완공 건설 현장 인근 공장 굴뚝의 송신기 파괴',
  'Destroy the transmitter on the power line tower on Customs': '세관 송전탑의 송신기 파괴',
  'Destroy the transmitter on top of the mountain on Woods': '삼림 산 정상의 송신기 파괴',
  'Destroy the transmitter on the cell tower on Woods': '삼림 이동통신탑의 송신기 파괴',
  'Hand over the data from the Black Division rugged laptop': 'Black Division 러기드 노트북의 데이터 전달',
  'Hand over the found in raid BEAR PMC dogtags (x5)': '레이드에서 발견한 BEAR PMC 인식표 전달 (x5)',
  'Hand over the found in raid USEC PMC dogtags (x5)': '레이드에서 발견한 USEC PMC 인식표 전달 (x5)',
  'Hand over the found in raid Colt M4A1 assault rifles (x2)': '레이드에서 발견한 Colt M4A1 돌격소총 전달 (x2)',
  'Hand over the found in raid Bottle of Dan Jackiel whiskey': '레이드에서 발견한 Dan Jackiel 위스키 전달',
  'Hand over the found in raid Can of TarCola soda (x3)': '레이드에서 발견한 TarCola 음료 전달 (x3)',
  'Eliminate PMC operatives while using any AK-series assault rifle (x7)': 'AK 계열 돌격소총으로 PMC 처치 (x7)',
  "Find Killa's Maska-1SCh bulletproof helmet in raid": '레이드에서 [킬라의 Maska-1SCh 방탄 헬멧] 획득'
};

const normalizeSpace = (value) => String(value || '')
  .replace(/[\u0000-\u001f\u007f]/g, '')
  .replace(/\s+/g, ' ')
  .trim();
const hasHangul = (value) => /[가-힣]/.test(value || '');
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function removeEnglishDuplicate(english, korean) {
  let value = normalizeSpace(korean);
  if (!value) return '';
  value = value.replace(new RegExp(escapeRegExp(english), 'ig'), '').trim();
  value = value.replace(/^[-–—:·/\s]+|[-–—:·/\s]+$/g, '').trim();
  return value;
}

function translateGenericItemName(english) {
  const rules = [
    [/^(.+?) access keycard$/i, '$1 출입 키카드'],
    [/^(.+?) keycard \((.+)\)$/i, '$1 키카드($2)'],
    [/^(.+?) keycard$/i, '$1 키카드'],
    [/^(.+?) room (\d+) key$/i, '$1 $2호실 열쇠'],
    [/^(.+?) key$/i, '$1 열쇠'],
    [/^(.+?) ammo pack \((\d+) pcs\)$/i, '$1 탄약 상자($2발)'],
    [/^(.+?) (\d+)-round magazine$/i, '$1 $2발 탄창'],
    [/^(.+?) magazine$/i, '$1 탄창'],
    [/^(.+?) thermal scope$/i, '$1 열화상 조준경'],
    [/^(.+?) scope$/i, '$1 조준경'],
    [/^(.+?) reflex sight$/i, '$1 반사식 조준경'],
    [/^(.+?) suppressor$/i, '$1 소음기'],
    [/^(.+?) muzzle brake$/i, '$1 제퇴기'],
    [/^(.+?) assault rifle$/i, '$1 돌격소총'],
    [/^(.+?) sniper rifle$/i, '$1 저격소총'],
    [/^(.+?) marksman rifle$/i, '$1 지정사수소총'],
    [/^(.+?) submachine gun$/i, '$1 기관단총'],
    [/^(.+?) machine gun$/i, '$1 기관총'],
    [/^(.+?) pistol$/i, '$1 권총'],
    [/^(.+?) shotgun$/i, '$1 산탄총'],
    [/^(.+?) body armor$/i, '$1 방탄복'],
    [/^(.+?) plate carrier$/i, '$1 플레이트 캐리어'],
    [/^(.+?) tactical rig$/i, '$1 전술 조끼'],
    [/^(.+?) backpack$/i, '$1 배낭'],
    [/^(.+?) helmet$/i, '$1 헬멧'],
    [/^(.+?) headset$/i, '$1 헤드셋'],
    [/^(.+?) glasses$/i, '$1 안경'],
    [/^(.+?) gas mask$/i, '$1 방독면'],
    [/^(.+?) first aid kit$/i, '$1 응급 처치 키트'],
    [/^(.+?) documents$/i, '$1 문서'],
    [/^(.+?) document$/i, '$1 문서'],
    [/^(.+?) folder$/i, '$1 문서철'],
    [/^(.+?) map$/i, '$1 지도']
  ];
  for (const [pattern, replacement] of rules) {
    if (pattern.test(english)) return english.replace(pattern, replacement);
  }
  return english;
}

const itemCategoryNames = [
  ['Ammo', '탄약'], ['Ammo_boxes', '탄약 상자'], ['Keys', '열쇠'], ['Quest_items', '퀘스트 아이템'],
  ['Assault_rifles', '돌격소총'], ['Assault_carbines', '돌격 카빈'], ['Bolt_action_rifles', '볼트액션 소총'],
  ['Marksman_rifles', '지정사수소총'], ['Sniper_rifles', '저격소총'], ['Machine_guns', '기관총'],
  ['Submachine_guns', '기관단총'], ['Pistols', '권총'], ['Shotguns', '산탄총'], ['Grenade_Launchers', '유탄발사기'],
  ['Magazines', '탄창'], ['Barrels', '총열'], ['Handguards', '핸드가드'], ['Stocks_chassis', '개머리판'],
  ['Pistol_grips', '권총손잡이'], ['Receivers_slides', '리시버'], ['Charging_handles', '장전손잡이'],
  ['Iron_sights', '기계식 조준기'], ['Sights', '조준기'], ['Optics', '광학 조준기'], ['Assault_scopes', '망원 조준경'],
  ['Suppressors', '소음기'], ['Muzzle_adapters', '총구 어댑터'], ['Flashhiders_brakes', '소염기'],
  ['Gas_blocks', '가스 블록'], ['Foregrips', '전방 손잡이'], ['Mounts', '마운트'], ['Bipods', '양각대'],
  ['Tactical_devices', '전술 장치'], ['Armor_vests', '방탄복'], ['Armor_plate', '방탄판'],
  ['Tactical_rigs', '전술 조끼'], ['Backpacks', '배낭'], ['Helmets', '헬멧'], ['Headsets', '헤드셋'],
  ['Face_shields', '안면 보호대'], ['Facecovers', '안면 장비'], ['Eyewear', '보안경'], ['Armband', '완장'],
  ['Melee_weapons', '근접무기'], ['Meds', '의약품'], ['Food', '식품'], ['Provisions', '식량'],
  ['Special_equipment', '특수 장비'], ['Containers', '보관함'], ['Secure_containers', '보안 컨테이너'], ['Crates', '보급 상자'],
  ['Cosmetics', '외형 아이템'], ['Gear', '장비'], ['Weapon_parts', '총기 부품'], ['Weapon', '무기'], ['Barter', '교환용품']
];

function naturalizeItemName(english, rawKorean, tags = []) {
  if (itemOverrides[english]) return itemOverrides[english];
  const withoutDuplicate = removeEnglishDuplicate(english, rawKorean);
  let korean = hasHangul(withoutDuplicate) ? withoutDuplicate : normalizeSpace(rawKorean);
  if (!hasHangul(korean)) korean = translateGenericItemName(english);
  korean = normalizeSpace(korean)
    .replace(/응급 치료 키트/g, '응급 처치 키트')
    .replace(/USB 보안/g, '보안 USB')
    .replace(/\((Blue|Red|Green|Black|Yellow|Violet|White)\)$/i, (_, color) => `(${({
      blue: '파란색', red: '빨간색', green: '초록색', black: '검은색', yellow: '노란색', violet: '보라색', white: '흰색'
    })[color.toLowerCase()]})`);
  if (!hasHangul(korean)) {
    const category = itemCategoryNames.find(([tag]) => tags.includes(tag));
    if (category) korean = `${english} ${category[1]}`;
  }
  return korean;
}

const itemFieldIndex = Object.fromEntries(cache.itemsData.fields.map((field, index) => [field, index]));
const itemLocaleIndex = Object.fromEntries(cache.itemsL10nData.fields.map((field, index) => [field, index]));
const itemNames = {};
const itemKoreanAliases = {};
const itemByUid = new Map();
for (let index = 0; index < cache.itemsData.items.length; index += 1) {
  const source = cache.itemsData.items[index];
  const localized = cache.itemsL10nData.items[index];
  const english = normalizeSpace(source[itemFieldIndex.name]);
  if (!english) continue;
  const rawKorean = normalizeSpace(localized[itemLocaleIndex.krName]);
  itemNames[english] = naturalizeItemName(english, rawKorean, source[itemFieldIndex.tags] || []);
  itemKoreanAliases[english] = [...new Set([rawKorean, removeEnglishDuplicate(english, rawKorean), itemNames[english]])]
    .filter((value) => value && hasHangul(value));
  itemByUid.set(source[itemFieldIndex.uid], { english, korean: itemNames[english] });
}

const itemPairs = Object.entries(itemNames)
  .filter(([english]) => english.length >= 4)
  .sort((left, right) => right[0].length - left[0].length);

function formatBilingual(korean, english) {
  const ko = normalizeSpace(korean);
  const en = normalizeSpace(english);
  if (!ko || ko.toLocaleLowerCase() === en.toLocaleLowerCase()) return en;
  return `${ko}(${en})`;
}

function translateLocationsInText(value) {
  let output = normalizeSpace(value);
  const pairs = Object.entries(locationNames).sort((left, right) => right[0].length - left[0].length);
  for (const [english, korean] of pairs) {
    output = output.replace(new RegExp(`${escapeRegExp(korean)}\\s*\\(${escapeRegExp(english)}\\)`, 'gi'), korean);
    if (output.trim().toLocaleLowerCase() === english.toLocaleLowerCase()) output = korean;
  }
  return output;
}

const primaryMapNames = new Set([
  'Ground Zero', 'Factory', 'Nighttime Factory', 'Customs', 'Woods', 'Shoreline', 'Interchange',
  'Reserve', 'The Lab', 'Lighthouse', 'Streets of Tarkov', 'The Labyrinth', 'Terminal', 'Icebreaker'
]);

function restoreMissingLocations(english, korean) {
  const source = normalizeSpace(english);
  const lowerSource = source.toLocaleLowerCase();
  const locationTail = source.match(/\b(?:on|in|from|to|at|through|inside)\s+(.+)$/i)?.[1] || '';
  const missingMaps = [];
  const missingPlaces = [];
  for (const [englishLocation, koreanLocation] of Object.entries(locationNames)
    .sort((left, right) => right[0].length - left[0].length)) {
    const lowerLocation = englishLocation.toLocaleLowerCase();
    const appears = primaryMapNames.has(englishLocation)
      ? locationTail.toLocaleLowerCase().includes(lowerLocation)
      : lowerSource.includes(lowerLocation);
    if (!appears || korean.includes(koreanLocation)) continue;
    (primaryMapNames.has(englishLocation) ? missingMaps : missingPlaces).push(koreanLocation);
  }
  let output = korean;
  if (missingMaps.length) output += ` · 지역: ${[...new Set(missingMaps)].join('/')}`;
  if (missingPlaces.length) output += ` · 위치: ${[...new Set(missingPlaces)].join('/')}`;
  return output;
}

function translateMissingStep(english) {
  let source = translateLocationsInText(english).replace(/^\(Optional\)\s*/i, '');
  const optional = /^\(Optional\)\s*/i.test(english);
  const finish = (text) => `${text}${optional ? ' (선택)' : ''}`;
  let match;

  const overrideKey = normalizeSpace(english).replace(/^\(Optional\)\s*/i, '');
  if (missingStepOverrides[overrideKey]) return finish(missingStepOverrides[overrideKey]);

  if ((match = source.match(/^Locate and obtain (.+)$/i))) return finish(`${match[1]} 획득`);
  if ((match = source.match(/^Obtain and hand over (.+)$/i))) return finish(`${match[1]} 획득 후 전달`);
  if ((match = source.match(/^Investigate (.+)$/i))) return finish(`${match[1]} 조사`);
  if ((match = source.match(/^Stash (.+?) at (.+)$/i))) return finish(`${match[2]}에 ${match[1]} 은닉`);
  if ((match = source.match(/^Plant (.+?) (?:at|in|on) (.+)$/i))) return finish(`${match[2]}에 ${match[1]} 설치`);
  if ((match = source.match(/^Extract from the location through (.+?) or (.+?)(?: \(in one raid\))?$/i))) {
    return finish(`${match[1]} 또는 ${match[2]} 탈출구로 탈출(한 번의 레이드에서)`);
  }
  if ((match = source.match(/^Hand over the found in raid item:\s*(.+)$/i))) return finish(`레이드에서 발견한 ${match[1]} 전달`);
  if ((match = source.match(/^Hand over any (.+)$/i))) return finish(`${match[1]} 아무거나 전달`);
  if ((match = source.match(/^Hand over (.+)$/i))) return finish(`${match[1]} 전달`);
  if ((match = source.match(/^Eliminate (.+)$/i))) return finish(`${match[1]} 처치`);
  if ((match = source.match(/^Destroy (.+)$/i))) return finish(`${match[1]} 파괴`);
  if ((match = source.match(/^Decrypt (.+)$/i))) return finish(`${match[1]} 복호화`);
  if ((match = source.match(/^Read (.+)$/i))) return finish(`${match[1]} 읽기`);
  if ((match = source.match(/^Scav karma of (.+)$/i))) return finish(`스캐브 우호도 ${match[1]} 달성`);
  return finish(source);
}

function bilingualizeItems(englishSource, koreanText) {
  let output = koreanText;
  for (const [english, korean] of itemPairs) {
    if (!englishSource.toLocaleLowerCase().includes(english.toLocaleLowerCase())) continue;
    const bilingual = formatBilingual(korean, english);
    if (bilingual === english) continue;
    const aliases = itemKoreanAliases[english] || [korean];
    let replaced = false;
    for (const alias of aliases.sort((left, right) => right.length - left.length)) {
      const koreanPattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(alias)}(?![\\p{L}\\p{N}]|\\s*\\(${escapeRegExp(english)}\\))`, 'gu');
      if (!hasHangul(alias) || !koreanPattern.test(output)) continue;
      output = output.replace(koreanPattern, bilingual);
      replaced = true;
      break;
    }
    if (replaced) continue;
    output = output.replace(new RegExp(escapeRegExp(english), 'gi'), bilingual);
  }
  return output;
}

function bilingualizeExplicitStepItems(step, koreanText) {
  let output = koreanText;
  const referencedItems = [...new Map((step.items || [])
    .map((entry) => itemByUid.get(entry.item))
    .filter(Boolean)
    .map((item) => [item.english, item])).values()];
  const bracketMatches = [...output.matchAll(/\[([^\]]+)\]/g)];
  if (referencedItems.length && referencedItems.length === bracketMatches.length) {
    let matchIndex = 0;
    output = output.replace(/\[([^\]]+)\]/g, () => {
      const item = referencedItems[matchIndex++];
      return `[${formatBilingual(item.korean, item.english)}]`;
    });
  }
  return output;
}

function shortenQuestInstruction(english, korean, step = {}) {
  let output = normalizeSpace(korean);
  const suffix = output.match(/(\s*(?:\([^)]*\)\s*)+)$/)?.[1] || '';
  if (suffix) output = output.slice(0, -suffix.length).trim();

  output = output
    .replace(/살아서 탈출(?:하기)?$/g, '생존 후 탈출')
    .replace(/생존하여 탈출(?:하기)?$/g, '생존 후 탈출')
    .replace(/건네주기$/g, '전달')
    .replace(/전달하기$/g, '전달')
    .replace(/획득하기$/g, '획득')
    .replace(/확보하기$/g, '확보')
    .replace(/사살하기$/g, '처치')
    .replace(/처치하기$/g, '처치')
    .replace(/방문하기$/g, '이동')
    .replace(/지역이동하기$/g, '지역 이동')
    .replace(/위치 확인하기$/g, '이동')
    .replace(/찾아가기$/g, '이동')
    .replace(/설치하기$/g, '설치')
    .replace(/표식하기$/g, '표시')
    .replace(/숨겨두기$/g, '은닉')
    .replace(/개조하기$/g, '개조')
    .replace(/완수하기$/g, '완료')
    .replace(/완료하기$/g, '완료')
    .replace(/정찰하기$/g, '정찰')
    .replace(/조사하기$/g, '조사')
    .replace(/파괴하기$/g, '파괴')
    .replace(/복호화하기$/g, '복호화')
    .replace(/회수하기$/g, '회수')
    .replace(/사용하기$/g, '사용')
    .replace(/작동시키기$/g, '작동')
    .replace(/교신하기$/g, '교신')
    .replace(/청취하기$/g, '청취')
    .replace(/잠금 해제하기$/g, '잠금 해제')
    .replace(/달성하기$/g, '달성')
    .replace(/확인하기$/g, '확인')
    .replace(/읽어보기$/g, '읽기')
    .replace(/하기$/g, '')
    .replace(/획득하기(?=\s*[:.(·—]|$)/g, '획득')
    .replace(/설치하기(?=\s*[:.(·—]|$)/g, '설치')
    .replace(/건네주기(?=\s*[:.(·—]|$)/g, '전달')
    .replace(/탈출하기(?=\s*[:.(·—]|$)/g, '탈출')
    .replace(/감시하기(?=\s*[:.(·—]|$)/g, '감시')
    .replace(/완수하기(?=\s*[:.(·—]|$)/g, '완료')
    .replace(/필요합니다/g, '필요')
    .replace(/획득합니다/g, '획득')
    .replace(/열립니다/g, '개방');

  if ((step.items || []).length || /\b(?:item|document|key|weapon|armor|helmet|case|package)\b/i.test(english)) {
    output = output.replace(/찾기(?=\s*[:.(·—]|$)/g, '획득');
  } else if (/\b(?:Locate|Visit|Discover|Scout|Find .*(?:camp|location|place|spot|area|room|building|transit))\b/i.test(english)) {
    output = output.replace(/찾기(?=\s*[:.(·—]|$)/g, '이동');
  }

  if (/^(Locate|Visit|Discover|Find (?:the )?.*(?:camp|location|place|spot|area|room|building)|Reach)\b/i.test(english)) {
    output = output
      .replace(/(?:위치 )?찾기$/g, '이동')
      .replace(/발견$/g, '이동');
  }
  return `${output}${suffix}`
    .replace(/미궁\s*\(The Labyrinth\)/gi, '미궁')
    .replace(/지역이동/g, '지역 이동')
    .replace(/지역 이동하기/g, '지역 이동')
    .replace(/\[MRE 전투식량\(MRE ration pack\)\]\s*구(?=\s|$)/g, '[MRE 전투식량(MRE ration pack)] 획득');
}

function naturalizeQuestText(step) {
  const english = normalizeSpace(step.text);
  const rawKorean = step.text_l10n?.kr;
  const optional = /^\(Optional\)\s*/i.test(english);
  const overrideKey = english.replace(/^\(Optional\)\s*/i, '');
  const override = missingStepOverrides[overrideKey];
  let korean = override
    ? `${override}${optional ? ' (선택)' : ''}`
    : normalizeSpace(rawKorean) || translateMissingStep(english);
  korean = translateLocationsInText(korean)
    .replace(/EMERCOM station/gi, 'EMERCOM 구호소')
    .replace(/\btask\b/gi, '퀘스트')
    .replace(/태스크/g, '퀘스트')
    .replace(/검안경/g, '검안기')
    .replace(/\s+([,.)])/g, '$1');
  korean = bilingualizeItems(english, korean);
  korean = bilingualizeExplicitStepItems(step, korean);
  if (/found in raid|\bFIR\b/i.test(english) && !/레이드/.test(korean)) {
    korean = `레이드에서 발견한 ${korean}`;
  }
  return restoreMissingLocations(english, shortenQuestInstruction(english, korean, step));
}

const questNames = {};
const questSteps = {};
const questKoreanAliases = {};
for (const quest of quests) {
  const englishName = normalizeSpace(quest.name);
  if (englishName) {
    const rawKoreanName = normalizeSpace(quest.name_l10n?.kr);
    const koreanName = questNameOverrides[englishName]
      || rawKoreanName
      || englishName;
    questNames[englishName] = translateLocationsInText(koreanName);
    questKoreanAliases[englishName] = [...new Set([rawKoreanName, questNames[englishName]])]
      .filter((value) => value && hasHangul(value));
  }
}

function bilingualizeQuestReferences(englishSource, koreanText) {
  let output = koreanText;
  for (const [english, korean] of Object.entries(questNames).sort((left, right) => right[0].length - left[0].length)) {
    if (!englishSource.toLocaleLowerCase().includes(english.toLocaleLowerCase())) continue;
    const bilingual = formatBilingual(korean, english);
    for (const alias of questKoreanAliases[english] || [korean]) {
      if (!output.includes(alias) || output.includes(bilingual)) continue;
      output = output.replace(alias, bilingual);
      break;
    }
  }
  return output;
}

for (const quest of quests) {
  for (const step of quest.steps || []) {
    const english = normalizeSpace(step.text);
    if (!english) continue;
    questSteps[english] = bilingualizeQuestReferences(english, naturalizeQuestText(step));
  }
}

const catalog = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sources: {
    questCount: quests.length,
    itemCount: Object.keys(itemNames).length
  },
  locations: locationNames,
  questNames,
  itemNames,
  questSteps
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

const missingQuestNames = Object.entries(questNames).filter(([, korean]) => !hasHangul(korean));
const untranslatedSteps = Object.entries(questSteps).filter(([, korean]) => !hasHangul(korean));
const sourceStepCount = quests.reduce((count, quest) => count + (quest.steps || []).filter((step) => normalizeSpace(step.text)).length, 0);
const missingSourceSteps = quests.flatMap((quest) => (quest.steps || [])
  .map((step) => normalizeSpace(step.text))
  .filter((english) => english && !questSteps[english]));
const translatedItems = Object.values(itemNames).filter(hasHangul).length;
console.log(JSON.stringify({
  outputPath,
  questNames: Object.keys(questNames).length,
  missingQuestNames: missingQuestNames.length,
  questSteps: Object.keys(questSteps).length,
  sourceStepCount,
  missingSourceSteps: missingSourceSteps.length,
  untranslatedSteps: untranslatedSteps.length,
  items: Object.keys(itemNames).length,
  itemsWithKorean: translatedItems
}, null, 2));
