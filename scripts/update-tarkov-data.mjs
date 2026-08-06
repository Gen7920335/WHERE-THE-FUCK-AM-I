import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const outputPath = resolve(repoRoot, "eft-where-am-i/html/quest-locations.json");
const markerOutputPath = resolve(repoRoot, "eft-where-am-i/html/map-markers.json");
const endpoints = {
  tasks: "https://json.tarkov.dev/regular/tasks",
  taskTranslations: "https://json.tarkov.dev/regular/tasks_en",
  itemTranslations: "https://json.tarkov.dev/regular/items_en",
  maps: "https://json.tarkov.dev/regular/maps",
  mapMetadata: "https://raw.githubusercontent.com/the-hideout/tarkov-dev/master/src/data/maps.json"
};

async function getJson(url, cacheName) {
  const cachePath = resolve(repoRoot, ".tools/reference", cacheName);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const text = await response.text();
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, text);
    return JSON.parse(text);
  } catch (error) {
    try {
      return JSON.parse(await readFile(cachePath, "utf8"));
    } catch {
      throw new Error(`Could not update or read ${cacheName}: ${error.message}`);
    }
  }
}

const [rawTasks, taskEnglish, itemEnglish, rawMaps, rawMapMetadata] = await Promise.all([
  getJson(endpoints.tasks, "regular-tasks.json"),
  getJson(endpoints.taskTranslations, "regular-tasks-en.json"),
  getJson(endpoints.itemTranslations, "regular-items-en.json"),
  getJson(endpoints.maps, "regular-maps.json"),
  getJson(endpoints.mapMetadata, "tarkov-dev-maps.json")
]);

const taskText = taskEnglish.data || {};
const itemText = itemEnglish.data || {};

function objectiveLocations(objective) {
  const locations = [];
  for (const zone of objective.zones || []) {
    if (!zone?.map || !zone?.position) continue;
    locations.push({
      map: zone.map,
      x: zone.position.x,
      y: zone.position.y,
      z: zone.position.z,
      top: zone.top,
      bottom: zone.bottom,
      kind: "zone"
    });
  }
  for (const group of objective.possibleLocations || []) {
    for (const position of group.positions || []) {
      locations.push({ map: group.map, x: position.x, y: position.y, z: position.z, kind: "possible" });
    }
  }
  return locations;
}

const tasks = Object.values(rawTasks.data?.tasks || {}).map(task => ({
  id: task.id,
  name: taskText[task.name] || task.normalizedName || task.id,
  minPlayerLevel: task.minPlayerLevel || 0,
  taskRequirements: (task.taskRequirements || []).map(requirement => ({
    task: requirement.task,
    status: requirement.status || []
  })),
  neededKeys: (task.neededKeys || []).map(group => ({
    map: group.map,
    keys: (group.keys || []).map(id => ({ id, name: itemText[`${id} Name`] || id }))
  })),
  objectives: (task.objectives || []).map(objective => ({
    id: objective.id,
    description: taskText[objective.description] || objective.type || objective.id,
    type: objective.type,
    count: objective.count || 1,
    optional: Boolean(objective.optional),
    maps: objective.maps || [],
    locations: objectiveLocations(objective)
  }))
}));

const snapshot = {
  generatedAt: new Date().toISOString(),
  source: endpoints,
  tasks
};

await writeFile(outputPath, `${JSON.stringify(snapshot)}\n`);
console.log(`Wrote ${tasks.length} tasks to ${outputPath}`);

const supportedMapIds = new Set([
  "55f2d3fd4bdc2d5f408b4567", "56f40101d2720b2a4d8b45d6", "5704e3c2d2720bac5b8b4567",
  "5704e554d2720bac5b8b456e", "5714dbc024597771384a510d", "5b0fc42d86f7744a585f9105",
  "5704e5fad2720bc05b8b4567", "5704e4dad2720bb55b8b4567", "5714dc692459777137212e12",
  "653e6760052c01c1c805532f"
]);
const mapData = rawMaps.data || {};
const interactiveMetadata = new Map(rawMapMetadata.map(location => [
  location.normalizedName,
  location.maps?.find(map => map.projection === "interactive")
]));
const mapsById = new Map(Object.values(mapData.maps || {}).map(map => [map.id, map]));
const mobsById = mapData.mobs || {};
const containersById = mapData.lootContainers || {};
const weaponsById = mapData.stationaryWeapons || {};
const itemName = id => itemText[`${id} Name`] || id;
const mapName = map => String(map?.normalizedName || map?.id || "Unknown")
  .split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
const rounded = value => Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;
const point = value => value ? [rounded(value.x), rounded(value.y), rounded(value.z)] : null;
const markerItemIds = new Set();

const markerMaps = Object.values(mapData.maps || {})
  .filter(map => supportedMapIds.has(map.id))
  .map(map => {
    const metadata = interactiveMetadata.get(map.normalizedName);
    const floorRules = [];
    if (metadata?.svgLayer) floorRules.push({
      floor: metadata.svgLayer,
      primary: true,
      extents: metadata.heightRange ? [{ height: metadata.heightRange }] : []
    });
    for (const layer of metadata?.layers || []) {
      if (!layer.svgLayer) continue;
      floorRules.push({
        floor: layer.svgLayer,
        primary: false,
        extents: (layer.extents || []).map(extent => ({
          height: extent.height,
          bounds: (extent.bounds || []).map(bounds => [bounds[0], bounds[1]])
        }))
      });
    }
    return ({
    id: map.id,
    name: mapName(map),
    floorRules,
    spawns: (map.spawns || []).map(spawn => ({
      position: point(spawn.position), categories: spawn.categories || [], sides: spawn.sides || [], name: spawn.zoneName || "Spawn"
    })),
    bosses: (map.bosses || []).flatMap(boss => {
      const mob = mobsById[boss.mob] || {};
      return (boss.spawnLocations || []).flatMap(location => (location.positions || []).map(position => ({
        position: point(position), name: mob.name || boss.mob, normalizedName: mob.normalizedName || boss.mob,
        chance: boss.spawnChance, locationChance: location.chance, area: location.name
      })));
    }),
    extracts: (map.extracts || []).map(extract => {
      if (extract.transferItem?.item) markerItemIds.add(extract.transferItem.item);
      return {
        id: extract.id, name: extract.name, faction: extract.faction, position: point(extract.position),
        top: extract.top, bottom: extract.bottom, switches: extract.switches || [],
        transferItem: extract.transferItem ? { item: extract.transferItem.item, count: extract.transferItem.count } : null
      };
    }),
    transits: (map.transits || []).map(transit => ({
      id: transit.id, name: `Transit to ${mapName(mapsById.get(transit.map))}`,
      position: point(transit.position), top: transit.top, bottom: transit.bottom
    })),
    locks: (map.locks || []).map(lock => {
      markerItemIds.add(lock.key);
      return {
        id: lock.id, keyId: lock.key, lockType: lock.lockType, needsPower: Boolean(lock.needsPower),
        position: point(lock.position), top: lock.top, bottom: lock.bottom
      };
    }),
    hazards: (map.hazards || []).map(hazard => ({
      id: hazard.id, name: hazard.hazardType || hazard.name || "Hazard", type: hazard.hazardType,
      position: point(hazard.position), top: hazard.top, bottom: hazard.bottom
    })),
    containers: (map.lootContainers || []).map(container => ({ id: container.lootContainer, position: point(container.position) })),
    looseLoot: (map.lootLoose || []).map(loot => {
      for (const id of loot.items || []) markerItemIds.add(id);
      return { position: point(loot.position), items: loot.items || [] };
    }),
    switches: (map.switches || []).map(sw => ({
      id: sw.id, name: sw.name || "Switch", type: sw.switchType, position: point(sw.position), top: sw.top, bottom: sw.bottom
    })),
    stationaryWeapons: (map.stationaryWeapons || []).map(weapon => {
      const info = weaponsById[weapon.stationaryWeapon] || {};
      return { name: info.name || info.shortName || "Stationary weapon", position: point(weapon.position) };
    }),
    btrStops: (map.btrStops || []).map(stop => ({ name: stop.name || "BTR stop", position: point(stop) }))
  });
  });

const markerSnapshot = {
  generatedAt: new Date().toISOString(),
  source: endpoints.maps,
  itemNames: Object.fromEntries([...markerItemIds].sort().map(id => [id, itemName(id)])),
  containerNames: Object.fromEntries(Object.entries(containersById).map(([id, info]) => [id, info.name || id])),
  maps: markerMaps
};

await writeFile(markerOutputPath, `${JSON.stringify(markerSnapshot)}\n`);
const markerCount = markerMaps.reduce((total, map) => total + [
  map.spawns, map.bosses, map.extracts, map.transits, map.locks, map.hazards, map.containers,
  map.looseLoot, map.switches, map.stationaryWeapons, map.btrStops
].reduce((sum, entries) => sum + entries.length, 0), 0);
console.log(`Wrote ${markerCount} map markers to ${markerOutputPath}`);
