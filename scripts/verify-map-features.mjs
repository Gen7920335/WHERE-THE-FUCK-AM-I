import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const repoRoot = resolve(import.meta.dirname, "..");
const mapJs = await readFile(resolve(repoRoot, "eft-where-am-i/html/map.js"), "utf8");
const mapCss = await readFile(resolve(repoRoot, "eft-where-am-i/html/map.css"), "utf8");
const mapHtml = await readFile(resolve(repoRoot, "eft-where-am-i/html/map.html"), "utf8");
const panelHtml = await readFile(resolve(repoRoot, "eft-where-am-i/html/panel.html"), "utf8");
const whereAmICs = await readFile(resolve(repoRoot, "eft-where-am-i/UserControls/WhereAmI.cs"), "utf8");
const settingsCs = await readFile(resolve(repoRoot, "eft-where-am-i/Classes/SettingsHandler.cs"), "utf8");
const floorManagerCs = await readFile(resolve(repoRoot, "eft-where-am-i/Classes/FloorManager.cs"), "utf8");
const squadSyncCs = await readFile(resolve(repoRoot, "eft-where-am-i/Classes/SquadSyncService.cs"), "utf8");
const markers = JSON.parse(await readFile(resolve(repoRoot, "eft-where-am-i/html/map-markers.json"), "utf8"));
const battlePass = JSON.parse(await readFile(resolve(repoRoot, "eft-where-am-i/html/battle-pass-locations.json"), "utf8"));
const quests = JSON.parse(await readFile(resolve(repoRoot, "eft-where-am-i/html/quest-locations.json"), "utf8"));

function readConstant(name, nextName) {
  const match = mapJs.match(new RegExp(`const ${name} = ([\\s\\S]*?);\\s+const ${nextName}`));
  if (!match) throw new Error(`Could not parse ${name} from map.js`);
  return vm.runInNewContext(`(${match[1]})`);
}

const maps = readConstant("MAPS", "FLOOR_ALIASES");
const layers = readConstant("LAYERS", "LAYER_BY_ID");
const containerLayers = readConstant("CONTAINER_LAYER_BY_TYPE", "state");
const layerIds = new Set(layers.map(layer => layer.id));
const requiredLayers = [
  "extract-pmc", "extract-scav", "extract-coop", "transit",
  "spawn-pmc", "spawn-scav", "spawn-aipmc", "spawn-sniper", "boss", "cultist", "rogue", "raider",
  "lock", "lock-door", "lock-container", "lock-trunk", "key-spawn", "switch", "stationary", "btr", "hazard-mine", "hazard-sniper", "loose-item", "battle-pass",
  "container-cache", "container-ammo", "container-grenade", "container-weapon", "container-register",
  "container-body", "container-jacket", "container-drawer", "container-bag", "container-suitcase",
  "container-crate", "container-toolbox", "container-pc", "container-medcase", "container-medbag",
  "container-safe", "container-stash", "container-technical", "container-medical", "container-ration", "container-other"
];
for (const id of requiredLayers) if (!layerIds.has(id)) throw new Error(`Required public map layer is missing: ${id}`);
const lootLayers = layers.filter(layer => layer.group === "Loot");
if (lootLayers.at(-1)?.id !== "battle-pass") throw new Error("Battle Pass must be the final item-spawn overlay");
if (!/\.map-marker\.layer-battle-pass[\s\S]*?width:\s*calc\(10\.5px \* var\(--ui-scale\)\)/.test(mapCss) || !mapCss.includes("clip-path: polygon")) {
  throw new Error("Battle Pass cross-star icon must be 50% of the 21px normal item marker");
}

if (Object.keys(maps).length !== 13 || markers.maps.length !== 13) throw new Error("Expected exactly 13 supported maps");
if (new Set(markers.maps.map(map => map.id)).size !== markers.maps.length) throw new Error("Duplicate map IDs in marker data");
for (const [key, map] of Object.entries(maps)) {
  if (!markers.maps.some(candidate => candidate.id === map.tdevId)) throw new Error(`${key}: marker data is missing`);
  const underground = map.floors.findIndex(floor => /underground|basement|bunker|technical/i.test(floor));
  const ground = map.floors.findIndex(floor => /ground|first.level/i.test(floor));
  if (underground >= 0 && ground >= 0 && underground > ground) throw new Error(`${key}: floor order would invert up/down arrows`);
}

let battlePassCount = 0;
for (const [mapKey, locations] of Object.entries(battlePass.maps || {})) {
  if (!maps[mapKey]) throw new Error(`Battle Pass data references unsupported map: ${mapKey}`);
  if (!Array.isArray(locations)) throw new Error(`${mapKey}: Battle Pass locations must be an array`);
  for (const location of locations) {
    battlePassCount++;
    if (!location.title || !location.documents || !["confirmed", "reported"].includes(location.confidence)) {
      throw new Error(`${mapKey}: incomplete Battle Pass marker metadata`);
    }
    if (!Array.isArray(location.position) || location.position.length !== 3 || location.position.some(value => !Number.isFinite(value))) {
      throw new Error(`${mapKey}/${location.title}: invalid Battle Pass position`);
    }
    const position = project(maps[mapKey], location.position[0], location.position[2]);
    if (position.left < 0 || position.left > 100 || position.top < 0 || position.top > 100) {
      throw new Error(`${mapKey}/${location.title}: Battle Pass marker is outside calibrated map bounds`);
    }
  }
}
if (battlePassCount < 100) throw new Error(`Only ${battlePassCount} Battle Pass locations were found`);

if (!Array.isArray(markers.keyItemIds) || markers.keyItemIds.length < 100) throw new Error("Key-spawn catalog is unexpectedly small");
const knownKeys = new Set(markers.keyItemIds);
const collections = ["spawns", "bosses", "extracts", "transits", "locks", "hazards", "containers", "looseLoot", "switches", "stationaryWeapons", "btrStops"];
let markerCount = 0;
let hazardCount = 0;
let keySpawnCount = 0;
let edgeCount = 0;

function project(map, x, z) {
  const [a, b, c] = map.anchors;
  const abX = b.world[0] - a.world[0], abZ = b.world[1] - a.world[1];
  const acX = c.world[0] - a.world[0], acZ = c.world[1] - a.world[1];
  const pointX = x - a.world[0], pointZ = z - a.world[1];
  const determinant = abX * acZ - abZ * acX;
  const across = (pointX * acZ - pointZ * acX) / determinant;
  const down = (abX * pointZ - abZ * pointX) / determinant;
  return {
    left: a.map[0] + across * (b.map[0] - a.map[0]) + down * (c.map[0] - a.map[0]),
    top: a.map[1] + across * (b.map[1] - a.map[1]) + down * (c.map[1] - a.map[1])
  };
}

for (const markerMap of markers.maps) {
  const map = Object.values(maps).find(candidate => candidate.tdevId === markerMap.id);
  if (!map) throw new Error(`${markerMap.name}: no renderer map configuration`);
  for (const collection of collections) {
    for (const marker of markerMap[collection] || []) {
      markerCount++;
      if (!Array.isArray(marker.position) || marker.position.length !== 3 || marker.position.some(value => !Number.isFinite(value))) {
        throw new Error(`${markerMap.name}/${collection}: invalid marker position`);
      }
      const position = project(map, marker.position[0], marker.position[2]);
      if (position.left < 0 || position.left > 100 || position.top < 0 || position.top > 100) edgeCount++;
    }
  }
  hazardCount += markerMap.hazards?.length || 0;
  keySpawnCount += (markerMap.looseLoot || []).filter(loot => (loot.items || []).some(id => knownKeys.has(id))).length;
  for (const lock of markerMap.locks || []) {
    if (!knownKeys.has(lock.keyId) || !markers.itemNames[lock.keyId]) throw new Error(`${markerMap.name}: lock key is not searchable`);
  }
  for (const container of markerMap.containers || []) {
    const type = markers.containerTypes?.[container.id];
    if (!markers.containerNames?.[container.id] || !type) throw new Error(`${markerMap.name}: container metadata is incomplete`);
    if (!layerIds.has(containerLayers[type] || "container-other")) throw new Error(`${markerMap.name}: container type ${type} has no layer`);
  }
}

if (markerCount < 15000) throw new Error(`Only ${markerCount} marker positions were found`);
if (!hazardCount) throw new Error("Minefield/sniper hazard data is missing");
if (!keySpawnCount) throw new Error("Key-spawn locations are missing");
if (Object.values(markers.containerNames || {}).some(name => /^[a-f0-9]{24} Name$/i.test(name))) {
  throw new Error("Untranslated container IDs are exposed as names");
}
if (edgeCount && !mapJs.includes("edge-clamped")) throw new Error(`${edgeCount} edge markers would be silently dropped`);

const taskIds = new Set((quests.tasks || []).map(task => String(task.id)));
if (taskIds.size !== quests.tasks?.length || taskIds.size < 500) throw new Error("Quest snapshot is incomplete or contains duplicate IDs");
let questLocationCount = 0;
for (const task of quests.tasks) {
  for (const requirement of task.taskRequirements || []) {
    if (!taskIds.has(String(requirement.task))) throw new Error(`${task.name}: missing prerequisite task`);
  }
  for (const objective of task.objectives || []) {
    for (const location of objective.locations || []) {
      questLocationCount++;
      if (![location.x, location.y, location.z].every(Number.isFinite)) throw new Error(`${task.name}: invalid quest position`);
    }
  }
}
if (questLocationCount < 900) throw new Error(`Only ${questLocationCount} quest locations were found`);
const traderIds = new Set((quests.traders || []).map(trader => String(trader.id)));
if (traderIds.size < 8) throw new Error("Trader progress metadata is incomplete");
for (const task of quests.tasks) {
  if (!("kappaRequired" in task) || !("lightkeeperRequired" in task) || !("traderRequirements" in task)) {
    throw new Error(`${task.name}: progress metadata is incomplete`);
  }
  for (const requirement of task.traderRequirements || [])
    if (!traderIds.has(String(requirement.trader))) throw new Error(`${task.name}: unknown trader requirement`);
}

for (const token of ["questAvailable", "questMatchesFilter", "progress-settings-changed", "completedQuests", "selectFloorByHotkey", "setFloorEditor", "save-floor-zones", "setIconScale", "--map-inverse-scale"]) {
  if (!mapJs.includes(token)) throw new Error(`Local parity feature is missing: ${token}`);
}
for (const token of ["icon-scale-preview", "icon-scale-changed", "setIconScaleControl"]) {
  if (!panelHtml.includes(token)) throw new Error(`Top-panel icon scaling is missing: ${token}`);
}
for (const token of ["map_use_progress", "map_quest_filter", "trader_levels", "completed_quests", "squad_enabled", "squad_mode", "squad_room", "squad_host", "map_visible_layers", "quest_panel_offset_x", "icon_scale"]) {
  if (!settingsCs.includes(token)) throw new Error(`Persistent setting is missing: ${token}`);
}
if (!mapCss.includes("--marker-scale") || !mapCss.includes("scale: var(--map-inverse-scale)")) {
  throw new Error("Map icons must support independent sizing and zoom-invariant screen dimensions");
}
if (!panelHtml.includes('id="iconScaleSlider"') || !panelHtml.includes('min="50" max="250"') || mapHtml.includes('id="iconScaleSlider"')) {
  throw new Error("The 50%-250% icon-scale control must live in the top control panel");
}
const requirementsPanelIndex = mapHtml.indexOf('id="requirementsPanel"');
const floorButtonsIndex = mapHtml.indexOf('id="floorButtons"');
const rightPanelTabsIndex = mapHtml.indexOf('class="right-panel-tabs"');
if (requirementsPanelIndex < 0 || floorButtonsIndex < requirementsPanelIndex || rightPanelTabsIndex < floorButtonsIndex) {
  throw new Error("The level selector must be the first section of the right-side panel");
}
if (!mapCss.includes(".level-shortcut") || !mapCss.includes("grid-template-columns: minmax(0,1fr) calc(92px * var(--ui-scale))")) {
  throw new Error("The original-style level selector layout is missing");
}
if (!floorManagerCs.includes("IsPointInPolygon(x, z") || !floorManagerCs.includes("y < zone.z_min")) {
  throw new Error("Floor zones must use X/Z polygons and Y height");
}
for (const token of ["239.255.38.73", "MulticastLoopback", "room", "PruneMembers", "DateTimeOffset.UtcNow.AddSeconds(-5)"]) {
  if (!squadSyncCs.includes(token)) throw new Error(`LAN squad sync is missing: ${token}`);
}
for (const token of ["host", "client", "ResolveServerEndpoint", "Rfc2898DeriveBytes.Pbkdf2", "AesGcm", "WTF2", "sequence", "CryptographicException"]) {
  if (!squadSyncCs.includes(token)) throw new Error(`Direct squad sync is missing: ${token}`);
}
for (const token of ["squadMode", "squadHost", "squadPassword", "setSquadStatus", "generateSquadPassword"]) {
  if (!mapJs.includes(token)) throw new Error(`Direct squad UI is missing: ${token}`);
}

const forwardSource = mapJs.match(/function quaternionForward\([^)]*\) \{[\s\S]*?\n  \}/)?.[0];
if (!forwardSource) throw new Error("Player quaternion conversion is missing");
const quaternionForward = vm.runInNewContext(`(${forwardSource})`);
const identityForward = quaternionForward(0, 0, 0, 1);
const rightForward = quaternionForward(0, Math.SQRT1_2, 0, Math.SQRT1_2);
if (Math.abs(identityForward.x) > 1e-9 || Math.abs(identityForward.z - 1) > 1e-9 ||
    Math.abs(rightForward.x - 1) > 1e-9 || Math.abs(rightForward.z) > 1e-9) {
  throw new Error("Player quaternion direction conversion is incorrect");
}
if (!/state\.mapFrame\.width/.test(mapJs) || !/state\.mapFrame\.height/.test(mapJs)) {
  throw new Error("Player heading ignores the displayed map aspect ratio");
}
for (const requiredBridgeToken of ["SendScreenshotPositionToMapAsync", "InvariantCulture", "setPlayerPosition", "selectFloor"]) {
  if (!whereAmICs.includes(requiredBridgeToken)) throw new Error(`Screenshot-to-map bridge is missing ${requiredBridgeToken}`);
}

console.log(`Verified ${layers.length} layers, ${markerCount} public markers (${hazardCount} hazards, ${keySpawnCount} key spawns, ${edgeCount} edge-pinned), ${battlePassCount} Battle Pass locations, ${questLocationCount} quest locations, progress/floor/squad parity, and screenshot direction bridging`);
