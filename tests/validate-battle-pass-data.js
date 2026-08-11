const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'eft-where-am-i', 'html', 'battle-pass-locations.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const overlayServiceFile = path.join(root, 'eft-where-am-i', 'Classes', 'BattlePassOverlayDataService.cs');
const overlayServiceSource = fs.readFileSync(overlayServiceFile, 'utf8');

const maps = {
  factory: [3600, 3600, 0, 1800, 1850, 10],
  customs: [4400, 3200, 90, 2600, 1600, 2],
  interchange: [4000, 3900, 90, 2166, 2004, 2],
  woods: [4800, 4800, 90, 2200, 2840, 2],
  shoreline: [3700, 3100, 90, 1570, 1450, 1],
  reserve: [3200, 3000, 105, 1600, 1520, 2],
  lighthouse: [3100, 3700, 90, 1550, 2050, 1],
  streets: [3260, 3500, 90, 1660, 1420, 2],
  lab: [5500, 4200, 180, 6100, 4050, 10],
  'ground-zero': [2800, 3100, 90, 1600, 1300, 2],
  labyrinth: [3300, 3200, 180, 1485, 1602, 10],
  icebreaker: [5000, 8400, 90, 2500, 4200, 25]
};

function project(map, position) {
  const [width, height, rotation, xOffset, yOffset, ratio] = maps[map];
  const radians = -rotation * Math.PI / 180;
  const gameX = position[2];
  const gameY = position[0];
  const rotatedX = gameX * Math.cos(radians) - gameY * Math.sin(radians);
  const rotatedY = gameX * Math.sin(radians) + gameY * Math.cos(radians);
  return [
    ((xOffset - rotatedX * ratio) / width) * 100,
    ((yOffset - rotatedY * ratio) / height) * 100
  ];
}

function photoPath(map, id) {
  const sourceMap = map === 'ground-zero' ? 'ground_zero' : map === 'streets' ? 'streets_of_tarkov' : map;
  if (id.startsWith('@')) return `${sourceMap}/${id.slice(1)}.webp`;
  const separator = id.indexOf('-');
  const rawCategory = id.slice(0, separator);
  const category = rawCategory === 'blueprint' ? 'blueprints' : rawCategory;
  return `${sourceMap}/${category}/${id.slice(separator + 1)}.webp`;
}

const failures = [];
let markerCount = 0;
let explicitPhotoCount = 0;
const communityRoot = process.env.COMMUNITY_MAP_DIR;
const coordinateChecks = new Map([
  ['factory/Forklift room - blue locker', [[60.08, 1.09, -48.39], 0.02]],
  ['streets/Pinewood Hotel room 208', [[-67.94217, 5.395488, 53.497696], 0.01]],
  ['streets/Pinewood Hotel Room 212 Window Table', [[-58.2, 5.4, 54.2], 0.01]],
  ['streets/Concordia 2F Computer Desk', [[230, 5.8, 390], 0.01]],
  ['reserve/White Knight 3F interior · PMC 인사 파일', [[82.2, 6.4, -30.2], 0.01]],
  ['reserve/White Knight 3F window table · 프로젝트 문서', [[84, 6.4, -31.5], 0.01]],
  ['reserve/Black Knight 3F', [[14.5, 6.4, -10.8], 0.01]],
  ['reserve/Black Pawn 3F end room', [[-166, 6.4, 35], 0.01]],
  ['woods/Village brick house upstairs', [[-520.3, 19, -338.3], 0.01]],
  ['woods/Medical camp corpse trailer', [[-191.075, -13.19, 237.38], 0.01]],
  ['woods/Medical camp uncovered corpse', [[-184.925, -13, 232.62], 0.01]],
  ['reserve/K Buildings K4 front desk', [[60, 0.5, -112], 0.01]],
  ['icebreaker/Medical Office - deck 1 · PMC 인사 파일', [[10.8114, 19.2, 41.4893], 0.01]],
  ['icebreaker/Drone room before helipad - deck 2 · 시험 문서', [[-1.5864, 20.8, -52.1048], 0.01]],
  ['icebreaker/Engine room password shelf - deck -2', [[8, 4.6, -58], 0.01]],
  ['icebreaker/Upper password room table - accommodation deck 5', [[1, 29.8, 18], 0.01]]
]);
const checkedCoordinates = new Set();
let exactNumberedRoomCount = 0;
let exactLabRoomAuditCount = 0;
const labRoomAuditStatuses = new Map();
let labSourcePinAuditCount = 0;
let labSourceTransferIssueCount = 0;
let globallyClassifiedRoomAuditCount = 0;
const globalRoomAuditStatuses = new Map();
const acceptedGlobalRoomStatuses = new Set([
  'inside-exact-room',
  'inside-named-area',
  'manual-room-audit-required',
  'map-room-missing',
  'source-room-verified-map-missing',
  'not-room-scoped'
]);
const acceptedLabRoomStatuses = new Set([
  'inside-exact-room',
  'inside-named-area',
  'manual-room-audit-required',
  'map-room-missing',
  'source-room-verified-map-missing'
]);

if (/BattlePassPhotoCatalog\.GetPhotos\(/.test(overlayServiceSource)) {
  failures.push('implicit title/floor photo fallback is enabled; marker photos must be assigned explicitly');
}
if (!/manual-room-audit-required/.test(overlayServiceSource) || !/map-room-missing/.test(overlayServiceSource)) {
  failures.push('runtime certainty does not downgrade failed exact-room audits');
}

for (const [map, markers] of Object.entries(data.maps)) {
  if (!maps[map]) {
    if (markers.length) failures.push(`${map}: no projection definition`);
    continue;
  }

  const titles = new Set();
  const assignedPhotos = new Set();
  const explicitPhotoPositions = new Map();
  for (const marker of markers) {
    markerCount += 1;
    if (!marker.title || titles.has(marker.title)) failures.push(`${map}: missing or duplicate title: ${marker.title || '<empty>'}`);
    titles.add(marker.title);
    if (!Array.isArray(marker.position) || marker.position.length < 3 || marker.position.some(value => !Number.isFinite(Number(value)))) {
      failures.push(`${map}/${marker.title}: invalid position`);
      continue;
    }
    const [left, top] = project(map, marker.position.map(Number));
    if (left < -5 || left > 105 || top < -5 || top > 105) failures.push(`${map}/${marker.title}: projected outside map (${left.toFixed(2)}, ${top.toFixed(2)})`);

    const globalRoomAudit = marker.exactRoomAudit;
    if (!globalRoomAudit || !acceptedGlobalRoomStatuses.has(globalRoomAudit.status)) {
      failures.push(`${map}/${marker.title}: missing strict global exact-room classification`);
    } else {
      globallyClassifiedRoomAuditCount += 1;
      globalRoomAuditStatuses.set(globalRoomAudit.status, (globalRoomAuditStatuses.get(globalRoomAudit.status) || 0) + 1);
    }

    const isAuditedNumberedRoom = (map === 'customs' && /(?:Dorms).*\b(?:207|212|216|304|314)\b/i.test(marker.title))
      || (map === 'shoreline' && /Resort (?:West|East) Wing \d{3}\b/i.test(marker.title));
    if (isAuditedNumberedRoom) {
      exactNumberedRoomCount += 1;
      const audit = marker.exactRoomAudit;
      if (!audit || audit.status !== 'inside-exact-room' || !Array.isArray(audit.anchorPixel)) {
        failures.push(`${map}/${marker.title}: missing strict exact-room audit`);
      } else {
        const [width, height] = maps[map];
        const pixel = [(left / 100) * width, (top / 100) * height];
        const anchorDistance = Math.hypot(pixel[0] - Number(audit.anchorPixel[0]), pixel[1] - Number(audit.anchorPixel[1]));
        if (anchorDistance > 1.1) failures.push(`${map}/${marker.title}: marker center left exact room anchor by ${anchorDistance.toFixed(2)} px`);
        const room = marker.title.match(/\b([1-5]\d{2})\b/)?.[1];
        if (audit.room !== room) failures.push(`${map}/${marker.title}: audited room ${audit.room} does not match title room ${room}`);
        if (marker.coordinateCertain !== false) failures.push(`${map}/${marker.title}: exact-room containment must not claim furniture-level coordinate certainty`);
      }
    }

    if (map === 'lab') {
      exactLabRoomAuditCount += 1;
      const audit = marker.exactRoomAudit;
      if (!audit || !acceptedLabRoomStatuses.has(audit.status)) {
        failures.push(`${map}/${marker.title}: missing explicit exact-room classification`);
      } else {
        labRoomAuditStatuses.set(audit.status, (labRoomAuditStatuses.get(audit.status) || 0) + 1);
        if (Array.isArray(audit.sourcePixel)) labSourcePinAuditCount += 1;
        if (audit.sourceTransferIssue) labSourceTransferIssueCount += 1;
        if (!audit.room || !audit.floorGroup || !audit.criterion) {
          failures.push(`${map}/${marker.title}: incomplete exact-room audit metadata`);
        }
        const isPassingRoomStatus = audit.status === 'inside-exact-room' || audit.status === 'inside-named-area';
        if (isPassingRoomStatus) {
          if (!Array.isArray(audit.anchorPixel)) {
            failures.push(`${map}/${marker.title}: passing room audit has no map-pixel anchor`);
          } else {
            const [width, height] = maps[map];
            const pixel = [(left / 100) * width, (top / 100) * height];
            const anchorDistance = Math.hypot(pixel[0] - Number(audit.anchorPixel[0]), pixel[1] - Number(audit.anchorPixel[1]));
            if (anchorDistance > 1.1) failures.push(`${map}/${marker.title}: marker center left audited room anchor by ${anchorDistance.toFixed(2)} px`);
          }
          if (marker.coordinateBasis !== 'wtfmi-exact-room-anchor') {
            failures.push(`${map}/${marker.title}: passing room audit is not bound to the WTFMI room anchor`);
          }
        } else if (marker.coordinateBasis !== 'room-audit-unresolved') {
          failures.push(`${map}/${marker.title}: unresolved room audit is incorrectly represented as a passing coordinate`);
        }
        if (marker.coordinateCertain !== false) failures.push(`${map}/${marker.title}: room-level audit must not claim furniture-level coordinate certainty`);
      }
    }

    const coordinateKey = `${map}/${marker.title}`;
    const coordinateCheck = coordinateChecks.get(coordinateKey);
    if (coordinateCheck) {
      checkedCoordinates.add(coordinateKey);
      const [expected, tolerance] = coordinateCheck;
      const maximumDelta = Math.max(...expected.map((value, index) => Math.abs(Number(marker.position[index]) - value)));
      if (maximumDelta > tolerance) failures.push(`${coordinateKey}: room/floor coordinate drifted by ${maximumDelta.toFixed(4)} m`);
    }

    const photoIds = marker.photoIds || [];
    const directPhotos = marker.photos || [];
    if (photoIds.length + directPhotos.length > 1) {
      failures.push(`${map}/${marker.title}: multiple photos merged into one marker`);
    }
    if (photoIds.length + directPhotos.length > 0) {
      const positionKey = marker.position.map(value => Number(value).toFixed(4)).join('|');
      const existingTitle = explicitPhotoPositions.get(positionKey);
      if (existingTitle) {
        failures.push(`${map}/${marker.title}: exact coordinate collision with photo-backed marker ${existingTitle}`);
      }
      explicitPhotoPositions.set(positionKey, marker.title);
    }

    for (const id of photoIds) {
      explicitPhotoCount += 1;
      if (!id.startsWith('@') && !id.includes('-')) failures.push(`${map}/${marker.title}: invalid photo ID ${id}`);
      const photoKey = `id:${id}`;
      if (assignedPhotos.has(photoKey)) failures.push(`${map}/${marker.title}: photo ID assigned to multiple markers: ${id}`);
      assignedPhotos.add(photoKey);
      if (communityRoot) {
        const localPhoto = path.join(communityRoot, 'assets', 'previews', ...photoPath(map, id).split('/'));
        if (!fs.existsSync(localPhoto)) failures.push(`${map}/${marker.title}: missing source photo ${photoPath(map, id)}`);
      }
    }
    for (const photo of directPhotos) {
      explicitPhotoCount += 1;
      if (!/^https:\/\//i.test(photo.url || '')) failures.push(`${map}/${marker.title}: direct photo must use HTTPS`);
      const photoKey = `url:${photo.url}`;
      if (assignedPhotos.has(photoKey)) failures.push(`${map}/${marker.title}: direct photo assigned to multiple markers: ${photo.url}`);
      assignedPhotos.add(photoKey);
    }
  }
}

for (const coordinateKey of coordinateChecks.keys()) {
  if (!checkedCoordinates.has(coordinateKey)) failures.push(`${coordinateKey}: required room/floor marker missing`);
}

if (exactNumberedRoomCount !== 14) failures.push(`expected 14 strict numbered-room markers, found ${exactNumberedRoomCount}`);
if (globallyClassifiedRoomAuditCount !== markerCount) failures.push(`expected every marker to have a strict room classification, found ${globallyClassifiedRoomAuditCount}/${markerCount}`);
if (exactLabRoomAuditCount !== 41) failures.push(`expected 41 explicitly classified Lab markers, found ${exactLabRoomAuditCount}`);
if (labSourcePinAuditCount !== 22) failures.push(`expected 22 Lab markers backed by coordinate-pin screenshots, found ${labSourcePinAuditCount}`);
if (labSourceTransferIssueCount !== 4) failures.push(`expected 4 corrected Lab source-to-WTFMI transfer errors, found ${labSourceTransferIssueCount}`);
const expectedLabStatusCounts = new Map([
  ['inside-exact-room', 28],
  ['inside-named-area', 3],
  ['manual-room-audit-required', 5],
  ['map-room-missing', 2],
  ['source-room-verified-map-missing', 3]
]);
for (const [status, expected] of expectedLabStatusCounts) {
  const actual = labRoomAuditStatuses.get(status) || 0;
  if (actual !== expected) failures.push(`expected ${expected} Lab markers with status ${status}, found ${actual}`);
}
const verifiedGlobalCounts = data.verification?.exactRoomAudit?.globalStatusCounts || {};
for (const status of new Set([...acceptedGlobalRoomStatuses, ...Object.keys(verifiedGlobalCounts)])) {
  const actual = globalRoomAuditStatuses.get(status) || 0;
  const expected = Number(verifiedGlobalCounts[status] || 0);
  if (actual !== expected) failures.push(`global exact-room status ${status}: verification says ${expected}, data has ${actual}`);
}
if (Number(data.verification?.exactRoomAudit?.globalMarkerCount) !== markerCount) {
  failures.push(`global exact-room verification count does not match ${markerCount}`);
}

if (markerCount !== data.verification.projectedLocationCount) {
  failures.push(`verification count ${data.verification.projectedLocationCount} does not match ${markerCount}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Validated ${markerCount} markers and ${explicitPhotoCount} explicit photo references.`);
