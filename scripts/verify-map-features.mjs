import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const repoRoot = resolve(import.meta.dirname, "..");
const mapJs = await readFile(resolve(repoRoot, "eft-where-am-i/html/map.js"), "utf8");
const mapCss = await readFile(resolve(repoRoot, "eft-where-am-i/html/map.css"), "utf8");
const mapHtml = await readFile(resolve(repoRoot, "eft-where-am-i/html/map.html"), "utf8");
const panelHtml = await readFile(resolve(repoRoot, "eft-where-am-i/html/panel.html"), "utf8");
const settingsHtml = await readFile(resolve(repoRoot, "eft-where-am-i/html/settings.html"), "utf8");
const formCs = await readFile(resolve(repoRoot, "eft-where-am-i/Form1.cs"), "utf8");
const formDesignerCs = await readFile(resolve(repoRoot, "eft-where-am-i/Form1.Designer.cs"), "utf8");
const whereAmICs = await readFile(resolve(repoRoot, "eft-where-am-i/UserControls/WhereAmI.cs"), "utf8");
const settingPageCs = await readFile(resolve(repoRoot, "eft-where-am-i/UserControls/SettingPage.cs"), "utf8");
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
let mapLabelCount = 0;

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
  for (const label of markerMap.labels || []) {
    mapLabelCount++;
    if (!label.text || !Array.isArray(label.position) || label.position.length !== 2 || label.position.some(value => !Number.isFinite(value)) ||
        ![label.bottom, label.top, label.size, label.rotation].every(Number.isFinite)) {
      throw new Error(`${markerMap.name}: invalid place-name label metadata`);
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
if (mapLabelCount < 250) throw new Error(`Only ${mapLabelCount} map place-name labels were found`);
if (!hazardCount) throw new Error("Minefield/sniper hazard data is missing");
if (!keySpawnCount) throw new Error("Key-spawn locations are missing");
if (Object.values(markers.containerNames || {}).some(name => /^[a-f0-9]{24} Name$/i.test(name))) {
  throw new Error("Untranslated container IDs are exposed as names");
}
if (edgeCount && !mapJs.includes("edge-clamped")) throw new Error(`${edgeCount} edge markers would be silently dropped`);

const taskIds = new Set((quests.tasks || []).map(task => String(task.id)));
if (taskIds.size !== quests.tasks?.length || taskIds.size < 500) throw new Error("Quest snapshot is incomplete or contains duplicate IDs");
let questLocationCount = 0;
const protectedQuestTerms = new Set([
  "Old Gas Station", "New Gas Station",
  ...Object.values(markers.itemNames || {}),
  ...Object.values(markers.containerNames || {}),
  ...markers.maps.flatMap(map => [
    map.name,
    ...(map.extracts || []).map(value => value.name),
    ...(map.transits || []).map(value => value.name),
    ...(map.bosses || []).map(value => value.name),
    ...(map.labels || []).map(value => value.text)
  ]),
  ...(quests.traders || []).map(value => value.name),
  ...(quests.tasks || []).flatMap(task => (task.neededKeys || []).flatMap(group => (group.keys || []).map(key => key.name)))
].filter(value => typeof value === "string" && value.trim().length >= 3));
const orderedProtectedQuestTerms = [...protectedQuestTerms].sort((a, b) => b.length - a.length);
function questTermPattern(term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const left = /^[A-Za-z0-9]/.test(term) ? "(?<![A-Za-z0-9])" : "";
  const right = /[A-Za-z0-9]$/.test(term) ? "(?![A-Za-z0-9])" : "";
  return new RegExp(`${left}${escaped}${right}`, "i");
}
function verifyQuestTranslation(taskName, kind, source, translated) {
  if (/__Q\d+_TERM\d+__/.test(translated || "")) throw new Error(`${taskName}/${kind}: unresolved translation placeholder`);
  let remaining = source;
  const selected = [];
  for (const term of orderedProtectedQuestTerms) {
    if (!questTermPattern(term).test(remaining)) continue;
    remaining = remaining.replace(new RegExp(questTermPattern(term).source, "gi"), match => {
      selected.push(match);
      return `__SELECTED${selected.length - 1}__`;
    });
  }
  for (const term of selected) {
    if (!questTermPattern(term).test(translated)) throw new Error(`${taskName}/${kind}: protected item/location name changed: ${term}`);
  }
}
for (const task of quests.tasks) {
  for (const requirement of task.taskRequirements || []) {
    if (!taskIds.has(String(requirement.task))) throw new Error(`${task.name}: missing prerequisite task`);
  }
  for (const objective of task.objectives || []) {
    if (!objective.descriptionKo || !/[가-힣]/.test(objective.descriptionKo)) {
      throw new Error(`${task.name}/${objective.description}: Korean objective translation is missing`);
    }
    verifyQuestTranslation(task.name, "objective", objective.description, objective.descriptionKo);
    for (const location of objective.locations || []) {
      questLocationCount++;
      if (![location.x, location.y, location.z].every(Number.isFinite)) throw new Error(`${task.name}: invalid quest position`);
    }
  }
}
if (questLocationCount < 900) throw new Error(`Only ${questLocationCount} quest locations were found`);
const questMapRows = new Set();
for (const [mapKey, map] of Object.entries(maps)) {
  const mapIds = new Set([map.tdevId, ...(map.tdevAliases || [])]);
  for (const task of quests.tasks) {
    const belongs = (task.objectives || []).some(objective =>
      (objective.maps || []).some(mapId => mapIds.has(mapId)) ||
      (objective.locations || []).some(location => mapIds.has(location.map)));
    if (belongs) questMapRows.add(`${mapKey}:${task.id}`);
  }
}
if (questMapRows.size < 500) throw new Error(`Only ${questMapRows.size} map-specific quest rows can be displayed`);
const traderIds = new Set((quests.traders || []).map(trader => String(trader.id)));
if (traderIds.size < 8) throw new Error("Trader progress metadata is incomplete");
for (const task of quests.tasks) {
  if (!("kappaRequired" in task) || !("lightkeeperRequired" in task) || !("traderRequirements" in task)) {
    throw new Error(`${task.name}: progress metadata is incomplete`);
  }
  for (const requirement of task.traderRequirements || [])
    if (!traderIds.has(String(requirement.trader))) throw new Error(`${task.name}: unknown trader requirement`);
}

for (const token of ["questAvailable", "questMatchesFilter", "objectiveBelongsToMap", "currentMapIds", "tdevAliases", "progress-settings-changed", "completedQuests", "selectFloorByHotkey", "setFloorEditor", "save-floor-zones", "setIconScale", "--map-inverse-scale", "questDisplayName", "descriptionKo", "renderMapLabels"]) {
  if (!mapJs.includes(token)) throw new Error(`Local parity feature is missing: ${token}`);
}
if (!/function questDisplayName\(quest\)\s*\{\s*return quest\.name;\s*\}/.test(mapJs)) {
  throw new Error("Quest names must remain in English in every language mode");
}
for (const token of ["icon-scale-preview", "icon-scale-changed", "setIconScaleControl", "font-scale-preview", "font-scale-changed", "setFontScaleControl"]) {
  if (!panelHtml.includes(token)) throw new Error(`Top-panel icon scaling is missing: ${token}`);
}
for (const token of ["map_use_progress", "map_quest_filter", "trader_levels", "completed_quests", "map_visible_layers", "quest_panel_offset_x", "font_scale", "icon_scale", "squad_mode", "squad_host", "squad_port"]) {
  if (!settingsCs.includes(token)) throw new Error(`Persistent setting is missing: ${token}`);
}
if (!mapCss.includes("--marker-scale") || !mapCss.includes("scale: var(--map-inverse-scale)")) {
  throw new Error("Map icons must support independent sizing and zoom-invariant screen dimensions");
}
for (const token of [".position-marker", "#8a2be2", "width: calc(20px * var(--marker-scale))", "border: calc(2px * var(--marker-scale)) solid #70a800", ".squad-marker", "#2b84e2", ".position-heading"]) {
  if (!mapCss.includes(token)) throw new Error(`Player/squad marker styling is missing: ${token}`);
}
const upstreamDirectionSvg = "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4IDEwIj48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg0LCA0KSBzY2FsZSgwLjcpIHRyYW5zbGF0ZSgtNCwgLTQpIj48cG9seWdvbiBwb2ludHM9IjQsMCA3LjUsOCAwLjUsOCIgZmlsbD0iIzhhMmJlMiIgc3Ryb2tlPSIjNzBhODAwIiBzdHJva2Utd2lkdGg9IjAuNSIvPjwvZz48L3N2Zz4=";
if (!mapCss.includes(upstreamDirectionSvg)) throw new Error("The player direction marker must reuse the exact SVG embedded by the upstream source");
for (const token of ["squadMembers: []", "renderPositionMarker", "playerHeadingOnMap(position)", "setSquadMembers"]) {
  if (!mapJs.includes(token)) throw new Error(`Player/squad marker behavior is missing: ${token}`);
}
if (!mapHtml.includes('id="mapLabelLayer"') || !mapCss.includes(".map-place-label") || !mapCss.includes("-webkit-text-stroke: .5px #000")) {
  throw new Error("Original-style map place-name rendering is missing");
}
if (!panelHtml.includes('id="iconScaleSlider"') || !panelHtml.includes('min="50" max="650"') || mapHtml.includes('id="iconScaleSlider"')) {
  throw new Error("The 50%-650% icon-scale control must live in the top control panel");
}
const fontScaleIndex = panelHtml.indexOf('id="fontScaleSlider"');
const iconScaleIndex = panelHtml.indexOf('id="iconScaleSlider"');
if (fontScaleIndex < 0 || fontScaleIndex > iconScaleIndex || !panelHtml.includes('min="50" max="150"') ||
    !mapJs.includes("Math.min(1.5") || !mapCss.includes("--font-scale")) {
  throw new Error("The 50%-150% font-size control must appear above the icon-size control and affect map text");
}
for (const token of ["mergedBossSpawns", "group.names.join(\" / \")", "[...new Set(details)].join(\"\\n\")"]) {
  if (!mapJs.includes(token)) throw new Error(`Overlapping boss markers are not merged correctly: ${token}`);
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
for (const token of ['id="leftPanelResize"', 'id="rightPanelResize"']) {
  if (!mapHtml.includes(token)) throw new Error(`Resizable side-panel handle is missing: ${token}`);
}
for (const token of ["beginPanelResize", "setPanelWidth", "eft-left-panel-width", "eft-right-panel-width"]) {
  if (!mapJs.includes(token)) throw new Error(`Resizable side-panel behavior is missing: ${token}`);
}
if (!mapCss.includes(".map-marker-label") || !/extract\.transferItem\?\.item \|\| null, true\)/.test(mapJs)) {
  throw new Error("Extraction names must be rendered beside extraction markers");
}
for (const token of ["squadToggle", "squadDialog", "squad-settings-changed", "setSquadStatus"]) {
  if (!mapHtml.includes(token) && !mapJs.includes(token)) throw new Error(`Squad connection UI is missing: ${token}`);
}
for (const token of ["ConfigureSquadSync", "UpdatePose", "OnSquadMembersChanged", "setSquadMembers"]) {
  if (!whereAmICs.includes(token)) throw new Error(`Squad application bridge is missing: ${token}`);
}
for (const removedLegacyServerUi of ["serverLocation_Title", "serverLocation_HistoryTitle", "ServerLocation"]) {
  if (mapHtml.includes(removedLegacyServerUi) || panelHtml.includes(removedLegacyServerUi) || settingsHtml.includes(removedLegacyServerUi) ||
      formCs.includes(removedLegacyServerUi) || formDesignerCs.includes(removedLegacyServerUi) || whereAmICs.includes(removedLegacyServerUi)) {
    throw new Error(`Removed legacy server-location screen is still reachable: ${removedLegacyServerUi}`);
  }
}
for (const settingsToken of ["SettingPage", "settingPageControl", "btnSetting_Click"]) {
  if (!formCs.includes(settingsToken)) throw new Error(`Left-side settings screen is missing: ${settingsToken}`);
}
if (!formDesignerCs.includes("btnWhereAmI") || !formDesignerCs.includes("btnSetting") || formDesignerCs.includes("btnServerLocation")) {
  throw new Error("The left navigation must contain only the map and settings screen buttons");
}
if (!settingPageCs.includes("html/settings.html") || !settingsHtml.includes('id="iconScaleSlider"')) {
  throw new Error("The restored settings screen is incomplete");
}
if (!settingsHtml.includes('min="50" max="650"') || !mapJs.includes("Math.min(6.5") ||
    !whereAmICs.includes(", 0.5, 6.5)") || !settingPageCs.includes(", 0.5, 6.5)")) {
  throw new Error("Icon scaling must be enforced from 50% through 650% in every settings path");
}
if (!settingsHtml.includes('id="fontScaleSlider"') || !settingsHtml.includes('min="50" max="150"') ||
    !whereAmICs.includes(", 0.5, 1.5)") || !settingPageCs.includes(", 0.5, 1.5)")) {
  throw new Error("Font scaling must be enforced from 50% through 150% in every settings path");
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

console.log(`Verified ${layers.length} layers, ${markerCount} public markers (${hazardCount} hazards, ${keySpawnCount} key spawns, ${edgeCount} edge-pinned), ${mapLabelCount} place-name labels, ${battlePassCount} Battle Pass locations, ${questLocationCount} quest coordinates and ${questMapRows.size} map-specific quest rows, extraction labels, resizable panels, squad pose bridging, progress/floor parity, and screenshot direction bridging`);
