(() => {
  "use strict";

  const QUEST_DATA_URL = "quest-locations.json";
  const MARKER_DATA_URL = "map-markers.json";
  const BATTLE_PASS_DATA_URL = "battle-pass-locations.json";
  const SVG_ROOT = "maps/svg";
  const MAPS = {
    factory: { dataKey: "factory", id: 0, tdevId: "55f2d3fd4bdc2d5f408b4567", svg: "Factory.svg", floors: ["Basement", "Ground_Floor", "Second_Floor", "Third_Floor"], defaultFloor: "Ground_Floor", rotation: 90, bounds: [[77, -64.5], [-65.5, 67.4]], anchors: [{ world: [77, 67.4], map: [0, 0] }, { world: [77, -64.5], map: [100, 0] }, { world: [-65.5, 67.4], map: [0, 100] }] },
    customs: { dataKey: "customs", id: 1, tdevId: "56f40101d2720b2a4d8b45d6", svg: "Customs.svg", floors: ["Underground_Level", "Ground_Level", "Second_Floor", "Third_Floor"], defaultFloor: "Ground_Level", rotation: 180, bounds: [[698, -307], [-372, 237]], anchors: [{ world: [698, -307], map: [0, 0] }, { world: [-372, -307], map: [100, 0] }, { world: [698, 237], map: [0, 100] }] },
    woods: { dataKey: "woods", id: 2, tdevId: "5704e3c2d2720bac5b8b4567", svg: "Woods.svg", floors: ["Ground_Level"], defaultFloor: "Ground_Level", rotation: 180, bounds: [[646, -914], [-761, 442]], anchors: [{ world: [646, -914], map: [0, 0] }, { world: [-761, -914], map: [100, 0] }, { world: [646, 442], map: [0, 100] }] },
    shoreline: { dataKey: "shoreline", id: 3, tdevId: "5704e554d2720bac5b8b456e", svg: "Shoreline.svg", floors: ["Underground_Level", "Ground_Level", "Second_Floor", "Third_Floor"], defaultFloor: "Ground_Level", rotation: 180, bounds: [[504, -415], [-1056, 618]], anchors: [{ world: [504, -415], map: [0, 0] }, { world: [-1056, -415], map: [100, 0] }, { world: [504, 618], map: [0, 100] }] },
    interchange: { dataKey: "interchange", id: 4, tdevId: "5714dbc024597771384a510d", svg: "Interchange.svg", floors: ["Ground_Level", "First_Floor", "Second_Floor"], defaultFloor: "Ground_Level", rotation: 180, bounds: [[598, -442], [-433, 426]], anchors: [{ world: [598, -442], map: [0, 0] }, { world: [-433, -442], map: [100, 0] }, { world: [598, 426], map: [0, 100] }] },
    lab: { dataKey: "lab", id: 5, tdevId: "5b0fc42d86f7744a585f9105", svg: "Labs.svg", floors: ["Technical_Level", "First_Level", "Second_Level"], defaultFloor: "Technical_Level", rotation: 270, bounds: [[-80, -477], [-287, -193]], anchors: [{ world: [-287, -477], map: [0, 0] }, { world: [-287, -193], map: [100, 0] }, { world: [-80, -477], map: [0, 100] }] },
    reserve: { dataKey: "reserve", id: 6, tdevId: "5704e5fad2720bc05b8b4567", svg: "Reserve.svg", floors: ["Bunkers", "Ground_Level"], defaultFloor: "Ground_Level", rotation: 180, bounds: [[289, -274], [-303, 272]], anchors: [{ world: [289, -274], map: [0, 0] }, { world: [-303, -274], map: [100, 0] }, { world: [289, 272], map: [0, 100] }] },
    lighthouse: { dataKey: "lighthouse", id: 7, tdevId: "5704e4dad2720bb55b8b4567", svg: "Lighthouse.svg", floors: ["Ground_Level"], defaultFloor: "Ground_Level", rotation: 180, bounds: [[515, -998], [-545, 725]], anchors: [{ world: [515, -998], map: [0, 0] }, { world: [-545, -998], map: [100, 0] }, { world: [515, 725], map: [0, 100] }] },
    streets: { dataKey: "streetsoftarkov", id: 8, tdevId: "5714dc692459777137212e12", svg: "StreetsOfTarkov.svg", floors: ["Underground_Level", "Ground_Level", "Second_Floor", "Third_Floor", "Fourth_Floor", "Fifth_Floor"], defaultFloor: "Ground_Level", rotation: 180, bounds: [[323, -295], [-280, 532]], anchors: [{ world: [323, -295], map: [0, 0] }, { world: [-280, -295], map: [100, 0] }, { world: [323, 532], map: [0, 100] }] },
    "ground-zero": { dataKey: "groundzero", id: 9, tdevId: "653e6760052c01c1c805532f", svg: "GroundZero.svg", floors: ["Underground_Level", "Ground_Level", "Second_Floor", "Third_Floor"], defaultFloor: "Ground_Level", rotation: 180, bounds: [[249, -124], [-99, 364]], anchors: [{ world: [249, -124], map: [0, 0] }, { world: [-99, -124], map: [100, 0] }, { world: [249, 364], map: [0, 100] }] },
    terminal: { dataKey: "terminal", id: 10, tdevId: "65cc8f81a9aac3e77d0cfd3e", svg: "Terminal.svg", floors: ["Ground_Level"], defaultFloor: "Ground_Level", rotation: 180, bounds: [[463, -580], [-433, 475]], anchors: [{ world: [463, -580], map: [0, 0] }, { world: [-433, -580], map: [100, 0] }, { world: [463, 475], map: [0, 100] }] },
    labyrinth: { dataKey: "the-labyrinth", id: 11, tdevId: "6733700029c367a3d40b02af", tiles: "maps/tiles/labyrinth/main/{z}/{x}/{y}.png", tileZoom: 2, floors: ["Main"], defaultFloor: "Main", rotation: 270, bounds: [[-52, -37], [53, 76]], anchors: [{ world: [-52, -37], map: [0, 0] }, { world: [-52, 76], map: [100, 0] }, { world: [53, -37], map: [0, 100] }] },
    icebreaker: { dataKey: "icebreaker", id: 12, tdevId: "69af492a4819ea4ba10a69c5", tiles: "maps/tiles/icebreaker/{layer}/{z}/{x}/{y}.png", tileZoom: 2, tileLayers: { "Control_Room": "00_control_room", "Engine_Room": "01_engine_room", "Engine_Room_Upper": "02_engine_room_upper", "Fuel_Pumps_Lower": "03_fuel_pumps_lower", "Fuel_Pumps": "04_fuel_pumps", "Storage_Security": "05_storage_ecurity", "Infirmary": "06_infirmary", "Helipad": "07_helipad", "Gym_Canteen": "08_gym-canteen", "Accommodation_Lower": "09_accommodation_lower", "Accommodation_Mid": "10_accommodation_mid", "Accommodation_Upper": "11_accommodation_upper", "Officers_Deck": "12_officers_deck", "Stairs_Blocked": "13_stairs_blocked", "Bridge": "14_bridge", "Bridge_Roof": "15_bridge_roof" }, floors: ["Control_Room", "Engine_Room", "Engine_Room_Upper", "Fuel_Pumps_Lower", "Fuel_Pumps", "Storage_Security", "Infirmary", "Helipad", "Gym_Canteen", "Accommodation_Lower", "Accommodation_Mid", "Accommodation_Upper", "Officers_Deck", "Stairs_Blocked", "Bridge", "Bridge_Roof"], defaultFloor: "Infirmary", rotation: 180, bounds: [[77, -64.5], [-65.5, 67.4]], anchors: [{ world: [77, -64.5], map: [0, 0] }, { world: [-65.5, -64.5], map: [100, 0] }, { world: [77, 67.4], map: [0, 100] }] }
  };
  const FLOOR_ALIASES = {};
  const LAYERS = [
    { id: "extract-pmc", group: "Extractions", label: "PMC extraction", icon: "extraction", color: "#70a800" },
    { id: "extract-scav", group: "Extractions", label: "Scav extraction", icon: "extraction", color: "#aeaeb0" },
    { id: "extract-coop", group: "Extractions", label: "Co-op extraction", icon: "extraction", color: "#9a8866" },
    { id: "transit", group: "Extractions", label: "Transit", icon: "transit", color: "#aeaeb0" },
    { id: "spawn-pmc", group: "Spawns", label: "PMC spawn", icon: "spawn", color: "#70a800" },
    { id: "spawn-scav", group: "Spawns", label: "Scav spawn", icon: "spawn", color: "#aeaeb0" },
    { id: "spawn-aipmc", group: "Spawns", label: "AI PMC spawn", icon: "spawn", color: "#879860" },
    { id: "spawn-sniper", group: "Spawns", label: "Sniper Scav", icon: "sniper", color: "#aeaeb0" },
    { id: "boss", group: "Spawns", label: "Boss spawn", icon: "skull", color: "#ff2020" },
    { id: "cultist", group: "Spawns", label: "Cultist spawn", icon: "skull", color: "#b75bd6" },
    { id: "rogue", group: "Spawns", label: "Rogue spawn", icon: "skull", color: "#dc774f" },
    { id: "raider", group: "Spawns", label: "Raider spawn", icon: "skull", color: "#ca5d67" },
    { id: "lock", group: "Keys", label: "All unlocks", icon: "lock", color: "#9a8866" },
    { id: "lock-door", group: "Keys", label: "Locked room / door", icon: "lock", color: "#9a8866" },
    { id: "lock-container", group: "Keys", label: "Locked container", icon: "lock", color: "#9a8866" },
    { id: "lock-trunk", group: "Keys", label: "Locked trunk", icon: "lock", color: "#9a8866" },
    { id: "key-spawn", group: "Keys", label: "Key spawn", icon: "key", color: "#9a8866" },
    { id: "switch", group: "Map", label: "Lever / switch", icon: "switch", color: "#9a8866" },
    { id: "stationary", group: "Map", label: "Stationary weapon", icon: "weapon", color: "#9a8866" },
    { id: "btr", group: "Map", label: "BTR stop", icon: "btr", color: "#9a8866" },
    { id: "hazard-mine", group: "Map", label: "Minefield", icon: "mine", color: "#ff2020" },
    { id: "hazard-sniper", group: "Map", label: "Sniper boundary", icon: "sniper", color: "#ff2020" },
    { id: "container-cache", group: "Loot", label: "Cache", icon: "box", color: "#9a8866" },
    { id: "container-ammo", group: "Loot", label: "Ammo box", icon: "bullet", color: "#9a8866" },
    { id: "container-grenade", group: "Loot", label: "Grenade box", icon: "grenade", color: "#9a8866" },
    { id: "container-weapon", group: "Loot", label: "Weapon box", icon: "weapon", color: "#9a8866" },
    { id: "container-register", group: "Loot", label: "Cash register", icon: "cash", color: "#9a8866" },
    { id: "container-body", group: "Loot", label: "Dead body", icon: "body", color: "#9a8866" },
    { id: "container-jacket", group: "Loot", label: "Jacket", icon: "jacket", color: "#9a8866" },
    { id: "container-drawer", group: "Loot", label: "Drawer", icon: "drawer", color: "#9a8866" },
    { id: "container-bag", group: "Loot", label: "Sports bag", icon: "bag", color: "#9a8866" },
    { id: "container-suitcase", group: "Loot", label: "Suitcase", icon: "suitcase", color: "#9a8866" },
    { id: "container-crate", group: "Loot", label: "Wooden crate", icon: "box", color: "#9a8866" },
    { id: "container-toolbox", group: "Loot", label: "Toolbox", icon: "tools", color: "#9a8866" },
    { id: "container-pc", group: "Loot", label: "PC block", icon: "pc", color: "#9a8866" },
    { id: "container-medcase", group: "Loot", label: "Medcase", icon: "med", color: "#9a8866" },
    { id: "container-medbag", group: "Loot", label: "Medbag", icon: "med", color: "#9a8866" },
    { id: "container-safe", group: "Loot", label: "Safe", icon: "safe", color: "#9a8866" },
    { id: "container-stash", group: "Loot", label: "Shturman's stash", icon: "box", color: "#9a8866" },
    { id: "container-technical", group: "Loot", label: "Technical supply crate", icon: "tools", color: "#9a8866" },
    { id: "container-medical", group: "Loot", label: "Medical supply crate", icon: "med", color: "#9a8866" },
    { id: "container-ration", group: "Loot", label: "Ration supply crate", icon: "box", color: "#9a8866" },
    { id: "container-other", group: "Loot", label: "Other container", icon: "box", color: "#9a8866" },
    { id: "loose-item", group: "Loot", label: "Loose item", icon: "item", color: "#9a8866" },
    { id: "battle-pass", group: "Loot", label: "Battle Pass", icon: "star", color: "#0b63d8" }
  ];
  const LAYER_BY_ID = new Map(LAYERS.map(layer => [layer.id, layer]));
  const CONTAINER_LAYER_BY_TYPE = {
    "buried-barrel-cache": "container-cache", "ground-cache": "container-cache",
    "wooden-ammo-box": "container-ammo", "grenade-box": "container-grenade", "weapon-box": "container-weapon",
    "bank-cash-register": "container-register", "cash-register": "container-register",
    "civilian-body": "container-body", "dead-scav": "container-body", "lab-technician-body": "container-body",
    "pmc-body": "container-body", "scav-body": "container-body", jacket: "container-jacket", drawer: "container-drawer",
    "duffle-bag": "container-bag", "plastic-suitcase": "container-suitcase", "wooden-crate": "container-crate",
    toolbox: "container-toolbox", "pc-block": "container-pc", medcase: "container-medcase", "medbag-smu06": "container-medbag",
    safe: "container-safe", "bank-safe": "container-safe", "shturmans-stash": "container-stash",
    "technical-supply-crate": "container-technical", "medical-supply-crate": "container-medical",
    "ration-supply-crate": "container-ration"
  };

  const state = {
    mapKey: new URLSearchParams(location.search).get("map") || "interchange",
    map: null,
    quests: [],
    traders: [],
    markerData: null,
    battlePassData: null,
    mapMarkers: null,
    keyItemIds: new Set(),
    visibleLayers: new Set(["extract-pmc", "extract-scav", "extract-coop", "transit"]),
    focusedItemId: null,
    rulerActive: false,
    measurePoints: [],
    squadMembers: [],
    pinned: new Set(),
    currentFloor: "",
    markerMode: "arrows",
    panelPosition: "right",
    panelOffset: { x: -1, y: -1 },
    wallColors: false,
    uiScale: 1,
    iconScale: 1,
    transform: { x: 0, y: 0, scale: 1 },
    svgAspect: 1,
    mapFrame: { left: 0, top: 0, width: 1, height: 1 },
    player: null,
    language: "en",
    progress: { useProgress: false, filter: "all", edition: "standard", faction: "Any", playerLevel: 1, traderLevels: {}, completedQuests: new Set() },
    squad: { enabled: false, mode: "off", name: "Player", room: "eft-local", host: "", password: "", port: 38473 },
    squadStatus: { mode: "off", state: "off", message: "Squad sharing is off." },
    floorEditor: { enabled: false, zones: [], floors: [], vertices: [] }
  };

  const el = Object.fromEntries([
    "content", "leftPanel", "layerDrawer", "layerList", "layersToggle", "mapSearch", "mapSearchResults", "markerDataStatus",
    "selectedItem", "questDrawer", "questList", "questSearch", "questStatus", "floorButtons", "mapViewport",
    "mapWorld", "svgHost", "markerLayer", "mapStatus", "requirementsPanel", "requirementsHandle",
    "requirementsList", "pinCount", "wallToggle", "markerMode", "panelPosition", "iconScaleLabel", "iconScaleSlider", "iconScaleValue", "questToggle", "pinnedToggle", "pinnedDrawer", "questCount",
    "rulerToggle", "measurementLayer", "rulerReadout", "markerPopup", "hidePanels", "fullScreen", "whereAmI", "coordinatesReadout", "mapHelp",
    "zoomIn", "zoomOut", "zoomReset", "progressToggle", "floorEditToggle", "progressDialog", "progressForm", "useProgress",
    "questFilterButtons", "gameEdition", "playerFaction", "playerLevel", "traderLevels", "resetProgress",
    "saveProgress", "questFilterSummary", "squadToggle", "squadCount", "squadDialog", "squadForm",
    "squadMode", "squadName", "squadRoom", "squadHost", "squadPassword", "squadPort", "squadMembers", "saveSquad",
    "squadRoomLabel", "squadHostLabel", "squadPasswordLabel", "generateSquadPassword", "squadHelp", "squadStatus",
    "floorEditorPanel", "floorEditorExit", "floorZoneName", "floorZoneFloor", "floorZoneMin", "floorZoneMax",
    "floorUndo", "floorComplete", "floorDelete", "floorEditorStatus", "floorSave"
  ].map(id => [id, document.getElementById(id)]));

  function post(action, data = {}) {
    if (window.chrome?.webview) window.chrome.webview.postMessage(JSON.stringify({ action, ...data }));
  }

  function iconSvg(name, className = "marker-icon") {
    return `<svg class="${className}" viewBox="0 0 32 32" aria-hidden="true"><use href="#icon-${escapeHtml(name)}"></use></svg>`;
  }

  function normalizeMapKey(key) {
    const value = String(key || "").toLowerCase();
    if (value === "streetsoftarkov" || value === "streets-of-tarkov") return "streets";
    if (value === "groundzero") return "ground-zero";
    return MAPS[value] ? value : "interchange";
  }

  function friendlyFloor(name) {
    return name.replaceAll("_", " ").replace("Level", "Lvl").replace("Floor", "F");
  }

  function floorRank(name) {
    const n = String(name || "").toLowerCase();
    if (/underground|basement|bunker|technical/.test(n)) return -1;
    if (/ground|main/.test(n)) return 0;
    if (/first|1st/.test(n)) return 1;
    if (/second|2nd/.test(n)) return 2;
    if (/third|3rd/.test(n)) return 3;
    if (/fourth|4th/.test(n)) return 4;
    if (/fifth|5th/.test(n)) return 5;
    return null;
  }

  function mapFloorRank(name) {
    if (!state.map) return floorRank(name);
    name = FLOOR_ALIASES[state.mapKey]?.[name] || name;
    const exact = state.map.floors.indexOf(name);
    if (exact >= 0) return exact;
    const wanted = String(name || "").toLowerCase().replaceAll("_", " ");
    const fuzzy = state.map.floors.findIndex(value => value.toLowerCase().replaceAll("_", " ") === wanted);
    return fuzzy >= 0 ? fuzzy : floorRank(name);
  }

  async function loadMap(mapKey) {
    state.mapKey = normalizeMapKey(mapKey);
    state.map = MAPS[state.mapKey];
    state.mapMarkers = state.markerData?.maps?.find(map => map.id === state.map.tdevId) || null;
    state.focusedItemId = null;
    state.measurePoints = [];
    state.currentFloor = state.map.defaultFloor;
    setSquadMembers(state.squadMembers);
    if (state.floorEditor.enabled) setFloorEditor(false);
    el.mapStatus.textContent = `Loading ${state.mapKey}…`;
    renderFloorButtons();
    try {
      if (state.map.svg) {
        const response = await fetch(`${SVG_ROOT}/${state.map.svg}`, { cache: "force-cache" });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const text = await response.text();
        const doc = new DOMParser().parseFromString(text, "image/svg+xml");
        const svg = doc.documentElement;
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        el.svgHost.replaceChildren(document.importNode(svg, true));
        const viewBox = String(svg.getAttribute("viewBox") || "0 0 1 1").trim().split(/[\s,]+/).map(Number);
        state.svgAspect = viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0 ? viewBox[2] / viewBox[3] : 1;
      } else if (state.map.tiles) {
        state.svgAspect = 1;
        renderTileMap();
      } else throw new Error("No public map artwork is configured");
      layoutMapWorld();
      applyFloor();
      applyMonochromePalette();
      applyWallPalette();
      renderQuests();
      renderLayerList();
      renderSearchResults();
      renderMarkers();
      renderMeasurement();
      resetView();
      el.mapStatus.textContent = `tarkov.dev ${state.map.svg ? "SVG" : "tiles"} · wheel to zoom · Alt+wheel for floors · drag to pan`;
      post("map-ready", { map: state.mapKey });
    } catch (error) {
      el.mapStatus.textContent = `Map load failed: ${error.message}`;
    }
  }

  function renderTileMap() {
    if (!state.map?.tiles) return;
    const zoom = Number(state.map.tileZoom || 2);
    const size = 2 ** zoom;
    const layer = state.map.tileLayers?.[state.currentFloor] || "main";
    const grid = document.createElement("div");
    grid.className = "tile-grid";
    grid.style.setProperty("--tile-count", size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const image = document.createElement("img");
      image.alt = "";
      image.draggable = false;
      image.src = state.map.tiles.replace("{layer}", layer).replace("{z}", zoom).replace("{x}", x).replace("{y}", y);
      grid.append(image);
    }
    el.svgHost.replaceChildren(grid);
  }

  async function loadQuests() {
    try {
      const response = await fetch(QUEST_DATA_URL, { cache: "no-cache" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const snapshot = await response.json();
      state.quests = snapshot.tasks || [];
      state.traders = snapshot.traders || [];
      el.questStatus.hidden = true;
      renderProgressForm();
      renderQuests();
      renderRequirements();
      renderMarkers();
    } catch (error) {
      el.questStatus.hidden = false;
      el.questStatus.textContent = `Quest data load failed: ${error.message}`;
    }
  }

  async function loadMarkerData() {
    try {
      const response = await fetch(MARKER_DATA_URL, { cache: "no-cache" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      state.markerData = await response.json();
      state.keyItemIds = new Set(state.markerData.keyItemIds || []);
      state.mapMarkers = state.markerData.maps?.find(map => map.id === state.map?.tdevId) || null;
      el.markerDataStatus.hidden = true;
      renderLayerList();
      renderSearchResults();
      renderMarkers();
    } catch (error) {
      el.markerDataStatus.hidden = false;
      el.markerDataStatus.textContent = `Map marker data load failed: ${error.message}`;
    }
  }

  async function loadBattlePassData() {
    try {
      const response = await fetch(BATTLE_PASS_DATA_URL, { cache: "no-cache" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      state.battlePassData = await response.json();
      renderLayerList();
      renderMarkers();
    } catch (error) {
      console.warn(`Battle Pass marker data load failed: ${error.message}`);
    }
  }

  function mapQuests() {
    if (!state.map) return [];
    return state.quests.filter(quest => quest.objectives?.some(objective => objectiveLocationsOnMap(objective).length));
  }

  function compareRequirement(actual, method, wanted) {
    if (method === ">") return actual > wanted;
    if (method === "<") return actual < wanted;
    if (method === "<=") return actual <= wanted;
    if (method === "==" || method === "=") return actual === wanted;
    return actual >= wanted;
  }

  function questAvailable(quest) {
    if (!state.progress.useProgress) return true;
    if (Number(quest.minPlayerLevel || 0) > state.progress.playerLevel) return false;
    if (quest.factionName && quest.factionName !== "Any" && state.progress.faction !== "Any" && quest.factionName !== state.progress.faction) return false;
    for (const requirement of quest.taskRequirements || []) {
      if (!state.progress.completedQuests.has(String(requirement.task))) return false;
    }
    for (const requirement of quest.traderRequirements || []) {
      const actual = Number(state.progress.traderLevels[String(requirement.trader)] || 1);
      if (!compareRequirement(actual, requirement.compareMethod, Number(requirement.value || 0))) return false;
    }
    return true;
  }

  function questMatchesFilter(quest) {
    if (state.progress.filter === "kappa") return Boolean(quest.kappaRequired);
    if (state.progress.filter === "story") return !quest.lightkeeperRequired;
    return true;
  }

  function objectiveLocationsOnMap(objective) {
    if (!state.map) return [];
    return (objective.locations || []).filter(location => location.map === state.map.tdevId);
  }

  function renderQuests() {
    const query = el.questSearch.value.trim().toLowerCase();
    const fragment = document.createDocumentFragment();
    const visible = mapQuests().filter(quest => questMatchesFilter(quest) && questAvailable(quest) &&
      (!query || quest.name.toLowerCase().includes(query)));
    if (el.questCount) el.questCount.textContent = `(${visible.length})`;
    el.questFilterSummary.textContent = `${state.progress.filter[0].toUpperCase()}${state.progress.filter.slice(1)} · ${visible.length} quests${state.progress.useProgress ? " · available now" : ""}`;
    for (const quest of visible) {
      const completed = state.progress.completedQuests.has(String(quest.id));
      const label = document.createElement("label");
      label.className = "quest-row";
      label.classList.toggle("completed", completed);
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.pinned.has(String(quest.id)) || state.pinned.has(quest.name);
      checkbox.addEventListener("change", () => toggleQuest(quest, checkbox.checked));
      const text = document.createElement("span");
      text.className = "quest-copy";
      const locations = quest.objectives.reduce((count, objective) => count + objectiveLocationsOnMap(objective).length, 0);
      text.innerHTML = `<strong>${escapeHtml(quest.name)}</strong><small>${locations} map location${locations === 1 ? "" : "s"}</small>`;
      const complete = document.createElement("button");
      complete.type = "button";
      complete.className = `quest-complete${completed ? " done" : ""}`;
      complete.textContent = completed ? "Done" : "Mark done";
      complete.addEventListener("click", event => { event.preventDefault(); toggleQuestCompletion(quest); });
      label.append(checkbox, text, complete);
      fragment.append(label);
    }
    el.questList.replaceChildren(fragment);
  }

  function toggleQuestCompletion(quest) {
    const id = String(quest.id);
    state.progress.completedQuests.has(id) ? state.progress.completedQuests.delete(id) : state.progress.completedQuests.add(id);
    persistProgress();
    renderQuests();
    renderRequirements();
  }

  function toggleQuest(quest, selected) {
    const id = String(quest.id);
    selected ? state.pinned.add(id) : state.pinned.delete(id);
    state.pinned.delete(quest.name);
    post("quest-toggled", { questId: id, questName: quest.name, isSelected: selected });
    renderMarkers();
    renderRequirements();
  }

  function pinnedQuests() {
    return state.quests.filter(q => state.pinned.has(String(q.id)) || state.pinned.has(q.name));
  }

  function describeObjective(objective) {
    const count = objective.count && objective.count !== 1 ? `${objective.count}× ` : "";
    const optional = objective.optional ? " (optional)" : "";
    return `${count}${objective.description || objective.type || "Objective"}${optional}`;
  }

  function renderRequirements() {
    const quests = pinnedQuests();
    el.pinCount.textContent = String(quests.length);
    if (!quests.length) {
      el.requirementsList.innerHTML = '<p class="empty-state">Pin a quest to show only its requirements here.</p>';
      return;
    }
    const byId = new Map(state.quests.map(q => [String(q.id), q]));
    const fragment = document.createDocumentFragment();
    for (const quest of quests) {
      const card = document.createElement("article");
      card.className = "requirement-card";
      card.dataset.questId = String(quest.id);
      const requirements = [];
      if (quest.minPlayerLevel) requirements.push(`Player level ${quest.minPlayerLevel}+`);
      for (const requirement of quest.taskRequirements || []) {
        const required = byId.get(String(requirement.task));
        if (required) requirements.push(`${state.progress.completedQuests.has(String(requirement.task)) ? "✓" : "○"} Complete: ${required.name}`);
      }
      for (const requirement of quest.traderRequirements || []) {
        const trader = state.traders.find(value => String(value.id) === String(requirement.trader));
        requirements.push(`${trader?.name || requirement.trader} ${requirement.requirementType || "level"} ${requirement.compareMethod || ">="} ${requirement.value}`);
      }
      for (const keyGroup of quest.neededKeys || []) {
        if (keyGroup.map !== state.map?.tdevId) continue;
        for (const key of keyGroup.keys || []) requirements.push(`Key: ${key.name}`);
      }
      const objectives = (quest.objectives || []).filter(objective =>
        objectiveLocationsOnMap(objective).length || !(objective.maps || []).length || objective.maps.includes(state.map?.tdevId));
      card.innerHTML = `<h3>${escapeHtml(quest.name)}</h3>` +
        (requirements.length ? `<ul>${requirements.map(v => `<li>${escapeHtml(v)}</li>`).join("")}</ul>` : '<p class="empty-state">No prerequisite recorded.</p>') +
        (objectives.length ? `<ul>${objectives.map(o => `<li class="objective">${escapeHtml(describeObjective(o))}</li>`).join("")}</ul>` : "");
      fragment.append(card);
    }
    el.requirementsList.replaceChildren(fragment);
  }

  function renderFloorButtons() {
    if (!state.map) return;
    const fragment = document.createDocumentFragment();
    for (const floor of [...state.map.floors].reverse()) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = friendlyFloor(floor);
      button.classList.toggle("active", floor === state.currentFloor);
      button.setAttribute("aria-pressed", String(floor === state.currentFloor));
      button.addEventListener("click", () => selectFloor(floor));
      fragment.append(button);
    }
    el.floorButtons.replaceChildren(fragment);
  }

  function selectFloor(floor) {
    if (!state.map) return false;
    let resolved = state.map.floors.find(value => value === floor);
    if (!resolved) {
      const wanted = String(floor || "").toLowerCase().replaceAll("_", " ");
      resolved = state.map.floors.find(value => {
        const candidate = value.toLowerCase().replaceAll("_", " ");
        return candidate.includes(wanted) || wanted.includes(candidate.replace(" level", "").replace(" floor", ""));
      });
    }
    if (!resolved) return false;
    state.currentFloor = resolved;
    renderFloorButtons();
    applyFloor();
    renderMarkers();
    return true;
  }

  function applyFloor() {
    if (state.map?.tiles) { renderTileMap(); return; }
    const svg = el.svgHost.querySelector("svg");
    if (!svg || !state.map) return;
    const known = new Set(state.map.floors);
    for (const group of svg.querySelectorAll("g[id]")) {
      if (known.has(group.id)) group.style.display = group.id === state.currentFloor ? "" : "none";
    }
  }

  function grayscaleColor(value) {
    return String(value).replace(/((?:fill|stroke|color)\s*:\s*)(red|blue|green|yellow|orange|purple|brown|cyan|magenta|lime|navy|teal|maroon|olive)/gi, "$1#777777").replace(/#[0-9a-f]{6}(?:[0-9a-f]{2})?/gi, color => {
      const r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
      const y = Math.max(18, Math.min(220, Math.round(.2126 * r + .7152 * g + .0722 * b)));
      const hex = y.toString(16).padStart(2, "0");
      return `#${hex}${hex}${hex}${color.length === 9 ? color.slice(7) : ""}`;
    }).replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)([^)]*)\)/gi, (_, r, g, b, rest) => {
      const y = Math.max(18, Math.min(220, Math.round(.2126 * Number(r) + .7152 * Number(g) + .0722 * Number(b))));
      return `rgb${rest ? "a" : ""}(${y},${y},${y}${rest})`;
    });
  }

  function applyMonochromePalette() {
    const svg = el.svgHost.querySelector("svg");
    if (!svg || svg.dataset.monochrome === "true") return;
    for (const style of svg.querySelectorAll("style")) style.textContent = grayscaleColor(style.textContent);
    for (const node of svg.querySelectorAll("[fill],[stroke],[style]")) {
      if (node.hasAttribute("fill")) node.setAttribute("fill", /^(red|blue|green|yellow|orange|purple|brown|cyan|magenta|lime|navy|teal|maroon|olive)$/i.test(node.getAttribute("fill").trim()) ? "#777777" : grayscaleColor(node.getAttribute("fill")));
      if (node.hasAttribute("stroke")) node.setAttribute("stroke", /^(red|blue|green|yellow|orange|purple|brown|cyan|magenta|lime|navy|teal|maroon|olive)$/i.test(node.getAttribute("stroke").trim()) ? "#777777" : grayscaleColor(node.getAttribute("stroke")));
      if (node.hasAttribute("style")) node.setAttribute("style", grayscaleColor(node.getAttribute("style")));
    }
    const danger = document.createElementNS("http://www.w3.org/2000/svg", "style");
    danger.id = "eft-danger-palette";
    danger.textContent = `
      .danger,.danger_small,#Minefield,#Mines,#mines,[id*="mine" i] { color:#ff2020 !important; opacity:1 !important; }
      .danger path,.danger polygon,.danger polyline,.danger circle,.danger rect,
      .danger_small path,.danger_small polygon,.danger_small polyline,.danger_small circle,.danger_small rect,
      #Minefield path,#Minefield polygon,#Mines path,#Mines polygon,#mines path,#mines polygon,
      [id*="mine" i] path,[id*="mine" i] polygon { fill:#b71919 !important; stroke:#ff2727 !important; }
    `;
    svg.append(danger);
    svg.dataset.monochrome = "true";
  }

  function applyWallPalette() {
    const svg = el.svgHost.querySelector("svg");
    if (!svg) return;
    svg.querySelector("#eft-wall-palette")?.remove();
    if (!state.wallColors) return;
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.id = "eft-wall-palette";
    style.textContent = `
      .building,.structure,.wall { fill:#6f665b !important; }
      .floor,.cement { fill:#88837a !important; }
      .locked { fill:#864d42 !important; }
      .wood { fill:#69472e !important; }
      .metal { fill:#60727a !important; }
      #Rooms path[style*="stroke"][style*="fill:"]:not([style*="fill:none"]) { fill:#6f665b !important; }
    `;
    svg.append(style);
  }

  function readPosition(position) {
    if (Array.isArray(position)) return { x: Number(position[0]), y: Number(position[1]), z: Number(position[2]) };
    return { x: Number(position?.x), y: Number(position?.y), z: Number(position?.z) };
  }

  function markerItemName(id) {
    return state.markerData?.itemNames?.[id] || id;
  }

  function markerContainerName(id) {
    return state.markerData?.containerNames?.[id] || id;
  }

  function isCoopExtract(extract) {
    return /coop|co-op|cooperation|scav.?pmc|factory gate/i.test(String(extract?.name || ""));
  }

  function extractLayerIds(extract) {
    const layers = [];
    if (isCoopExtract(extract)) layers.push("extract-coop");
    if (extract.faction === "pmc" || extract.faction === "shared") layers.push("extract-pmc");
    if (extract.faction === "scav" || extract.faction === "shared") layers.push("extract-scav");
    return layers.length ? layers : ["extract-coop"];
  }

  function spawnLayerIds(spawn) {
    const categories = new Set(spawn.categories || []);
    const sides = new Set(spawn.sides || []);
    const isZone = /^zone/i.test(String(spawn.name || ""));
    const layers = [];
    if (categories.has("sniper")) layers.push("spawn-sniper");
    if (categories.has("botpmc")) layers.push("spawn-aipmc");
    if (!isZone && (categories.has("player") || sides.has("pmc") || sides.has("all"))) layers.push("spawn-pmc");
    if (isZone && (categories.has("bot") || sides.has("scav"))) layers.push("spawn-scav");
    if (!layers.length && sides.has("pmc")) layers.push("spawn-pmc");
    return [...new Set(layers)];
  }

  function representativeSpawns() {
    const source = state.mapMarkers?.spawns || [];
    const named = new Map();
    const clustered = [];
    const spanX = Math.abs(Number(state.map?.bounds?.[0]?.[0]) - Number(state.map?.bounds?.[1]?.[0]));
    const spanZ = Math.abs(Number(state.map?.bounds?.[0]?.[1]) - Number(state.map?.bounds?.[1]?.[1]));
    const radius = Math.max(6, Math.max(spanX, spanZ) / 33);
    for (const spawn of source) {
      const layers = spawnLayerIds(spawn);
      if (!layers.length) continue;
      const position = readPosition(spawn.position);
      const layerKey = layers.join("|");
      if (/^zone/i.test(String(spawn.name || ""))) {
        const key = String(spawn.name);
        const group = named.get(key) || { ...spawn, layers: [], total: { x: 0, y: 0, z: 0 }, count: 0 };
        group.layers = [...new Set([...group.layers, ...layers])];
        group.total.x += position.x; group.total.y += position.y; group.total.z += position.z; group.count++;
        named.set(key, group);
        continue;
      }
      let group = clustered.find(candidate => candidate.layerKey === layerKey && Math.hypot(position.x - candidate.anchor.x, position.z - candidate.anchor.z) <= radius);
      if (!group) {
        group = { ...spawn, layers, layerKey, anchor: { ...position }, total: { ...position }, count: 1 };
        clustered.push(group);
      } else {
        group.total.x += position.x; group.total.y += position.y; group.total.z += position.z; group.count++;
      }
    }
    return [...named.values(), ...clustered].map(group => ({
      ...group,
      position: [group.total.x / group.count, group.total.y / group.count, group.total.z / group.count],
      _layerIds: group.layers
    }));
  }

  function bossLayerId(boss) {
    const name = String(boss.normalizedName || boss.name || "").toLowerCase();
    if (name.includes("cultist")) return "cultist";
    if (name === "rogue" || name.includes("exusec")) return "rogue";
    if (name === "raider" || name.includes("pmcbot")) return "raider";
    return "boss";
  }

  function containerLayerId(containerId) {
    return CONTAINER_LAYER_BY_TYPE[state.markerData?.containerTypes?.[containerId]] || "container-other";
  }

  function lockLayerIds(lock) {
    const subtype = lock.lockType === "door" ? "lock-door" : lock.lockType === "trunk" ? "lock-trunk" : "lock-container";
    return ["lock", subtype];
  }

  function keyItemIdsAt(loot) {
    return (loot.items || []).filter(id => state.keyItemIds.has(id));
  }

  function layerCounts() {
    const counts = Object.fromEntries(LAYERS.map(layer => [layer.id, 0]));
    const map = state.mapMarkers;
    if (!map) return counts;
    for (const extract of map.extracts || []) for (const layerId of extractLayerIds(extract)) counts[layerId]++;
    counts.transit = map.transits?.length || 0;
    for (const spawn of representativeSpawns()) {
      for (const layerId of spawn._layerIds) counts[layerId]++;
    }
    for (const boss of map.bosses || []) counts[bossLayerId(boss)]++;
    for (const lock of map.locks || []) for (const layerId of lockLayerIds(lock)) counts[layerId]++;
    counts["key-spawn"] = (map.looseLoot || []).filter(loot => keyItemIdsAt(loot).length).length;
    counts.switch = map.switches?.length || 0;
    counts.stationary = map.stationaryWeapons?.length || 0;
    counts.btr = map.btrStops?.length || 0;
    for (const hazard of map.hazards || []) counts[hazard.type === "minefield" ? "hazard-mine" : "hazard-sniper"]++;
    for (const container of map.containers || []) counts[containerLayerId(container.id)]++;
    counts["loose-item"] = state.focusedItemId
      ? (map.looseLoot || []).filter(loot => loot.items?.includes(state.focusedItemId)).length
      : map.looseLoot?.length || 0;
    counts["battle-pass"] = state.battlePassData?.maps?.[state.mapKey]?.length || 0;
    return counts;
  }

  function renderLayerList() {
    if (!el.layerList) return;
    const counts = layerCounts();
    const fragment = document.createDocumentFragment();
    for (const groupName of [...new Set(LAYERS.map(layer => layer.group))]) {
      const section = document.createElement("section");
      section.className = "layer-group";
      const heading = document.createElement("h3");
      heading.innerHTML = `<span class="collapse-glyph">−/+</span><span>${escapeHtml(t(groupName))}</span>`;
      heading.tabIndex = 0;
      heading.addEventListener("click", () => section.classList.toggle("collapsed"));
      heading.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); section.classList.toggle("collapsed"); } });
      section.append(heading);
      for (const layer of LAYERS.filter(candidate => candidate.group === groupName)) {
        const label = document.createElement("label");
        label.className = "layer-row";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = state.visibleLayers.has(layer.id);
        checkbox.disabled = counts[layer.id] === 0;
        checkbox.addEventListener("change", () => toggleLayer(layer.id, checkbox.checked));
        const swatch = document.createElement("span");
        swatch.className = "layer-icon-wrap";
        swatch.style.setProperty("--marker-color", layer.color);
        swatch.innerHTML = iconSvg(layer.icon, "layer-icon");
        const name = document.createElement("span");
        name.textContent = t(layer.label);
        const count = document.createElement("small");
        count.className = "layer-count";
        count.textContent = String(counts[layer.id]);
        label.append(checkbox, swatch, name, count);
        section.append(label);
      }
      fragment.append(section);
    }
    el.layerList.replaceChildren(fragment);
    renderSelectedItem();
  }

  function toggleLayer(layerId, enabled) {
    enabled ? state.visibleLayers.add(layerId) : state.visibleLayers.delete(layerId);
    localStorage.setItem("eft-visible-layers", JSON.stringify([...state.visibleLayers]));
    post("layer-visibility-changed", { layers: [...state.visibleLayers] });
    renderMarkers();
  }

  function renderSelectedItem() {
    if (!el.selectedItem) return;
    if (!state.focusedItemId) {
      el.selectedItem.hidden = true;
      el.selectedItem.replaceChildren();
      return;
    }
    const id = state.focusedItemId;
    el.selectedItem.hidden = false;
    el.selectedItem.innerHTML = `<div class="selected-item-row"><span class="item-icon-placeholder" aria-hidden="true">${iconSvg("item")}</span><div><strong>${escapeHtml(markerItemName(id))}</strong><small>Loose item locations</small></div><button type="button" aria-label="Clear item overlay">×</button></div>`;
    el.selectedItem.querySelector("button").addEventListener("click", clearFocusedItem);
  }

  function focusItem(itemId) {
    state.focusedItemId = itemId;
    state.visibleLayers.add("loose-item");
    localStorage.setItem("eft-visible-layers", JSON.stringify([...state.visibleLayers]));
    post("layer-visibility-changed", { layers: [...state.visibleLayers] });
    renderLayerList();
    renderSearchResults();
    renderMarkers();
  }

  function clearFocusedItem() {
    state.focusedItemId = null;
    renderLayerList();
    renderSearchResults();
    renderMarkers();
  }

  function addSearchResult(fragment, title, detail, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-result";
    button.innerHTML = `<span>${escapeHtml(title)}</span><small>${escapeHtml(detail)}</small>`;
    button.addEventListener("click", action);
    fragment.append(button);
  }

  function renderSearchResults() {
    if (!el.mapSearchResults || !state.markerData) return;
    const query = el.mapSearch.value.trim().toLowerCase();
    if (query.length < 2) {
      el.mapSearchResults.replaceChildren();
      return;
    }
    const fragment = document.createDocumentFragment();
    const currentItems = new Map();
    for (const loot of state.mapMarkers?.looseLoot || []) {
      for (const id of loot.items || []) currentItems.set(id, (currentItems.get(id) || 0) + 1);
    }
    const itemMatches = [...currentItems]
      .map(([id, count]) => ({ id, count, name: markerItemName(id) }))
      .filter(item => item.name.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 40);
    if (itemMatches.length) {
      const heading = document.createElement("h3");
      heading.className = "search-heading";
      heading.textContent = "Loose items";
      fragment.append(heading);
      for (const item of itemMatches) addSearchResult(fragment, item.name, `${item.count} locations`, () => focusItem(item.id));
    }

    const locations = [];
    for (const extract of state.mapMarkers?.extracts || []) locations.push({ title: extract.name, detail: "Extraction", layers: extractLayerIds(extract), position: extract.position });
    for (const transit of state.mapMarkers?.transits || []) locations.push({ title: transit.name, detail: "Transit", layers: ["transit"], position: transit.position });
    for (const boss of state.mapMarkers?.bosses || []) locations.push({ title: boss.name, detail: LAYER_BY_ID.get(bossLayerId(boss)).label, layers: [bossLayerId(boss)], position: boss.position });
    for (const lock of state.mapMarkers?.locks || []) locations.push({ title: markerItemName(lock.keyId), detail: LAYER_BY_ID.get(lockLayerIds(lock)[1]).label, layers: lockLayerIds(lock), position: lock.position });
    const seen = new Set();
    const locationMatches = locations.filter(result => {
      const key = `${result.layers.join(",")}:${result.title}`;
      if (seen.has(key) || !result.title.toLowerCase().includes(query)) return false;
      seen.add(key);
      return true;
    }).slice(0, 30);
    if (locationMatches.length) {
      const heading = document.createElement("h3");
      heading.className = "search-heading";
      heading.textContent = "Map locations";
      fragment.append(heading);
      for (const result of locationMatches) addSearchResult(fragment, result.title, result.detail, () => {
        for (const layerId of result.layers) state.visibleLayers.add(layerId);
        renderLayerList();
        renderMarkers();
        panToWorld(readPosition(result.position));
      });
    }
    if (!itemMatches.length && !locationMatches.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No matching item or location on this map.";
      fragment.append(empty);
    }
    el.mapSearchResults.replaceChildren(fragment);
  }

  function showMarkerPopup(details) {
    const image = details.itemId ? `<span class="item-icon-placeholder" aria-hidden="true">${iconSvg("item")}</span>` : "";
    el.markerPopup.innerHTML = `<div class="marker-popup-head"><strong>${escapeHtml(details.title)}</strong><button type="button" aria-label="Close">×</button></div>${image}${details.body ? `<p>${escapeHtml(details.body)}</p>` : ""}<small>${escapeHtml(details.coordinates || "")}</small>`;
    el.markerPopup.hidden = false;
    el.markerPopup.querySelector("button").addEventListener("click", () => { el.markerPopup.hidden = true; });
  }

  function addMapMarker(fragment, layerIds, rawPosition, title, body = "", itemId = null) {
    const memberships = Array.isArray(layerIds) ? layerIds : [layerIds];
    const layerId = memberships.find(id => state.visibleLayers.has(id));
    if (!layerId) return;
    const layer = LAYER_BY_ID.get(layerId);
    const position = readPosition(rawPosition);
    if (![position.x, position.y, position.z].every(Number.isFinite)) return;
    const projected = worldToPercent(position.x, position.z);
    const outside = projected.left < 0 || projected.left > 100 || projected.top < 0 || projected.top > 100;
    projected.left = Math.min(99.4, Math.max(.6, projected.left));
    projected.top = Math.min(99.4, Math.max(.6, projected.top));
    const marker = document.createElement("div");
    marker.className = "map-marker";
    marker.classList.add(`layer-${layerId}`);
    marker.dataset.layer = memberships.join(" ");
    if (outside) marker.classList.add("edge-clamped");
    if (itemId && itemId === state.focusedItemId) marker.classList.add("item-focused");
    marker.style.left = `${projected.left}%`;
    marker.style.top = `${projected.top}%`;
    marker.style.setProperty("--marker-color", layer.color);
    const targetRank = objectiveFloorRank(position);
    const currentRank = mapFloorRank(state.currentFloor);
    if (targetRank != null && currentRank != null && targetRank !== currentRank) marker.classList.add("off-level");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-marker-button";
    button.innerHTML = iconSvg(layer.icon);
    button.setAttribute("aria-label", `${layer.label}: ${title}`);
    button.title = `${title}${body ? ` — ${body}` : ""}`;
    button.addEventListener("click", event => {
      event.stopPropagation();
      showMarkerPopup({ title, body: `${body}${outside ? `${body ? " · " : ""}source point is outside the SVG boundary and is pinned to the nearest edge` : ""}`, itemId, coordinates: `X ${position.x.toFixed(1)} · Y ${position.y.toFixed(1)} · Z ${position.z.toFixed(1)}` });
    });
    marker.append(button);
    fragment.append(marker);
  }

  function renderMapDataMarkers(fragment) {
    const map = state.mapMarkers;
    if (!map) return;
    for (const extract of map.extracts || []) {
      const conditions = [];
      if (extract.switches?.length) conditions.push("switch activation required");
      if (extract.transferItem) conditions.push(`${extract.transferItem.count}× ${markerItemName(extract.transferItem.item)}`);
      addMapMarker(fragment, extractLayerIds(extract), extract.position, extract.name,
        `${extract.faction.toUpperCase()} extraction${conditions.length ? ` · ${conditions.join(" · ")}` : ""}`,
        extract.transferItem?.item || null);
    }
    for (const transit of map.transits || []) addMapMarker(fragment, "transit", transit.position, transit.name, "Transit extraction");
    for (const spawn of representativeSpawns()) {
      const layerIds = spawn._layerIds;
      if (layerIds.length) addMapMarker(fragment, layerIds, spawn.position, layerIds.map(id => LAYER_BY_ID.get(id).label).join(" / "), (spawn.sides || []).join(", "));
    }
    for (const boss of map.bosses || []) {
      const layerId = bossLayerId(boss);
      addMapMarker(fragment, layerId, boss.position, boss.name, `${LAYER_BY_ID.get(layerId).label} · ${Math.round((boss.chance || 0) * 100)}% map spawn chance${boss.area ? ` · ${boss.area}` : ""}`);
    }
    for (const lock of map.locks || []) addMapMarker(fragment, lockLayerIds(lock), lock.position, markerItemName(lock.keyId), `${LAYER_BY_ID.get(lockLayerIds(lock)[1]).label}${lock.needsPower ? " · power required" : ""}`, lock.keyId);
    for (const sw of map.switches || []) addMapMarker(fragment, "switch", sw.position, sw.name || "Lever / switch", sw.type || "Usable switch");
    for (const weapon of map.stationaryWeapons || []) addMapMarker(fragment, "stationary", weapon.position, weapon.name, "Stationary weapon");
    for (const stop of map.btrStops || []) addMapMarker(fragment, "btr", stop.position, stop.name || "BTR stop", "Armored transport stop");
    for (const hazard of map.hazards || []) {
      const layerId = hazard.type === "minefield" ? "hazard-mine" : "hazard-sniper";
      addMapMarker(fragment, layerId, hazard.position, LAYER_BY_ID.get(layerId).label, "Danger zone");
    }
    for (const container of map.containers || []) {
      const layerId = containerLayerId(container.id);
      addMapMarker(fragment, layerId, container.position, markerContainerName(container.id), LAYER_BY_ID.get(layerId).label);
    }
    for (const loot of map.looseLoot || []) {
      const ids = loot.items || [];
      if (state.focusedItemId && !ids.includes(state.focusedItemId)) continue;
      const keyIds = keyItemIdsAt(loot);
      const focusId = state.focusedItemId || keyIds[0] || ids[0];
      const names = ids.slice(0, 5).map(markerItemName);
      const extra = ids.length > 5 ? ` +${ids.length - 5} more` : "";
      addMapMarker(fragment, keyIds.length ? ["key-spawn", "loose-item"] : "loose-item", loot.position, markerItemName(focusId), `${names.join(", ")}${extra}`, focusId);
    }
  }

  function renderBattlePassMarkers(fragment) {
    if (!state.visibleLayers.has("battle-pass")) return;
    for (const location of state.battlePassData?.maps?.[state.mapKey] || []) {
      const details = [
        location.documents,
        location.detail,
        location.confidence ? `Confidence: ${location.confidence}` : "",
        location.coordinateBasis === "reported-poi-center" ? "Coordinate: estimated POI center" : "",
        location.coordinateNote
      ].filter(Boolean).join(" · ");
      addMapMarker(fragment, "battle-pass", location.position, location.title || "Battle Pass document", details);
    }
  }

  function renderMarkers() {
    el.markerLayer.replaceChildren();
    if (!state.map) return;
    const fragment = document.createDocumentFragment();
    renderMapDataMarkers(fragment);
    renderBattlePassMarkers(fragment);
    const currentRank = mapFloorRank(state.currentFloor);
    for (const quest of pinnedQuests()) {
      for (const objective of quest.objectives || []) {
        for (const location of objectiveLocationsOnMap(objective)) {
          const pos = worldToPercent(location.x, location.z);
          const marker = document.createElement("div");
          marker.className = "quest-marker";
          marker.style.left = `${pos.left}%`;
          marker.style.top = `${pos.top}%`;
          marker.title = `${quest.name}: ${describeObjective(objective)}`;
          const targetRank = objectiveFloorRank(location);
          const delta = currentRank == null || targetRank == null ? 0 : targetRank - currentRank;
          if (delta !== 0) marker.classList.add("off-level");
          if ((state.markerMode === "opacity" || state.markerMode === "both") && delta !== 0) marker.classList.add("opacity-mode");
          const dot = document.createElement("button");
          dot.type = "button";
          dot.className = "quest-dot";
          dot.innerHTML = iconSvg("quest");
          dot.setAttribute("aria-label", marker.title);
          dot.addEventListener("click", () => focusRequirement(quest));
          marker.append(dot);
          if ((state.markerMode === "arrows" || state.markerMode === "both") && delta !== 0) {
            const arrows = document.createElement("span");
            arrows.className = `floor-arrows ${delta > 0 ? "up" : "down"}`;
            arrows.textContent = Array(Math.min(Math.abs(delta), 5)).fill(delta > 0 ? "▲" : "▼").join("\n");
            arrows.title = `${Math.abs(delta)} floor${Math.abs(delta) === 1 ? "" : "s"} ${delta > 0 ? "above" : "below"}`;
            marker.append(arrows);
          }
          fragment.append(marker);
        }
      }
    }
    for (const member of state.squadMembers) {
      if (normalizeMapKey(member.map) !== state.mapKey) continue;
      const position = readPosition(member);
      const pos = worldToPercent(position.x, position.z);
      const marker = document.createElement("div");
      marker.className = "squad-marker";
      marker.style.left = `${pos.left}%`;
      marker.style.top = `${pos.top}%`;
      marker.textContent = String(member.name || "S").slice(0, 2).toUpperCase();
      marker.title = member.name || "Squad member";
      fragment.append(marker);
    }
    el.markerLayer.append(fragment);
    if (state.player) renderPlayerMarker();
  }

  function focusRequirement(quest) {
    showRightPanelPage("pinned");
    const card = el.requirementsList.querySelector(`[data-quest-id="${CSS.escape(String(quest.id))}"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (card) {
      card.animate([{ outline: "2px solid #d2b46d" }, { outline: "2px solid transparent" }], { duration: 900 });
    }
  }

  function projectWorld(map, x, z) {
    const [a, b, c] = map.anchors;
    const abX = b.world[0] - a.world[0];
    const abZ = b.world[1] - a.world[1];
    const acX = c.world[0] - a.world[0];
    const acZ = c.world[1] - a.world[1];
    const pointX = x - a.world[0];
    const pointZ = z - a.world[1];
    const determinant = abX * acZ - abZ * acX;
    if (Math.abs(determinant) < 1e-9) return { left: 50, top: 50 };
    const alongTop = (pointX * acZ - pointZ * acX) / determinant;
    const alongLeft = (abX * pointZ - abZ * pointX) / determinant;
    return {
      left: a.map[0] + alongTop * (b.map[0] - a.map[0]) + alongLeft * (c.map[0] - a.map[0]),
      top: a.map[1] + alongTop * (b.map[1] - a.map[1]) + alongLeft * (c.map[1] - a.map[1])
    };
  }

  function worldToPercent(x, z) {
    return projectWorld(state.map, x, z);
  }

  function percentToWorld(left, top) {
    const [a, b, c] = state.map.anchors;
    const abX = b.map[0] - a.map[0];
    const abY = b.map[1] - a.map[1];
    const acX = c.map[0] - a.map[0];
    const acY = c.map[1] - a.map[1];
    const pointX = left - a.map[0];
    const pointY = top - a.map[1];
    const determinant = abX * acY - abY * acX;
    if (Math.abs(determinant) < 1e-9) return { x: 0, z: 0 };
    const alongTop = (pointX * acY - pointY * acX) / determinant;
    const alongLeft = (abX * pointY - abY * pointX) / determinant;
    return {
      x: a.world[0] + alongTop * (b.world[0] - a.world[0]) + alongLeft * (c.world[0] - a.world[0]),
      z: a.world[1] + alongTop * (b.world[1] - a.world[1]) + alongLeft * (c.world[1] - a.world[1])
    };
  }

  function screenToPercent(clientX, clientY) {
    const rect = el.mapViewport.getBoundingClientRect();
    const localX = (clientX - rect.left - state.mapFrame.left - state.transform.x) / state.transform.scale;
    const localY = (clientY - rect.top - state.mapFrame.top - state.transform.y) / state.transform.scale;
    return { left: localX / state.mapFrame.width * 100, top: localY / state.mapFrame.height * 100 };
  }

  function setRuler(enabled) {
    state.rulerActive = Boolean(enabled);
    state.measurePoints = [];
    el.rulerToggle.setAttribute("aria-pressed", String(state.rulerActive));
    el.mapViewport.classList.toggle("ruler-active", state.rulerActive);
    renderMeasurement();
  }

  function addRulerPoint(clientX, clientY) {
    const point = screenToPercent(clientX, clientY);
    if (point.left < 0 || point.left > 100 || point.top < 0 || point.top > 100) return;
    if (state.measurePoints.length >= 2) state.measurePoints = [];
    state.measurePoints.push(point);
    renderMeasurement();
  }

  function renderMeasurement() {
    el.measurementLayer.querySelectorAll(".measurement-line,.measurement-point").forEach(node => node.remove());
    el.rulerReadout.hidden = true;
    if (!state.measurePoints.length) return;
    const ns = "http://www.w3.org/2000/svg";
    for (const point of state.measurePoints) {
      const circle = document.createElementNS(ns, "circle");
      circle.setAttribute("class", "measurement-point");
      circle.setAttribute("cx", point.left);
      circle.setAttribute("cy", point.top);
      circle.setAttribute("r", ".7");
      el.measurementLayer.append(circle);
    }
    if (state.measurePoints.length !== 2) {
      el.rulerReadout.hidden = false;
      el.rulerReadout.textContent = "Select the second point";
      return;
    }
    const [first, second] = state.measurePoints;
    const line = document.createElementNS(ns, "line");
    line.setAttribute("class", "measurement-line");
    line.setAttribute("x1", first.left);
    line.setAttribute("y1", first.top);
    line.setAttribute("x2", second.left);
    line.setAttribute("y2", second.top);
    el.measurementLayer.prepend(line);
    const worldA = percentToWorld(first.left, first.top);
    const worldB = percentToWorld(second.left, second.top);
    const distance = Math.hypot(worldB.x - worldA.x, worldB.z - worldA.z);
    el.rulerReadout.hidden = false;
    el.rulerReadout.textContent = `${distance.toFixed(1)} m`;
  }

  function objectiveFloorRank(location) {
    const y = Number(location.y);
    if (!Number.isFinite(y)) return null;
    const rules = state.mapMarkers?.floorRules || [];
    const matchesExtent = extent => {
      if (extent.height && (y < extent.height[0] || y >= extent.height[1])) return false;
      if (!extent.bounds?.length) return true;
      return extent.bounds.some(bounds => {
        const xs = [Number(bounds[0]?.[0]), Number(bounds[1]?.[0])];
        const zs = [Number(bounds[0]?.[1]), Number(bounds[1]?.[1])];
        return location.x >= Math.min(...xs) && location.x <= Math.max(...xs) &&
          location.z >= Math.min(...zs) && location.z <= Math.max(...zs);
      });
    };
    for (const rule of rules.filter(rule => !rule.primary)) {
      if (rule.extents?.some(matchesExtent)) return mapFloorRank(rule.floor);
    }
    const primary = rules.find(rule => rule.primary);
    if (primary) return mapFloorRank(primary.floor);
    switch (state.mapKey) {
      case "factory": return y < -1 ? mapFloorRank("Basement") : y < 3 ? mapFloorRank("Ground_Floor") : y < 6 ? mapFloorRank("Second_Floor") : mapFloorRank("Third_Floor");
      case "lab": return y < -0.9 ? mapFloorRank("Technical_Level") : y < 3 ? mapFloorRank("First_Level") : mapFloorRank("Second_Level");
      case "streets": return y < -6 ? mapFloorRank("Underground_Level") : y < 10 ? mapFloorRank("Ground_Level") : y < 15 ? mapFloorRank("Second_Floor") : y < 20 ? mapFloorRank("Third_Floor") : y < 25 ? mapFloorRank("Fourth_Floor") : mapFloorRank("Fifth_Floor");
      case "ground-zero": return y < 21 ? mapFloorRank("Underground_Level") : y < 28 ? mapFloorRank("Ground_Level") : y < 32.3 ? mapFloorRank("Second_Floor") : mapFloorRank("Third_Floor");
      case "shoreline": return y < -5 ? mapFloorRank("Underground_Level") : y < -1 ? mapFloorRank("Ground_Level") : y < 2 ? mapFloorRank("Second_Floor") : mapFloorRank("Third_Floor");
      case "interchange": return y < 25 ? mapFloorRank("Ground_Level") : y < 34 ? mapFloorRank("First_Floor") : mapFloorRank("Second_Floor");
      case "reserve": return y < -7 ? mapFloorRank("Bunkers") : mapFloorRank("Ground_Level");
      default: return null;
    }
  }

  function calibrationReport() {
    return Object.entries(MAPS).map(([mapKey, map]) => {
      const errors = map.anchors.map(anchor => {
        const projected = projectWorld(map, anchor.world[0], anchor.world[1]);
        return Math.hypot(projected.left - anchor.map[0], projected.top - anchor.map[1]);
      });
      return { map: mapKey, anchors: map.anchors, maxErrorPercent: Math.max(...errors) };
    });
  }

  function quaternionForward(qx, qy, qz, qw) {
    return {
      x: 2 * (qx * qz + qw * qy),
      z: 1 - 2 * (qx * qx + qy * qy)
    };
  }

  function playerHeadingOnMap(player) {
    const forward = quaternionForward(player.qx, player.qy, player.qz, player.qw);
    const origin = worldToPercent(player.x, player.z);
    const target = worldToPercent(player.x + forward.x, player.z + forward.z);
    const dx = (target.left - origin.left) * state.mapFrame.width;
    const dy = (target.top - origin.top) * state.mapFrame.height;
    return Math.atan2(dx, -dy) * 180 / Math.PI;
  }

  function renderPlayerMarker() {
    const pos = worldToPercent(state.player.x, state.player.z);
    const marker = document.createElement("div");
    marker.className = "player-marker";
    marker.style.left = `${pos.left}%`;
    marker.style.top = `${pos.top}%`;
    const heading = playerHeadingOnMap(state.player);
    marker.style.setProperty("--heading", `${heading}deg`);
    marker.title = `Player: ${state.player.x.toFixed(1)}, ${state.player.y.toFixed(1)}, ${state.player.z.toFixed(1)}`;
    el.markerLayer.append(marker);
  }

  function setPlayerPosition(position) {
    const values = [position.x, position.y, position.z, position.qx, position.qy, position.qz, position.qw].map(Number);
    if (values.some(v => !Number.isFinite(v))) return false;
    state.player = { x: values[0], y: values[1], z: values[2], qx: values[3], qy: values[4], qz: values[5], qw: values[6] };
    if (el.coordinatesReadout) el.coordinatesReadout.textContent = `X ${values[0].toFixed(1)} · Y ${values[1].toFixed(1)} · Z ${values[2].toFixed(1)}`;
    renderMarkers();
    if (state.player && state.map && window.__eftAutoPan !== false) panToPlayer();
    return true;
  }

  function panToPlayer() {
    panToWorld(state.player);
  }

  function panToWorld(position) {
    const pos = worldToPercent(position.x, position.z);
    const rect = el.mapViewport.getBoundingClientRect();
    const worldX = state.mapFrame.width * pos.left / 100;
    const worldY = state.mapFrame.height * pos.top / 100;
    state.transform.x = rect.width / 2 - state.mapFrame.left - worldX * state.transform.scale;
    state.transform.y = rect.height / 2 - state.mapFrame.top - worldY * state.transform.scale;
    applyTransform();
  }

  function setSquadMembers(members) {
    state.squadMembers = Array.isArray(members) ? members.filter(member =>
      [member?.x, member?.z].every(value => Number.isFinite(Number(value)))) : [];
    el.squadCount.textContent = String(state.squadMembers.filter(member => normalizeMapKey(member.map) === state.mapKey).length);
    renderSquadMembers();
    renderMarkers();
  }

  function progressPayload() {
    return {
      useProgress: state.progress.useProgress,
      filter: state.progress.filter,
      edition: state.progress.edition,
      faction: state.progress.faction,
      playerLevel: state.progress.playerLevel,
      traderLevels: state.progress.traderLevels,
      completedQuests: [...state.progress.completedQuests]
    };
  }

  function persistProgress() {
    post("progress-settings-changed", progressPayload());
  }

  function setProgress(value = {}) {
    state.progress = {
      useProgress: Boolean(value.useProgress),
      filter: ["story", "kappa", "all"].includes(value.filter) ? value.filter : "all",
      edition: value.edition || "standard",
      faction: ["Any", "USEC", "BEAR"].includes(value.faction) ? value.faction : "Any",
      playerLevel: Math.min(100, Math.max(1, Number(value.playerLevel) || 1)),
      traderLevels: value.traderLevels && typeof value.traderLevels === "object" ? value.traderLevels : {},
      completedQuests: new Set((value.completedQuests || []).map(String))
    };
    renderProgressForm();
    renderQuests();
    renderRequirements();
  }

  function renderProgressForm() {
    el.useProgress.checked = state.progress.useProgress;
    el.gameEdition.value = state.progress.edition;
    el.playerFaction.value = state.progress.faction;
    el.playerLevel.value = String(state.progress.playerLevel);
    for (const button of el.questFilterButtons.querySelectorAll("button"))
      button.classList.toggle("active", button.dataset.filter === state.progress.filter);
    const fragment = document.createDocumentFragment();
    const progressTraders = new Set(["prapor", "therapist", "skier", "peacekeeper", "mechanic", "ragman", "jaeger", "ref"]);
    for (const trader of state.traders) {
      if (!progressTraders.has(trader.normalizedName)) continue;
      const row = document.createElement("label");
      row.className = "trader-level";
      const name = document.createElement("span");
      name.textContent = trader.name;
      const select = document.createElement("select");
      select.dataset.traderId = String(trader.id);
      for (let level = 1; level <= Math.min(4, Number(trader.maxLevel) || 4); level++) {
        const option = document.createElement("option");
        option.value = String(level);
        option.textContent = `LL${level}`;
        select.append(option);
      }
      select.value = String(state.progress.traderLevels[String(trader.id)] || 1);
      row.append(name, select);
      fragment.append(row);
    }
    el.traderLevels.replaceChildren(fragment);
  }

  function readProgressForm() {
    const traderLevels = {};
    for (const select of el.traderLevels.querySelectorAll("select[data-trader-id]")) traderLevels[select.dataset.traderId] = Number(select.value);
    state.progress.useProgress = el.useProgress.checked;
    state.progress.edition = el.gameEdition.value;
    state.progress.faction = el.playerFaction.value;
    state.progress.playerLevel = Math.min(100, Math.max(1, Number(el.playerLevel.value) || 1));
    state.progress.traderLevels = traderLevels;
    persistProgress();
    renderQuests();
    renderRequirements();
  }

  function setSquadSettings(value = {}) {
    const mode = ["lan", "host", "client"].includes(value.mode) ? value.mode : (value.enabled ? "lan" : "off");
    state.squad = {
      enabled: mode !== "off", mode, name: value.name || "Player", room: value.room || "eft-local",
      host: value.host || "", password: value.password || "",
      port: Math.min(65535, Math.max(1024, Number(value.port) || 38473))
    };
    el.squadMode.value = state.squad.mode;
    el.squadName.value = state.squad.name;
    el.squadRoom.value = state.squad.room;
    el.squadHost.value = state.squad.host;
    el.squadPassword.value = state.squad.password;
    el.squadPort.value = String(state.squad.port);
    updateSquadFields();
  }

  function updateSquadFields() {
    const mode = el.squadMode.value;
    el.squadRoomLabel.hidden = mode !== "lan";
    el.squadHostLabel.hidden = mode !== "client";
    el.squadPasswordLabel.hidden = mode !== "host" && mode !== "client";
    el.squadHelp.textContent = mode === "host"
      ? "Forward this UDP port on the host router and share the public IP, port, and password. The password stays in memory only."
      : mode === "client"
        ? "Enter the host's public IP or DNS name. The host must forward the selected UDP port."
        : mode === "lan"
          ? "Local multicast only. The room code separates groups and is not encryption."
          : "Choose Host to open a room or Client to connect to one.";
  }

  function setSquadStatus(value = {}) {
    state.squadStatus = { mode: value.mode || "off", state: value.state || "off", message: value.message || "" };
    el.squadStatus.dataset.state = state.squadStatus.state;
    el.squadStatus.textContent = state.squadStatus.message || "Squad sharing is off.";
  }

  function createSquadPassword() {
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  }

  function renderSquadMembers() {
    const members = state.squadMembers.filter(member => normalizeMapKey(member.map) === state.mapKey);
    el.squadMembers.textContent = members.length ? members.map(member => `${member.name} · ${Number(member.x).toFixed(1)}, ${Number(member.y).toFixed(1)}, ${Number(member.z).toFixed(1)}`).join("\n") : "No squad members online.";
  }

  function selectFloorByHotkey(keyIndex) {
    if (!state.map) return false;
    const ranked = state.map.floors.map(floor => ({ floor, rank: floorRank(floor) })).filter(item => item.rank != null);
    let target;
    if (keyIndex === 0) target = ranked.filter(item => item.rank < 0).sort((a, b) => a.rank - b.rank)[0];
    else if (keyIndex === 1) target = ranked.find(item => item.rank === 0) || ranked.find(item => item.rank === 1);
    else target = ranked.find(item => item.rank === keyIndex - 1) || ranked.find(item => item.rank === keyIndex);
    if (!target && state.map.tileLayers) {
      const base = Math.max(0, state.map.floors.indexOf(state.map.defaultFloor));
      const index = keyIndex === 0 ? 0 : Math.min(state.map.floors.length - 1, base + keyIndex - 1);
      target = { floor: state.map.floors[index] };
    }
    return target ? selectFloor(target.floor) : false;
  }

  function setFloorEditor(enabled, zones = [], floors = []) {
    state.floorEditor.enabled = Boolean(enabled);
    if (enabled) {
      state.floorEditor.zones = Array.isArray(zones) ? structuredClone(zones) : [];
      state.floorEditor.floors = Array.isArray(floors) ? structuredClone(floors) : [];
      state.floorEditor.vertices = [];
      const names = state.floorEditor.floors.length ? state.floorEditor.floors.map(floor => floor.name) : state.map.floors;
      el.floorZoneFloor.replaceChildren(...names.map(name => Object.assign(document.createElement("option"), { value: name, textContent: friendlyFloor(name) })));
    }
    el.floorEditorPanel.hidden = !state.floorEditor.enabled;
    el.mapViewport.classList.toggle("floor-editing", state.floorEditor.enabled);
    renderFloorEditor();
    return state.floorEditor.enabled;
  }

  function addFloorVertex(clientX, clientY) {
    const point = screenToPercent(clientX, clientY);
    if (point.left < 0 || point.left > 100 || point.top < 0 || point.top > 100) return;
    const world = percentToWorld(point.left, point.top);
    state.floorEditor.vertices.push({ x: Math.round(world.x * 1000) / 1000, y: Math.round(world.z * 1000) / 1000 });
    renderFloorEditor();
  }

  function renderFloorEditor() {
    el.measurementLayer.querySelectorAll(".floor-zone-shape,.floor-zone-current,.floor-zone-point").forEach(node => node.remove());
    if (!state.floorEditor.enabled) return;
    const ns = "http://www.w3.org/2000/svg";
    const draw = (points, className, close) => {
      if (!points.length) return;
      const projected = points.map(point => worldToPercent(Number(point.x), Number(point.y)));
      const polygon = document.createElementNS(ns, close ? "polygon" : "polyline");
      polygon.setAttribute("class", className);
      polygon.setAttribute("points", projected.map(point => `${point.left},${point.top}`).join(" "));
      el.measurementLayer.append(polygon);
      if (!close) for (const point of projected) {
        const dot = document.createElementNS(ns, "circle");
        dot.setAttribute("class", "floor-zone-point"); dot.setAttribute("cx", point.left); dot.setAttribute("cy", point.top); dot.setAttribute("r", ".65");
        el.measurementLayer.append(dot);
      }
    };
    for (const zone of state.floorEditor.zones) draw(zone.polygon || [], "floor-zone-shape", true);
    draw(state.floorEditor.vertices, "floor-zone-current", false);
    el.floorEditorStatus.textContent = `${state.floorEditor.zones.length} zones · ${state.floorEditor.vertices.length} points`;
  }

  function completeFloorZone() {
    if (state.floorEditor.vertices.length < 3) { el.floorEditorStatus.textContent = "At least 3 points are required."; return; }
    const min = Number(el.floorZoneMin.value), max = Number(el.floorZoneMax.value);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) { el.floorEditorStatus.textContent = "Height min must be below max."; return; }
    state.floorEditor.zones.push({ name: el.floorZoneName.value.trim() || "Zone", floor_label: el.floorZoneFloor.value, z_min: min, z_max: max, polygon: state.floorEditor.vertices, holes: [] });
    state.floorEditor.vertices = [];
    renderFloorEditor();
  }

  function applyScaleVariables() {
    document.documentElement.style.setProperty("--ui-scale", state.uiScale);
    document.documentElement.style.setProperty("--marker-scale", state.uiScale * state.iconScale);
  }

  function setScale(scale) {
    state.uiScale = Math.min(2, Math.max(.65, Number(scale) || 1));
    applyScaleVariables();
  }

  function setIconScale(scale) {
    state.iconScale = Math.min(2, Math.max(.5, Number(scale) || 1));
    applyScaleVariables();
    if (el.iconScaleSlider) el.iconScaleSlider.value = String(Math.round(state.iconScale * 100));
    if (el.iconScaleValue) el.iconScaleValue.textContent = `${Math.round(state.iconScale * 100)}%`;
    localStorage.setItem("eft-icon-scale", String(state.iconScale));
    return state.iconScale;
  }

  const KOREAN = {
    Overlays: "오버레이", Quests: "퀘스트", Progress: "진행도", Squad: "분대", "Floor editor": "층 편집", Ruler: "거리 측정",
    "Hide panels": "패널 숨기기", "Show panels": "패널 보이기", "Full screen": "전체 화면", Fit: "맞춤",
    "Wall colors": "벽 색상", "Floor markers": "층 마커", "Icon scale": "아이콘 크기", Panel: "패널", right: "오른쪽", bottom: "아래", floating: "이동식",
    arrows: "화살표", opacity: "반투명", both: "둘 다"
  };
  KOREAN.Loot = "아이템 스폰";
  KOREAN["Battle Pass"] = "배틀패스";
  function t(value) { return state.language === "ko" ? (KOREAN[value] || value) : value; }
  function applyLanguage() {
    el.layersToggle.textContent = t("Overlays"); el.questToggle.textContent = t("Quests"); el.progressToggle.textContent = t("Progress");
    el.floorEditToggle.textContent = t("Floor editor");
    el.squadToggle.firstChild.textContent = `${t("Squad")} `; el.rulerToggle.textContent = t("Ruler");
    el.fullScreen.textContent = t("Full screen"); el.zoomReset.textContent = t("Fit");
    el.iconScaleLabel.textContent = t("Icon scale");
    const hidden = el.content.classList.contains("panels-hidden"); el.hidePanels.textContent = state.language === "ko" ? t(hidden ? "Show panels" : "Hide panels") : (hidden ? "Show pannels" : "Hide pannels");
    setPanelPosition(state.panelPosition); setMarkerMode(state.markerMode); setWallColors(state.wallColors);
    renderLayerList();
  }

  function setPanelsHidden(hidden) {
    el.content.classList.toggle("panels-hidden", Boolean(hidden));
    el.hidePanels.textContent = state.language === "ko" ? t(hidden ? "Show panels" : "Hide panels") : (hidden ? "Show pannels" : "Hide pannels");
    requestAnimationFrame(() => { layoutMapWorld(); resetView(); });
    return Boolean(hidden);
  }

  function togglePanels() {
    return setPanelsHidden(!el.content.classList.contains("panels-hidden"));
  }

  function showRightPanelPage(page) {
    const showPinned = page === "pinned";
    el.questDrawer.classList.toggle("open", !showPinned);
    el.pinnedDrawer.classList.toggle("open", showPinned);
    el.questToggle.classList.toggle("active", !showPinned);
    el.pinnedToggle.classList.toggle("active", showPinned);
  }

  function setPanelPosition(position) {
    state.panelPosition = ["right", "bottom", "floating"].includes(position) ? position : "right";
    el.content.classList.remove("panel-right", "panel-bottom", "panel-floating");
    el.content.classList.add(`panel-${state.panelPosition}`);
    if (state.panelPosition === "floating" && state.panelOffset.x >= 0 && state.panelOffset.y >= 0) {
      el.requirementsPanel.style.left = `${state.panelOffset.x}px`;
      el.requirementsPanel.style.top = `${state.panelOffset.y}px`;
      el.requirementsPanel.style.right = "auto";
      el.requirementsPanel.style.bottom = "auto";
    } else if (state.panelPosition !== "floating") {
      el.requirementsPanel.style.left = ""; el.requirementsPanel.style.top = "";
      el.requirementsPanel.style.right = ""; el.requirementsPanel.style.bottom = "";
    }
    el.panelPosition.textContent = `${t("Panel")}: ${t(state.panelPosition)}`;
    localStorage.setItem("eft-panel-position", state.panelPosition);
  }

  function setMarkerMode(mode) {
    state.markerMode = ["arrows", "opacity", "both"].includes(mode) ? mode : "arrows";
    el.markerMode.textContent = `${t("Floor markers")}: ${t(state.markerMode)}`;
    renderMarkers();
  }

  function setWallColors(enabled) {
    state.wallColors = Boolean(enabled);
    el.wallToggle.setAttribute("aria-pressed", String(state.wallColors));
    el.wallToggle.textContent = `${t("Wall colors")}: ${state.wallColors ? (state.language === "ko" ? "켜짐" : "on") : (state.language === "ko" ? "꺼짐" : "off")}`;
    applyWallPalette();
  }

  function configure(options = {}) {
    state.language = options.language === "ko" ? "ko" : "en";
    document.documentElement.lang = state.language;
    if (options.panelOffset && Number.isFinite(Number(options.panelOffset.x)) && Number.isFinite(Number(options.panelOffset.y)))
      state.panelOffset = { x: Number(options.panelOffset.x), y: Number(options.panelOffset.y) };
    setScale(options.uiScale);
    setIconScale(options.iconScale ?? state.iconScale);
    setPanelPosition(options.panelPosition || state.panelPosition);
    setMarkerMode(options.markerMode || state.markerMode);
    setWallColors(options.wallColors);
    window.__eftAutoPan = options.autoPanning !== false;
    applyLanguage();
    if (options.progress) setProgress(options.progress);
    if (options.squad) setSquadSettings(options.squad);
    if (Array.isArray(options.visibleLayers)) {
      state.visibleLayers = new Set(options.visibleLayers.filter(id => LAYER_BY_ID.has(id)));
      renderLayerList(); renderMarkers();
    }
    if (Array.isArray(options.pinnedQuests)) setPinnedQuests(options.pinnedQuests);
    if (options.map && normalizeMapKey(options.map) !== state.mapKey) loadMap(options.map);
  }

  function setPinnedQuests(values) {
    state.pinned = new Set((values || []).map(String));
    renderQuests();
    renderRequirements();
    renderMarkers();
  }

  function applyTransform() {
    const { x, y, scale } = state.transform;
    el.mapWorld.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    document.documentElement.style.setProperty("--map-inverse-scale", 1 / Math.max(scale, .001));
  }

  function layoutMapWorld() {
    const width = Math.max(1, el.mapViewport.clientWidth);
    const height = Math.max(1, el.mapViewport.clientHeight);
    const viewportAspect = width / height;
    let mapWidth;
    let mapHeight;
    let left;
    let top;
    if (viewportAspect > state.svgAspect) {
      mapHeight = height;
      mapWidth = height * state.svgAspect;
      left = (width - mapWidth) / 2;
      top = 0;
    } else {
      mapWidth = width;
      mapHeight = width / state.svgAspect;
      left = 0;
      top = (height - mapHeight) / 2;
    }
    state.mapFrame = { left, top, width: mapWidth, height: mapHeight };
    Object.assign(el.mapWorld.style, {
      inset: "auto",
      left: `${left}px`,
      top: `${top}px`,
      width: `${mapWidth}px`,
      height: `${mapHeight}px`
    });
  }

  function resetView() {
    state.transform = { x: 0, y: 0, scale: 1 };
    applyTransform();
  }

  function zoomAt(factor, clientX, clientY) {
    const rect = el.mapViewport.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const old = state.transform.scale;
    const next = Math.min(6, Math.max(.5, old * factor));
    state.transform.x = px - state.mapFrame.left - (px - state.mapFrame.left - state.transform.x) * next / old;
    state.transform.y = py - state.mapFrame.top - (py - state.mapFrame.top - state.transform.y) * next / old;
    state.transform.scale = next;
    applyTransform();
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
  }

  let drag = null;
  el.mapViewport.addEventListener("pointerdown", event => {
    if (event.target.closest("button")) return;
    if (state.floorEditor.enabled) {
      addFloorVertex(event.clientX, event.clientY);
      return;
    }
    if (state.rulerActive) {
      addRulerPoint(event.clientX, event.clientY);
      return;
    }
    el.markerPopup.hidden = true;
    drag = { x: event.clientX, y: event.clientY, tx: state.transform.x, ty: state.transform.y };
    el.mapViewport.setPointerCapture(event.pointerId);
    el.mapViewport.classList.add("dragging");
  });
  el.mapViewport.addEventListener("pointermove", event => {
    if (!drag) return;
    state.transform.x = drag.tx + event.clientX - drag.x;
    state.transform.y = drag.ty + event.clientY - drag.y;
    applyTransform();
  });
  el.mapViewport.addEventListener("pointerup", () => { drag = null; el.mapViewport.classList.remove("dragging"); });
  el.mapViewport.addEventListener("wheel", event => {
    event.preventDefault();
    if (event.altKey && state.map) {
      const current = state.map.floors.indexOf(state.currentFloor);
      const next = Math.min(state.map.floors.length - 1, Math.max(0, current + (event.deltaY < 0 ? 1 : -1)));
      if (next !== current) selectFloor(state.map.floors[next]);
      return;
    }
    zoomAt(event.deltaY < 0 ? 1.13 : .885, event.clientX, event.clientY);
  }, { passive: false });

  let panelDrag = null;
  el.requirementsHandle.addEventListener("pointerdown", event => {
    if (state.panelPosition !== "floating") return;
    const rect = el.requirementsPanel.getBoundingClientRect();
    panelDrag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    el.requirementsHandle.setPointerCapture(event.pointerId);
  });
  el.requirementsHandle.addEventListener("pointermove", event => {
    if (!panelDrag) return;
    const parent = el.content.getBoundingClientRect();
    el.requirementsPanel.style.left = `${panelDrag.left - parent.left + event.clientX - panelDrag.x}px`;
    el.requirementsPanel.style.top = `${panelDrag.top - parent.top + event.clientY - panelDrag.y}px`;
    el.requirementsPanel.style.right = "auto";
    el.requirementsPanel.style.bottom = "auto";
  });
  el.requirementsHandle.addEventListener("pointerup", () => {
    if (panelDrag) {
      state.panelOffset = { x: parseFloat(el.requirementsPanel.style.left) || 0, y: parseFloat(el.requirementsPanel.style.top) || 0 };
      post("panel-offset-changed", state.panelOffset);
    }
    panelDrag = null;
  });

  el.layersToggle.addEventListener("click", () => el.layerDrawer.scrollTo({ top: 0, behavior: "smooth" }));
  el.questToggle.addEventListener("click", () => showRightPanelPage("quests"));
  el.pinnedToggle.addEventListener("click", () => showRightPanelPage("pinned"));
  el.mapSearch.addEventListener("input", renderSearchResults);
  el.questSearch.addEventListener("input", renderQuests);
  el.rulerToggle.addEventListener("click", () => setRuler(!state.rulerActive));
  el.hidePanels.addEventListener("click", togglePanels);
  el.fullScreen.addEventListener("click", () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
  el.whereAmI.addEventListener("click", () => post("force-run"));
  el.wallToggle.addEventListener("click", () => { setWallColors(!state.wallColors); post("wall-colors-changed", { enabled: state.wallColors }); });
  el.iconScaleSlider.addEventListener("input", () => setIconScale(Number(el.iconScaleSlider.value) / 100));
  el.iconScaleSlider.addEventListener("change", () => post("icon-scale-changed", { scale: state.iconScale }));
  el.markerMode.addEventListener("click", () => { const modes = ["arrows", "opacity", "both"]; setMarkerMode(modes[(modes.indexOf(state.markerMode) + 1) % modes.length]); post("marker-mode-changed", { mode: state.markerMode }); });
  el.panelPosition.addEventListener("click", () => { const positions = ["right", "bottom", "floating"]; setPanelPosition(positions[(positions.indexOf(state.panelPosition) + 1) % positions.length]); post("panel-position-changed", { position: state.panelPosition }); });
  el.zoomIn.addEventListener("click", () => zoomAt(1.2, innerWidth / 2, innerHeight / 2));
  el.zoomOut.addEventListener("click", () => zoomAt(1 / 1.2, innerWidth / 2, innerHeight / 2));
  el.zoomReset.addEventListener("click", resetView);
  el.progressToggle.addEventListener("click", () => { renderProgressForm(); el.progressDialog.showModal(); });
  el.floorEditToggle.addEventListener("click", () => {
    if (window.chrome?.webview) post("toggle-floor-edit-mode");
    else setFloorEditor(!state.floorEditor.enabled, [], []);
  });
  el.questFilterButtons.addEventListener("click", event => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    state.progress.filter = button.dataset.filter;
    renderProgressForm();
  });
  el.progressForm.addEventListener("submit", event => { event.preventDefault(); readProgressForm(); el.progressDialog.close(); });
  el.resetProgress.addEventListener("click", () => { state.progress.completedQuests.clear(); persistProgress(); renderQuests(); renderRequirements(); });
  el.squadToggle.addEventListener("click", () => { setSquadSettings(state.squad); renderSquadMembers(); el.squadDialog.showModal(); });
  el.squadMode.addEventListener("change", updateSquadFields);
  el.generateSquadPassword.addEventListener("click", () => { el.squadPassword.value = createSquadPassword(); el.squadPassword.type = "text"; });
  el.squadForm.addEventListener("submit", event => {
    event.preventDefault();
    const mode = el.squadMode.value;
    const requiresPassword = mode === "host" || mode === "client";
    el.squadPassword.setCustomValidity(requiresPassword && el.squadPassword.value.length < 8 ? "Use at least 8 characters." : "");
    if (!el.squadForm.reportValidity()) return;
    setSquadSettings({ mode, enabled: mode !== "off", name: el.squadName.value.trim(), room: el.squadRoom.value.trim(), host: el.squadHost.value.trim(), password: el.squadPassword.value, port: Number(el.squadPort.value) });
    post("squad-settings-changed", state.squad);
    el.squadDialog.close();
  });
  el.floorEditorExit.addEventListener("click", () => { setFloorEditor(false); post("exit-floor-edit-mode"); });
  el.floorUndo.addEventListener("click", () => { state.floorEditor.vertices.pop(); renderFloorEditor(); });
  el.floorComplete.addEventListener("click", completeFloorZone);
  el.floorDelete.addEventListener("click", () => { state.floorEditor.zones.pop(); renderFloorEditor(); });
  el.floorSave.addEventListener("click", () => post("save-floor-zones", { data: JSON.stringify(state.floorEditor.zones) }));
  new ResizeObserver(() => {
    layoutMapWorld();
    resetView();
  }).observe(el.mapViewport);

  window.eftMap = {
    configure,
    setIconScale,
    setMap: loadMap,
    setPinnedQuests,
    setPlayerPosition,
    setSquadMembers,
    setSquadStatus,
    focusItem,
    toggleLayer,
    selectFloor,
    selectFloorByIndex: index => state.map?.floors[index] ? selectFloor(state.map.floors[index]) : false,
    selectFloorByHotkey,
    setProgress,
    setFloorEditor,
    setPanelsHidden,
    togglePanels,
    toggleRequirements: togglePanels,
    resetView,
    getCalibrationReport: calibrationReport,
    getState: () => ({ map: state.mapKey, floor: state.currentFloor, pinned: [...state.pinned], markerMode: state.markerMode, panelPosition: state.panelPosition, wallColors: state.wallColors, iconScale: state.iconScale, visibleLayers: [...state.visibleLayers], focusedItemId: state.focusedItemId, progress: progressPayload(), floorEditor: { enabled: state.floorEditor.enabled, zones: state.floorEditor.zones.length } })
  };

  try {
    const savedLayers = JSON.parse(localStorage.getItem("eft-visible-layers") || "null");
    if (Array.isArray(savedLayers)) state.visibleLayers = new Set(savedLayers.filter(id => LAYER_BY_ID.has(id)));
  } catch { }
  state.panelPosition = localStorage.getItem("eft-panel-position") || "right";
  setPanelPosition(state.panelPosition);
  setIconScale(Number(localStorage.getItem("eft-icon-scale")) || 1);
  loadMap(state.mapKey);
  loadQuests();
  loadMarkerData();
  loadBattlePassData();
})();
