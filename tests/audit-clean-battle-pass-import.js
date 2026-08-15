const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sharp = require('../.tools/image-utils/node_modules/sharp');

const root = path.resolve(__dirname, '..');
const upstreamRoot = path.resolve(
  process.env.PEROFUNYANG_BATTLE_PASS_DIR
    || path.join(root, '.tools', 'battlepass_interactive_map')
);
const outputPath = path.join(root, 'artifacts', 'battle-pass-clean-import-audit.json');
const data = JSON.parse(fs.readFileSync(
  path.join(root, 'eft-where-am-i', 'html', 'battle-pass-locations.json'),
  'utf8'
));

const sourceNames = {
  customs: 'customs',
  factory: 'factory',
  'ground-zero': 'ground_zero',
  interchange: 'interchange',
  icebreaker: 'icebreaker',
  lab: 'lab',
  labyrinth: 'labyrinth',
  lighthouse: 'lighthouse',
  reserve: 'reserve',
  shoreline: 'shoreline',
  streets: 'streets_of_tarkov',
  woods: 'woods'
};

const mapsWithoutFloorControls = new Set(['labyrinth', 'lighthouse']);
const multiPanelSourceMaps = new Set([
  'customs',
  'factory',
  'ground-zero',
  'interchange',
  'icebreaker',
  'lab',
  'reserve',
  'shoreline',
  'streets'
]);

function readSource(map) {
  const sourceName = sourceNames[map];
  const sourcePath = path.join(upstreamRoot, 'data', `${sourceName}.js`);
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(sourcePath, 'utf8'), context, { filename: sourcePath });
  return context.window[`MAP_DATA_${sourceName}`]
    .filter(marker => !['transit', 'temporary'].includes(marker.category));
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

function expectedFloor(map, marker) {
  if (mapsWithoutFloorControls.has(map)) {
    return { status: 'not-applicable', expected: null, evidence: 'target map has no floor selector' };
  }

  const parts = numericIdParts(marker.id);
  if (map === 'factory') {
    return { status: 'derived', expected: parts[0], evidence: 'source ID floor prefix and source floor panel' };
  }
  if (map === 'customs') {
    return { status: 'derived', expected: parts[2], evidence: 'source ID floor component and source inset label' };
  }
  if (map === 'ground-zero') {
    const upperFloorIds = new Set([
      'medical-1-2-1-1',
      'medical-3-2-3-1', 'medical-3-2-3-2',
      'medical-3-2-4-1', 'medical-3-2-4-2',
      'user-3-2-3-1', 'user-3-2-3-2',
      'user-3-2-4-1', 'user-3-2-4-2',
      'user-3-2-5-1', 'user-3-2-5-2',
      'user-4-2-2-1'
    ]);
    return {
      status: 'derived',
      expected: upperFloorIds.has(marker.id) ? 2 : 1,
      evidence: upperFloorIds.has(marker.id)
        ? 'source 2F inset or explicit source description'
        : 'source main-map region'
    };
  }
  if (map === 'interchange') {
    if (marker.id.startsWith('financial-4-')) {
      return { status: 'derived', expected: 1, evidence: 'power-station content is on target Main layer' };
    }
    const sourceFloor = parts[0];
    return {
      status: 'derived',
      expected: sourceFloor + 1,
      evidence: 'source Basement/First/Second maps to target Main/Level 2/Level 3'
    };
  }
  if (map === 'icebreaker') {
    return {
      status: 'derived',
      expected: icebreakerDeck(Number(marker.sourcePosition[1])),
      evidence: 'source deck column and target numbered deck selector'
    };
  }
  if (map === 'lab') {
    const sourceX = Number(marker.sourcePosition[1]);
    return {
      status: 'derived',
      expected: sourceX < 1300 ? 0 : sourceX < 2500 ? 1 : 2,
      evidence: 'source Technical/First/Second panel'
    };
  }
  if (map === 'reserve') {
    let expected = 1;
    if (/^(?:pmc|project)-8-/.test(marker.id)) expected = 0;
    else if (/^pmc-5-1-0-/.test(marker.id)) expected = 0;
    else if (/^(?:pmc|project)-6-1-2-/.test(marker.id)) expected = 2;
    else if (/^(?:pmc|project)-4-/.test(marker.id)) expected = parts[2];
    else if (/^(?:pmc|project)-5-/.test(marker.id)) expected = parts[2];
    return { status: 'derived', expected, evidence: 'source building/floor inset and source ID' };
  }
  if (map === 'shoreline') {
    const room = String(marker.detail || '').match(/([2-3])\d{2}호?/);
    const explicit = String(marker.detail || '').match(/([1-3])층/);
    return {
      status: 'derived',
      expected: room ? Number(room[1]) : explicit ? Number(explicit[1]) : 1,
      evidence: room ? 'source room number' : explicit ? 'explicit source description' : 'source main-map region'
    };
  }
  if (map === 'streets') {
    return { status: 'derived', expected: parts[2], evidence: 'source ID floor component and source building inset' };
  }
  if (map === 'woods') {
    return {
      status: 'derived',
      expected: 1,
      evidence: 'target exposes Main/Basement only; source above-ground locations belong to Main'
    };
  }

  return { status: 'unverified', expected: null, evidence: 'no independent floor evidence' };
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function auditPhoto(sourceName, sourceMarker, generatedMarker, checkRemote) {
  const relativePath = String(sourceMarker.detailImg || '').replace(/\\/g, '/').replace(/^\.\//, '');
  const localPath = path.join(upstreamRoot, ...relativePath.split('/'));
  const localBytes = fs.readFileSync(localPath);
  const metadata = await sharp(localBytes).metadata();
  const expectedUrl = `https://perofunyang.github.io/battlepass_interactive_map/${relativePath}`;
  const generatedUrl = generatedMarker.photos?.[0]?.url || '';
  const result = {
    status: 'verified',
    sourcePath: relativePath,
    generatedUrl,
    sourcePathMatches: generatedUrl === expectedUrl,
    decoded: Boolean(metadata.width && metadata.height && metadata.format),
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    localSha256: sha256(localBytes),
    remoteChecked: false,
    remoteBytesMatch: null
  };

  if (!result.sourcePathMatches || !result.decoded) result.status = 'failed';
  if (checkRemote) {
    const response = await fetch(expectedUrl);
    const remoteBytes = Buffer.from(await response.arrayBuffer());
    result.remoteChecked = true;
    result.remoteStatus = response.status;
    result.remoteBytesMatch = response.ok && sha256(remoteBytes) === result.localSha256;
    if (!result.remoteBytesMatch) result.status = 'failed';
  }
  return result;
}

async function main() {
  const checkRemote = process.argv.includes('--remote');
  const rows = [];

  for (const [map, generatedMarkers] of Object.entries(data.maps)) {
    const sourceMarkers = readSource(map);
    const sourceById = new Map(sourceMarkers.map(marker => [marker.id, marker]));
    for (const generatedMarker of generatedMarkers) {
      const sourceMarker = sourceById.get(generatedMarker.id);
      if (!sourceMarker) throw new Error(`${map}/${generatedMarker.id}: source marker missing`);
      const coordinateMatches = JSON.stringify(generatedMarker.sourcePosition) === JSON.stringify(sourceMarker.coords);
      const photo = await auditPhoto(sourceNames[map], sourceMarker, generatedMarker, checkRemote);
      const floor = expectedFloor(map, generatedMarker);
      const floorStatus = floor.status === 'derived'
        ? (generatedMarker.floor === floor.expected ? 'verified' : 'mismatch')
        : floor.status;
      rows.push({
        map,
        id: generatedMarker.id,
        sourceCoordinate: {
          status: coordinateMatches ? 'verified' : 'failed',
          source: sourceMarker.coords,
          generated: generatedMarker.sourcePosition
        },
        targetPlacement: {
          status: 'unverified',
          reason: multiPanelSourceMaps.has(map)
            ? 'whole-canvas projection cannot relocate detached floor panels to target buildings'
            : 'no independent target-map control-point validation exists'
        },
        photo,
        floor: {
          status: floorStatus,
          current: generatedMarker.floor,
          expected: floor.expected,
          evidence: floor.evidence
        }
      });
    }
  }

  const count = (selector) => rows.filter(selector).length;
  const summary = {
    markerCount: rows.length,
    sourceCoordinatesVerified: count(row => row.sourceCoordinate.status === 'verified'),
    targetPlacementsVerified: count(row => row.targetPlacement.status === 'verified'),
    targetPlacementsUnverified: count(row => row.targetPlacement.status === 'unverified'),
    photosVerified: count(row => row.photo.status === 'verified'),
    remotePhotosByteMatched: count(row => row.photo.remoteBytesMatch === true),
    floorsVerified: count(row => row.floor.status === 'verified'),
    floorsMismatched: count(row => row.floor.status === 'mismatch'),
    floorsNotApplicable: count(row => row.floor.status === 'not-applicable'),
    floorsUnverified: count(row => row.floor.status === 'unverified')
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify({ summary, rows }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
  for (const row of rows.filter(item => item.floor.status === 'mismatch')) {
    console.log(`FLOOR ${row.map}/${row.id}: ${row.floor.current} -> ${row.floor.expected} (${row.floor.evidence})`);
  }
  console.log(`Audit report: ${outputPath}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
