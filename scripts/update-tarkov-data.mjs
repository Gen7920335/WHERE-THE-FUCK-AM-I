import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const outputPath = resolve(repoRoot, "eft-where-am-i/html/quest-locations.json");
const markerOutputPath = resolve(repoRoot, "eft-where-am-i/html/map-markers.json");
const endpoints = {
  tasks: "https://json.tarkov.dev/regular/tasks",
  taskTranslations: "https://json.tarkov.dev/regular/tasks_en",
  taskTranslationsKo: "https://json.tarkov.dev/regular/tasks_ko",
  traders: "https://json.tarkov.dev/regular/traders",
  traderTranslations: "https://json.tarkov.dev/regular/traders_en",
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

const [rawTasks, taskEnglish, taskKorean, rawTraders, traderEnglish, itemEnglish, rawMaps, rawMapMetadata] = await Promise.all([
  getJson(endpoints.tasks, "regular-tasks.json"),
  getJson(endpoints.taskTranslations, "regular-tasks-en.json"),
  getJson(endpoints.taskTranslationsKo, "regular-tasks-ko.json"),
  getJson(endpoints.traders, "regular-traders.json"),
  getJson(endpoints.traderTranslations, "regular-traders-en.json"),
  getJson(endpoints.itemTranslations, "regular-items-en.json"),
  getJson(endpoints.maps, "regular-maps.json"),
  getJson(endpoints.mapMetadata, "tarkov-dev-maps.json")
]);

const taskText = taskEnglish.data || {};
const taskKoText = taskKorean.data || {};
const traderText = traderEnglish.data || {};
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
  nameKo: taskText[task.name] || task.normalizedName || task.id,
  normalizedName: task.normalizedName || "",
  trader: task.trader,
  factionName: task.factionName || "Any",
  wikiLink: task.wikiLink || "",
  kappaRequired: Boolean(task.kappaRequired),
  lightkeeperRequired: Boolean(task.lightkeeperRequired),
  minPlayerLevel: task.minPlayerLevel || 0,
  taskRequirements: (task.taskRequirements || []).map(requirement => ({
    task: requirement.task,
    status: requirement.status || []
  })),
  traderRequirements: (task.traderRequirements || []).map(requirement => ({
    trader: requirement.trader,
    requirementType: requirement.requirementType,
    compareMethod: requirement.compareMethod,
    value: requirement.value
  })),
  otherRequirements: (task.otherRequirements || []).map(requirement => ({
    type: requirement.type,
    traders: requirement.traders || []
  })),
  neededKeys: (task.neededKeys || []).map(group => ({
    map: group.map,
    keys: (group.keys || []).map(id => ({ id, name: itemText[`${id} Name`] || id }))
  })),
  objectives: (task.objectives || []).map(objective => ({
    id: objective.id,
    description: taskText[objective.description] || objective.type || objective.id,
    descriptionKo: taskKoText[objective.description] || taskText[objective.description] || objective.type || objective.id,
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
  traders: Object.values(rawTraders.data || {}).map(trader => ({
    id: trader.id,
    name: traderText[trader.name] || trader.normalizedName || trader.id,
    normalizedName: trader.normalizedName || "",
    maxLevel: Math.max(1, (trader.levels || []).length)
  })),
  tasks
};

await writeFile(outputPath, `${JSON.stringify(snapshot)}\n`);
console.log(`Wrote ${tasks.length} tasks to ${outputPath}`);

const supportedMapIds = new Set([
  "55f2d3fd4bdc2d5f408b4567", "56f40101d2720b2a4d8b45d6", "5704e3c2d2720bac5b8b4567",
  "5704e554d2720bac5b8b456e", "5714dbc024597771384a510d", "5b0fc42d86f7744a585f9105",
  "5704e5fad2720bc05b8b4567", "5704e4dad2720bb55b8b4567", "5714dc692459777137212e12",
  "653e6760052c01c1c805532f", "65cc8f81a9aac3e77d0cfd3e", "6733700029c367a3d40b02af",
  "69af492a4819ea4ba10a69c5"
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
const humanize = value => String(value || "")
  .replace(/[_-]+/g, " ").split(/\s+/).filter(Boolean)
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(" ");
const mapName = map => String(map?.normalizedName || map?.id || "Unknown")
  .split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
const rounded = value => Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;
const point = value => value ? [rounded(value.x), rounded(value.y), rounded(value.z)] : null;
const markerItemIds = new Set();
const keyItemIds = new Set(Object.values(mapData.maps || {}).flatMap(map => [
  ...(map.locks || []).map(lock => lock.key),
  ...(map.accessKeys || [])
]));

const markerMaps = Object.values(mapData.maps || {})
  .filter(map => supportedMapIds.has(map.id))
  .map(map => {
    const metadata = interactiveMetadata.get(map.normalizedName);
    const floorRules = [];
    const floorKey = value => String(value || "").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
    const primaryLayer = metadata?.svgLayer || metadata?.layers?.find(layer => layer.show)?.name;
    if (primaryLayer) floorRules.push({
      floor: floorKey(primaryLayer),
      primary: true,
      extents: metadata.heightRange ? [{ height: metadata.heightRange }] : []
    });
    for (const layer of metadata?.layers || []) {
      const layerName = layer.svgLayer || layer.name;
      if (!layerName) continue;
      floorRules.push({
        floor: floorKey(layerName),
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
    labels: (metadata?.labels || []).map(label => ({
      position: [rounded(label.position?.[0]), rounded(label.position?.[1])],
      text: label.text || "",
      bottom: Number.isFinite(label.bottom) ? label.bottom : -1000,
      top: Number.isFinite(label.top) ? label.top : 1000,
      size: Number.isFinite(label.size) ? label.size : 100,
      rotation: Number.isFinite(label.rotation) ? label.rotation : 0
    })).filter(label => label.text && label.position.every(Number.isFinite)),
    spawns: (map.spawns || []).map(spawn => ({
      position: point(spawn.position), categories: spawn.categories || [], sides: spawn.sides || [], name: spawn.zoneName || "Spawn"
    })),
    bosses: (map.bosses || []).flatMap(boss => {
      const mob = mobsById[boss.mob] || {};
      return (boss.spawnLocations || []).flatMap(location => (location.positions || []).map(position => ({
        position: point(position), name: humanize(mob.normalizedName) || mob.name || boss.mob, normalizedName: mob.normalizedName || boss.mob,
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
      id: sw.id, name: humanize(sw.name) || "Switch", type: sw.switchType, position: point(sw.position), top: sw.top, bottom: sw.bottom
    })),
    stationaryWeapons: (map.stationaryWeapons || []).map(weapon => {
      const info = weaponsById[weapon.stationaryWeapon] || {};
      return { name: humanize(info.normalizedName) || info.name || info.shortName || "Stationary weapon", position: point(weapon.position) };
    }),
    btrStops: (map.btrStops || []).map(stop => ({ name: humanize(stop.name) || "BTR stop", position: point(stop) }))
  });
  });

const markerSnapshot = {
  generatedAt: new Date().toISOString(),
  source: endpoints.maps,
  itemNames: Object.fromEntries([...markerItemIds].sort().map(id => [id, itemName(id)])),
  keyItemIds: [...new Set([
    ...keyItemIds,
    ...[...markerItemIds].filter(id => /\b(key|keycard)\b/i.test(itemName(id)) &&
      !/keychain|key tool|key case|keycard holder/i.test(itemName(id)))
  ])].sort(),
  containerNames: Object.fromEntries(Object.entries(containersById).map(([id, info]) => [
    id,
    humanize(info.normalizedName) || info.name || id
  ])),
  containerTypes: Object.fromEntries(Object.entries(containersById).map(([id, info]) => [id, info.normalizedName || "other"])),
  maps: markerMaps
};

await writeFile(markerOutputPath, `${JSON.stringify(markerSnapshot)}\n`);
const markerCount = markerMaps.reduce((total, map) => total + [
  map.spawns, map.bosses, map.extracts, map.transits, map.locks, map.hazards, map.containers,
  map.looseLoot, map.switches, map.stationaryWeapons, map.btrStops
].reduce((sum, entries) => sum + entries.length, 0), 0);
console.log(`Wrote ${markerCount} map markers to ${markerOutputPath}`);
