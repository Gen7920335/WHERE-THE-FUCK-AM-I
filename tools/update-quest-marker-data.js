const fs = require('fs');
const path = require('path');

const DATA_ROOT = 'https://json.tarkov.dev/regular';
const OUTPUT_PATH = path.resolve(__dirname, '..', 'eft-where-am-i', 'html', 'quest-marker-locations.json');

const mapAliases = new Map([
  ['factory', 'factory'],
  ['night-factory', 'factory'],
  ['customs', 'customs'],
  ['woods', 'woods'],
  ['lighthouse', 'lighthouse'],
  ['shoreline', 'shoreline'],
  ['reserve', 'reserve'],
  ['interchange', 'interchange'],
  ['streets-of-tarkov', 'streets'],
  ['the-lab', 'lab'],
  ['the-lab-dark', 'lab'],
  ['ground-zero', 'ground-zero'],
  ['ground-zero-21', 'ground-zero'],
  ['the-labyrinth', 'labyrinth'],
  ['terminal', 'terminal'],
  ['icebreaker', 'icebreaker']
]);

async function readJson(endpoint) {
  const response = await fetch(`${DATA_ROOT}/${endpoint}`);
  if (!response.ok) {
    throw new Error(`${endpoint}: HTTP ${response.status}`);
  }
  return response.json();
}

function translated(dictionary, key, fallback = '') {
  return String(dictionary[key] || fallback || key || '').trim();
}

function positionKey(marker) {
  return [
    marker.questId,
    marker.objectiveId,
    marker.x.toFixed(5),
    marker.y.toFixed(5),
    marker.z.toFixed(5)
  ].join('|');
}

async function main() {
  const [tasksDocument, mapsDocument, taskTranslationsDocument] = await Promise.all([
    readJson('tasks'),
    readJson('maps'),
    readJson('tasks_en')
  ]);

  const tasks = Object.values(tasksDocument.data?.tasks || {});
  const maps = Object.values(mapsDocument.data?.maps || {});
  const translations = taskTranslationsDocument.data || {};
  const mapNamesById = new Map(maps.map((map) => [map.id, map.normalizedName]));
  const outputMaps = {};
  const seenByMap = new Map();

  const append = (mapId, task, objective, position, category) => {
    const sourceMapName = mapNamesById.get(mapId);
    const map = mapAliases.get(sourceMapName);
    if (!map || !position || ![position.x, position.y, position.z].every(Number.isFinite)) return;

    const marker = {
      questId: String(task.id || ''),
      quest: translated(translations, task.name, task.name),
      objectiveId: String(objective.id || ''),
      objective: translated(translations, objective.description, objective.description),
      objectiveType: String(objective.type || ''),
      category,
      optional: Boolean(objective.optional),
      x: Number(position.x),
      y: Number(position.y),
      z: Number(position.z)
    };
    const key = positionKey(marker);
    if (!seenByMap.has(map)) seenByMap.set(map, new Set());
    if (seenByMap.get(map).has(key)) return;
    seenByMap.get(map).add(key);
    (outputMaps[map] ||= []).push(marker);
  };

  for (const task of tasks) {
    for (const objective of task.objectives || []) {
      for (const zone of objective.zones || []) {
        append(typeof zone.map === 'string' ? zone.map : zone.map?.id, task, objective, zone.position, 'objective');
      }
      for (const location of objective.possibleLocations || []) {
        const mapId = typeof location.map === 'string' ? location.map : location.map?.id;
        for (const position of location.positions || []) {
          append(mapId, task, objective, position, 'item');
        }
      }
    }
  }

  for (const markers of Object.values(outputMaps)) {
    markers.sort((a, b) =>
      a.quest.localeCompare(b.quest, 'en')
      || a.objective.localeCompare(b.objective, 'en')
      || a.y - b.y
      || a.x - b.x
      || a.z - b.z);
  }

  const output = {
    source: `${DATA_ROOT}/tasks`,
    sourceProject: 'https://tarkov.dev/',
    maps: Object.fromEntries(Object.entries(outputMaps).sort(([a], [b]) => a.localeCompare(b)))
  };
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  const summary = Object.fromEntries(
    Object.entries(output.maps).map(([map, markers]) => [map, {
      markers: markers.length,
      quests: new Set(markers.map((marker) => marker.quest)).size
    }])
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
