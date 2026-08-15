const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const sharp = require('../.tools/image-utils/node_modules/sharp');

const repoRoot = path.resolve(__dirname, '..');
const upstreamRoot = path.resolve(
  process.env.PEROFUNYANG_BATTLE_PASS_DIR
    || path.join(repoRoot, '.tools', 'battlepass_interactive_map')
);
const outputPath = path.join(repoRoot, 'eft-where-am-i', 'html', 'battle-pass-locations.json');

const sourceMaps = {
  customs: { target: 'customs', width: 4097, height: 2142, targetBounds: [1250, 995, 3278, 2056], targetSize: [4400, 3200] },
  factory: { target: 'factory', width: 850, height: 850, targetBounds: [1134, 1086, 2444, 2498], targetSize: [3600, 3600] },
  ground_zero: { target: 'ground-zero', width: 6920, height: 6920, targetBounds: [1134, 1072, 1739, 1983], targetSize: [2800, 3100] },
  interchange: { target: 'interchange', width: 9600, height: 5400, targetBounds: [999, 1100, 3000, 2872], targetSize: [4000, 3900] },
  icebreaker: { target: 'icebreaker', width: 7680, height: 4320, targetBounds: [2058, 2096, 2941, 6324], targetSize: [5000, 8400] },
  lab: { target: 'lab', width: 3820, height: 2189, targetBounds: [1518, 1201, 3924, 3133], targetSize: [5500, 4200] },
  labyrinth: { target: 'labyrinth', width: 4145, height: 3840, targetBounds: [1125, 1091, 2235, 2112], targetSize: [3300, 3200] },
  lighthouse: { target: 'lighthouse', width: 2242, height: 3892, targetBounds: [1000, 1000, 2099, 2699], targetSize: [3100, 3700] },
  reserve: { target: 'reserve', width: 4701, height: 2785, targetBounds: [1080, 1070, 2134, 1927], targetSize: [3200, 3000] },
  shoreline: { target: 'shoreline', width: 6668, height: 4567, targetBounds: [1053, 1031, 2605, 2076], targetSize: [3700, 3100] },
  streets_of_tarkov: { target: 'streets', width: 7620, height: 5877, targetBounds: [1000, 799, 2259, 2489], targetSize: [3260, 3500] },
  woods: { target: 'woods', width: 6994, height: 6843, targetBounds: [999, 1060, 3643, 3714], targetSize: [4800, 4800] }
};

const categoryNames = {
  financial: '재무 문서',
  project: '프로젝트 파일',
  blueprint: '설계도',
  blueprints: '설계도',
  medical: '의료 기록',
  user: '사용자 파일',
  technical: '기술 문서',
  test: '시험 기록',
  pmc: 'PMC 인사 파일'
};

function loadSourceMarkers(sourceName) {
  const sourcePath = path.join(upstreamRoot, 'data', `${sourceName}.js`);
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(sourcePath, 'utf8'), context, { filename: sourcePath });
  const markers = context.window[`MAP_DATA_${sourceName}`];
  if (!Array.isArray(markers)) throw new Error(`Missing source array MAP_DATA_${sourceName}`);
  return markers;
}

function sourceToTargetPosition(config, coords) {
  const [sourceY, sourceX] = coords.map(Number);
  const sourceTop = config.height - sourceY;
  const [left, top, right, bottom] = config.targetBounds;
  const targetX = left + (sourceX / config.width) * (right - left);
  const targetY = top + (sourceTop / config.height) * (bottom - top);
  return [
    Number(((targetX / config.targetSize[0]) * 100).toFixed(6)),
    Number(((targetY / config.targetSize[1]) * 100).toFixed(6))
  ];
}

function numericIdParts(id) {
  return String(id).split('-').slice(1).map(Number).filter(Number.isFinite);
}

function icebreakerDeck(sourceX) {
  const decks = [
    [575, 10], [1125, 9], [1650, 8], [2175, 7], [2750, 6],
    [3300, 5], [3850, 4], [4435, 3], [4985, 2], [5510, 1],
    [6060, 0], [6600, -1], [7160, -2], [Infinity, -3]
  ];
  return decks.find(([upper]) => sourceX < upper)[1];
}

function inferFloor(sourceName, marker) {
  const parts = numericIdParts(marker.id);
  const description = String(marker.detailDesc || '');

  if (sourceName === 'factory') return parts[0];
  if (sourceName === 'customs') return parts[2];

  if (sourceName === 'ground_zero') {
    const upperFloorIds = new Set([
      'medical-1-2-1-1',
      'medical-3-2-3-1', 'medical-3-2-3-2',
      'medical-3-2-4-1', 'medical-3-2-4-2',
      'user-3-2-3-1', 'user-3-2-3-2',
      'user-3-2-4-1', 'user-3-2-4-2',
      'user-3-2-5-1', 'user-3-2-5-2',
      'user-4-2-2-1'
    ]);
    return upperFloorIds.has(marker.id) ? 2 : 1;
  }

  if (sourceName === 'interchange') {
    if (marker.id.startsWith('financial-4-')) return 1;
    // The source calls these Basement/First/Second while Tarkov Market exposes
    // the same geometry as Main/Level 2/Level 3.
    return parts[0] + 1;
  }

  if (sourceName === 'icebreaker') return icebreakerDeck(Number(marker.coords[1]));

  if (sourceName === 'lab') {
    const sourceX = Number(marker.coords[1]);
    // The source image lays Technical/First/Second out as three side-by-side panels.
    return sourceX < 1300 ? 0 : sourceX < 2500 ? 1 : 2;
  }

  if (sourceName === 'reserve') {
    if (/^(?:pmc|project)-8-/.test(marker.id)) return 0;
    if (/^pmc-5-1-0-/.test(marker.id)) return 0;
    if (/^(?:pmc|project)-6-1-2-/.test(marker.id)) return 2;
    if (/^(?:pmc|project)-4-/.test(marker.id)) return parts[2];
    if (/^(?:pmc|project)-5-/.test(marker.id)) return parts[2];
    return 1;
  }

  if (sourceName === 'shoreline') {
    const room = description.match(/([2-3])\d{2}호?/);
    const explicit = description.match(/([1-3])층/);
    return room ? Number(room[1]) : explicit ? Number(explicit[1]) : 1;
  }

  if (sourceName === 'streets_of_tarkov') return parts[2];

  // Tarkov Market exposes only Main/Basement for Woods. Above-ground second
  // storeys remain part of Main instead of being an unreachable Level 2.
  if (sourceName === 'woods') return 1;

  // Lighthouse and Labyrinth have no floor selector in the target map.
  return 1;
}

function isCoordinateCertain(description) {
  return !/(?:좌표|위치).{0,8}(?:부정확|불확실)|모르겠음/i.test(String(description || ''));
}

function sourceRevision() {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: upstreamRoot,
    encoding: 'utf8'
  }).trim();
}

async function validatePhoto(marker, sourceName) {
  if (!marker.detailImg) throw new Error(`${sourceName}/${marker.id}: missing detailImg`);
  const relativePath = String(marker.detailImg).replace(/\\/g, '/').replace(/^\.\//, '');
  const localPath = path.resolve(upstreamRoot, ...relativePath.split('/'));
  const relativeCheck = path.relative(upstreamRoot, localPath);
  if (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck)) {
    throw new Error(`${sourceName}/${marker.id}: photo escapes upstream root`);
  }
  if (!fs.existsSync(localPath)) throw new Error(`${sourceName}/${marker.id}: missing photo ${relativePath}`);
  const metadata = await sharp(localPath).metadata();
  if (!metadata.width || !metadata.height || !metadata.format) {
    throw new Error(`${sourceName}/${marker.id}: undecodable photo ${relativePath}`);
  }
  return {
    relativePath,
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    url: `https://perofunyang.github.io/battlepass_interactive_map/${relativePath}`
  };
}

async function main() {
  if (!fs.existsSync(path.join(upstreamRoot, 'data'))) {
    throw new Error(`Upstream battle-pass repository not found: ${upstreamRoot}`);
  }

  const revision = sourceRevision();
  const maps = {};
  const validationRows = [];
  let sourceMarkerCount = 0;
  let excludedTransitCount = 0;
  let excludedTemporaryCount = 0;

  for (const [sourceName, config] of Object.entries(sourceMaps)) {
    const sourceMarkers = loadSourceMarkers(sourceName);
    sourceMarkerCount += sourceMarkers.length;
    maps[config.target] = [];

    for (const marker of sourceMarkers) {
      if (marker.category === 'transit') {
        excludedTransitCount += 1;
        continue;
      }
      if (marker.category === 'temporary') {
        excludedTemporaryCount += 1;
        continue;
      }
      if (!categoryNames[marker.category]) {
        throw new Error(`${sourceName}/${marker.id}: unsupported category ${marker.category}`);
      }
      if (!Array.isArray(marker.coords) || marker.coords.length !== 2) {
        throw new Error(`${sourceName}/${marker.id}: invalid source coordinates`);
      }

      const sourceY = Number(marker.coords[0]);
      const sourceX = Number(marker.coords[1]);
      if (!Number.isFinite(sourceY) || !Number.isFinite(sourceX)
        || sourceY < 0 || sourceY > config.height
        || sourceX < 0 || sourceX > config.width) {
        throw new Error(`${sourceName}/${marker.id}: source coordinates outside ${config.width}x${config.height}`);
      }

      const mapPosition = sourceToTargetPosition(config, [sourceY, sourceX]);
      if (mapPosition.some(value => !Number.isFinite(value) || value < 0 || value > 100)) {
        throw new Error(`${sourceName}/${marker.id}: generated WTFMI position is outside the map`);
      }
      const photo = await validatePhoto(marker, sourceName);
      const documentName = categoryNames[marker.category];
      const floor = inferFloor(sourceName, marker);
      const certain = isCoordinateCertain(marker.detailDesc);
      const location = {
        id: marker.id,
        category: marker.category,
        title: `${documentName} · ${marker.id}`,
        documents: documentName,
        detail: String(marker.detailDesc || '').trim(),
        sourcePosition: [sourceY, sourceX],
        sourceCanvas: [config.width, config.height],
        mapPosition,
        floor,
        elevation: 0,
        coordinateCertain: certain,
        coordinateValidation: {
          checked: true,
          exactSourceValuePreserved: true,
          insideSourceCanvas: true,
          projection: 'source-canvas-to-wtfmi-content-bounds'
        },
        photoValidation: {
          checked: true,
          sourcePathMatchesDetailImg: true,
          decoded: true,
          width: photo.width,
          height: photo.height,
          format: photo.format
        },
        photos: [{
          url: photo.url,
          caption: `${documentName} · ${marker.id}`
        }],
        photoSourceUrl: 'https://github.com/Perofunyang/battlepass_interactive_map'
      };
      maps[config.target].push(location);
      validationRows.push({
        map: config.target,
        id: marker.id,
        sourceCoordinateChecked: true,
        photoChecked: true
      });
    }
  }

  const importedMarkerCount = validationRows.length;
  const output = {
    version: 7,
    updatedAt: new Date().toISOString().slice(0, 10),
    source: {
      name: 'Perofunyang battlepass_interactive_map',
      repository: 'https://github.com/Perofunyang/battlepass_interactive_map',
      deployedSite: 'https://perofunyang.github.io/battlepass_interactive_map/',
      revision,
      license: 'CC BY-NC 4.0',
      importedWithoutUsingPreviousWtfmiBattlePassData: true
    },
    coordinatePolicy: 'The upstream Leaflet [Y, X] coordinate is preserved verbatim in sourcePosition. mapPosition is a separate WTFMI display projection and never replaces or mutates the source coordinate.',
    verification: {
      sourceMarkerCount,
      excludedTransitCount,
      excludedTemporaryCount,
      importedMarkerCount,
      coordinateChecksPassed: importedMarkerCount,
      photoChecksPassed: importedMarkerCount,
      allSourceCoordinatesPreserved: true,
      allPhotosDecoded: true,
      previousWtfmiDataRead: false
    },
    maps
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Imported ${importedMarkerCount} document markers from ${revision}.`);
  console.log(`Excluded ${excludedTransitCount} transit markers and ${excludedTemporaryCount} temporary guide markers.`);
  console.log(`Validated ${importedMarkerCount} source coordinates and ${importedMarkerCount} photos.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
