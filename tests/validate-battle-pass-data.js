const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sharp = require('../.tools/image-utils/node_modules/sharp');

const root = path.resolve(__dirname, '..');
const upstreamRoot = path.resolve(
  process.env.PEROFUNYANG_BATTLE_PASS_DIR
    || path.join(root, '.tools', 'battlepass_interactive_map')
);
const dataPath = path.join(root, 'eft-where-am-i', 'html', 'battle-pass-locations.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const importerSource = fs.readFileSync(path.join(root, 'tools', 'import-perofunyang-battle-pass.js'), 'utf8');
const serviceSource = fs.readFileSync(path.join(root, 'eft-where-am-i', 'Classes', 'BattlePassOverlayDataService.cs'), 'utf8');

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

function readSource(sourceName) {
  const sourcePath = path.join(upstreamRoot, 'data', `${sourceName}.js`);
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(sourcePath, 'utf8'), context, { filename: sourcePath });
  return context.window[`MAP_DATA_${sourceName}`] || [];
}

function fail(message) {
  throw new Error(message);
}

async function main() {
  if (!data.source?.importedWithoutUsingPreviousWtfmiBattlePassData) {
    fail('clean-import declaration is missing');
  }
  if (data.verification?.previousWtfmiDataRead !== false) {
    fail('verification does not state that previous WTFMI data was excluded');
  }
  if (/readFileSync\s*\(\s*outputPath/.test(importerSource)
    || /battle-pass-locations\.json[^\n]+read/i.test(importerSource)) {
    fail('importer reads the previous generated battle-pass JSON');
  }
  if (!/location\["mapPosition"\]/.test(serviceSource)
    || /location\["position"\]/.test(serviceSource)
    || /photoIds/.test(serviceSource)) {
    fail('runtime service still accepts legacy coordinates or photo IDs');
  }

  let importedCount = 0;
  let sourceCoordinateChecks = 0;
  let photoChecks = 0;
  const globalIds = new Set();

  for (const [mapId, sourceName] of Object.entries(sourceNames)) {
    const sourceMarkers = readSource(sourceName)
      .filter(marker => marker.category !== 'transit' && marker.category !== 'temporary');
    const generated = data.maps?.[mapId];
    if (!Array.isArray(generated)) fail(`${mapId}: generated marker list is missing`);
    if (generated.length !== sourceMarkers.length) {
      fail(`${mapId}: expected ${sourceMarkers.length} source markers, found ${generated.length}`);
    }

    const sourceById = new Map(sourceMarkers.map(marker => [marker.id, marker]));
    for (const marker of generated) {
      importedCount += 1;
      const source = sourceById.get(marker.id);
      if (!source) fail(`${mapId}/${marker.id}: not present in upstream source`);
      const globalId = `${mapId}/${marker.id}`;
      if (globalIds.has(globalId)) fail(`${globalId}: duplicate generated ID`);
      globalIds.add(globalId);

      if ('position' in marker || 'photoIds' in marker || 'coordinateBasis' in marker) {
        fail(`${globalId}: contains legacy WTFMI battle-pass fields`);
      }
      if (JSON.stringify(marker.sourcePosition) !== JSON.stringify(source.coords)) {
        fail(`${globalId}: source coordinate changed during import`);
      }
      if (!marker.coordinateValidation?.checked
        || !marker.coordinateValidation?.exactSourceValuePreserved
        || !marker.coordinateValidation?.insideSourceCanvas) {
        fail(`${globalId}: coordinate validation record is incomplete`);
      }
      if (!Array.isArray(marker.mapPosition)
        || marker.mapPosition.length !== 2
        || marker.mapPosition.some(value => !Number.isFinite(value) || value < 0 || value > 100)) {
        fail(`${globalId}: invalid WTFMI display position`);
      }
      sourceCoordinateChecks += 1;

      if (!source.detailImg || !Array.isArray(marker.photos) || marker.photos.length !== 1) {
        fail(`${globalId}: source photo is not linked one-to-one`);
      }
      const relativePhoto = String(source.detailImg).replace(/\\/g, '/').replace(/^\.\//, '');
      const expectedUrl = `https://perofunyang.github.io/battlepass_interactive_map/${relativePhoto}`;
      if (marker.photos[0].url !== expectedUrl) fail(`${globalId}: photo URL does not match detailImg`);
      const localPhoto = path.resolve(upstreamRoot, ...relativePhoto.split('/'));
      const metadata = await sharp(localPhoto).metadata();
      if (!metadata.width || !metadata.height || !metadata.format) fail(`${globalId}: source photo cannot be decoded`);
      if (!marker.photoValidation?.checked
        || !marker.photoValidation?.sourcePathMatchesDetailImg
        || !marker.photoValidation?.decoded
        || marker.photoValidation.width !== metadata.width
        || marker.photoValidation.height !== metadata.height
        || marker.photoValidation.format !== metadata.format) {
        fail(`${globalId}: photo validation record does not match decoded image`);
      }
      photoChecks += 1;
    }
  }

  if (importedCount !== 308) fail(`expected 308 document markers, found ${importedCount}`);
  if (data.verification?.importedMarkerCount !== importedCount
    || data.verification?.coordinateChecksPassed !== sourceCoordinateChecks
    || data.verification?.photoChecksPassed !== photoChecks) {
    fail('top-level verification counts do not match the marker audit');
  }

  console.log(`Validated clean import: ${importedCount} markers, ${sourceCoordinateChecks} exact source coordinates, ${photoChecks} decoded photos.`);
}

main().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
