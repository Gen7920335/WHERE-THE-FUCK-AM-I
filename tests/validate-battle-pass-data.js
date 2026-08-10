const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'eft-where-am-i', 'html', 'battle-pass-locations.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

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

for (const [map, markers] of Object.entries(data.maps)) {
  if (!maps[map]) {
    if (markers.length) failures.push(`${map}: no projection definition`);
    continue;
  }

  const titles = new Set();
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

    for (const id of marker.photoIds || []) {
      explicitPhotoCount += 1;
      if (!id.startsWith('@') && !id.includes('-')) failures.push(`${map}/${marker.title}: invalid photo ID ${id}`);
      if (communityRoot) {
        const localPhoto = path.join(communityRoot, 'assets', 'previews', ...photoPath(map, id).split('/'));
        if (!fs.existsSync(localPhoto)) failures.push(`${map}/${marker.title}: missing source photo ${photoPath(map, id)}`);
      }
    }
    for (const photo of marker.photos || []) {
      explicitPhotoCount += 1;
      if (!/^https:\/\//i.test(photo.url || '')) failures.push(`${map}/${marker.title}: direct photo must use HTTPS`);
    }
  }
}

if (markerCount !== data.verification.projectedLocationCount) {
  failures.push(`verification count ${data.verification.projectedLocationCount} does not match ${markerCount}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Validated ${markerCount} markers and ${explicitPhotoCount} explicit photo references.`);
