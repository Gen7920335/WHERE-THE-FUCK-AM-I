(() => {
  "use strict";

  const QUEST_DATA_URL = "quest-locations.json";
  const SVG_ROOT = "https://assets.tarkov.dev/maps/svg";
  const MAPS = {
    factory: { dataKey: "factory", id: 0, tdevId: "55f2d3fd4bdc2d5f408b4567", svg: "Factory.svg", floors: ["Basement", "Ground_Floor", "Second_Floor", "Third_Floor"], defaultFloor: "Ground_Floor", rotation: 90, bounds: [[77, -64.5], [-65.5, 67.4]], anchors: [{ world: [77, 67.4], map: [0, 0] }, { world: [77, -64.5], map: [100, 0] }, { world: [-65.5, 67.4], map: [0, 100] }] },
    customs: { dataKey: "customs", id: 1, tdevId: "56f40101d2720b2a4d8b45d6", svg: "Customs.svg", floors: ["Ground_Level", "Underground_Level", "Second_Floor", "Third_Floor"], defaultFloor: "Ground_Level", rotation: 180, bounds: [[698, -307], [-372, 237]], anchors: [{ world: [698, -307], map: [0, 0] }, { world: [-372, -307], map: [100, 0] }, { world: [698, 237], map: [0, 100] }] },
    woods: { dataKey: "woods", id: 2, tdevId: "5704e3c2d2720bac5b8b4567", svg: "Woods.svg", floors: ["Ground_Level"], defaultFloor: "Ground_Level", rotation: 180, bounds: [[646, -914], [-761, 442]], anchors: [{ world: [646, -914], map: [0, 0] }, { world: [-761, -914], map: [100, 0] }, { world: [646, 442], map: [0, 100] }] },
    shoreline: { dataKey: "shoreline", id: 3, tdevId: "5704e554d2720bac5b8b456e", svg: "Shoreline.svg", floors: ["Underground_Level", "Ground_Level", "Second_Floor", "Third_Floor"], defaultFloor: "Ground_Level", rotation: 180, bounds: [[504, -415], [-1056, 618]], anchors: [{ world: [504, -415], map: [0, 0] }, { world: [-1056, -415], map: [100, 0] }, { world: [504, 618], map: [0, 100] }] },
    interchange: { dataKey: "interchange", id: 4, tdevId: "5714dbc024597771384a510d", svg: "Interchange.svg", floors: ["Ground_Level", "First_Floor", "Second_Floor"], defaultFloor: "Ground_Level", rotation: 180, bounds: [[598, -442], [-433, 426]], anchors: [{ world: [598, -442], map: [0, 0] }, { world: [-433, -442], map: [100, 0] }, { world: [598, 426], map: [0, 100] }] },
    lab: { dataKey: "lab", id: 5, tdevId: "5b0fc42d86f7744a585f9105", svg: "Labs.svg", floors: ["Technical_Level", "First_Level", "Second_Level"], defaultFloor: "Technical_Level", rotation: 270, bounds: [[-80, -477], [-287, -193]], anchors: [{ world: [-287, -477], map: [0, 0] }, { world: [-287, -193], map: [100, 0] }, { world: [-80, -477], map: [0, 100] }] },
    reserve: { dataKey: "reserve", id: 6, tdevId: "5704e5fad2720bc05b8b4567", svg: "Reserve.svg", floors: ["Bunkers", "Ground_Level"], defaultFloor: "Ground_Level", rotation: 180, bounds: [[289, -274], [-303, 272]], anchors: [{ world: [289, -274], map: [0, 0] }, { world: [-303, -274], map: [100, 0] }, { world: [289, 272], map: [0, 100] }] },
    lighthouse: { dataKey: "lighthouse", id: 7, tdevId: "5704e4dad2720bb55b8b4567", svg: "Lighthouse.svg", floors: ["Ground_Level"], defaultFloor: "Ground_Level", rotation: 180, bounds: [[515, -998], [-545, 725]], anchors: [{ world: [515, -998], map: [0, 0] }, { world: [-545, -998], map: [100, 0] }, { world: [515, 725], map: [0, 100] }] },
    streets: { dataKey: "streetsoftarkov", id: 8, tdevId: "5714dc692459777137212e12", svg: "StreetsOfTarkov.svg", floors: ["Underground_Level", "Ground_Level", "Second_Floor", "Third_Floor", "Fourth_Floor", "Fifth_Floor"], defaultFloor: "Ground_Level", rotation: 180, bounds: [[323, -295], [-280, 532]], anchors: [{ world: [323, -295], map: [0, 0] }, { world: [-280, -295], map: [100, 0] }, { world: [323, 532], map: [0, 100] }] },
    "ground-zero": { dataKey: "groundzero", id: 9, tdevId: "653e6760052c01c1c805532f", svg: "GroundZero.svg", floors: ["Underground_Level", "Ground_Level", "Second_Floor", "Third_Floor"], defaultFloor: "Ground_Level", rotation: 180, bounds: [[249, -124], [-99, 364]], anchors: [{ world: [249, -124], map: [0, 0] }, { world: [-99, -124], map: [100, 0] }, { world: [249, 364], map: [0, 100] }] }
  };
  const FLOOR_ALIASES = {};

  const state = {
    mapKey: new URLSearchParams(location.search).get("map") || "interchange",
    map: null,
    quests: [],
    pinned: new Set(),
    currentFloor: "",
    markerMode: "arrows",
    panelPosition: "right",
    wallColors: false,
    uiScale: 1,
    transform: { x: 0, y: 0, scale: 1 },
    svgAspect: 1,
    mapFrame: { left: 0, top: 0, width: 1, height: 1 },
    player: null
  };

  const el = Object.fromEntries([
    "content", "questDrawer", "questList", "questSearch", "questStatus", "floorButtons", "mapViewport",
    "mapWorld", "svgHost", "markerLayer", "mapStatus", "requirementsPanel", "requirementsHandle",
    "requirementsList", "pinCount", "wallToggle", "markerMode", "panelPosition", "questToggle",
    "zoomIn", "zoomOut", "zoomReset"
  ].map(id => [id, document.getElementById(id)]));

  function post(action, data = {}) {
    if (window.chrome?.webview) window.chrome.webview.postMessage(JSON.stringify({ action, ...data }));
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
    state.currentFloor = state.map.defaultFloor;
    el.mapStatus.textContent = `Loading ${state.mapKey}…`;
    renderFloorButtons();
    try {
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
      layoutMapWorld();
      applyFloor();
      applyWallPalette();
      renderQuests();
      renderMarkers();
      resetView();
      el.mapStatus.textContent = "tarkov.dev SVG · wheel to zoom · drag to pan";
      post("map-ready", { map: state.mapKey });
    } catch (error) {
      el.mapStatus.textContent = `Map load failed: ${error.message}`;
    }
  }

  async function loadQuests() {
    try {
      const response = await fetch(QUEST_DATA_URL, { cache: "no-cache" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const snapshot = await response.json();
      state.quests = snapshot.tasks || [];
      el.questStatus.hidden = true;
      renderQuests();
      renderRequirements();
      renderMarkers();
    } catch (error) {
      el.questStatus.hidden = false;
      el.questStatus.textContent = `Quest data load failed: ${error.message}`;
    }
  }

  function mapQuests() {
    if (!state.map) return [];
    return state.quests.filter(quest => quest.objectives?.some(objective => objectiveLocationsOnMap(objective).length));
  }

  function objectiveLocationsOnMap(objective) {
    if (!state.map) return [];
    return (objective.locations || []).filter(location => location.map === state.map.tdevId);
  }

  function renderQuests() {
    const query = el.questSearch.value.trim().toLowerCase();
    const fragment = document.createDocumentFragment();
    for (const quest of mapQuests().filter(q => !query || q.name.toLowerCase().includes(query))) {
      const label = document.createElement("label");
      label.className = "quest-row";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.pinned.has(String(quest.id)) || state.pinned.has(quest.name);
      checkbox.addEventListener("change", () => toggleQuest(quest, checkbox.checked));
      const text = document.createElement("span");
      const locations = quest.objectives.reduce((count, objective) => count + objectiveLocationsOnMap(objective).length, 0);
      text.innerHTML = `<strong>${escapeHtml(quest.name)}</strong><small>${locations} map location${locations === 1 ? "" : "s"}</small>`;
      label.append(checkbox, text);
      fragment.append(label);
    }
    el.questList.replaceChildren(fragment);
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
        if (required) requirements.push(`Complete: ${required.name}`);
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
    for (const floor of state.map.floors) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = friendlyFloor(floor);
      button.classList.toggle("active", floor === state.currentFloor);
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
    const svg = el.svgHost.querySelector("svg");
    if (!svg || !state.map) return;
    const known = new Set(state.map.floors);
    for (const group of svg.querySelectorAll("g[id]")) {
      if (known.has(group.id)) group.style.display = group.id === state.currentFloor ? "" : "none";
    }
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
    `;
    svg.append(style);
  }

  function renderMarkers() {
    el.markerLayer.replaceChildren();
    if (!state.map) return;
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
          el.markerLayer.append(marker);
        }
      }
    }
    if (state.player) renderPlayerMarker();
  }

  function focusRequirement(quest) {
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

  function objectiveFloorRank(location) {
    const y = Number(location.y);
    if (!Number.isFinite(y)) return null;
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

  function quaternionYaw(qx, qy, qz, qw) {
    const siny = 2 * (qw * qy + qx * qz);
    const cosy = 1 - 2 * (qy * qy + qz * qz);
    return Math.atan2(siny, cosy) * 180 / Math.PI;
  }

  function renderPlayerMarker() {
    const pos = worldToPercent(state.player.x, state.player.z);
    const marker = document.createElement("div");
    marker.className = "player-marker";
    marker.style.left = `${pos.left}%`;
    marker.style.top = `${pos.top}%`;
    let mapRotation = state.map.rotation;
    if (mapRotation === 90 || mapRotation === 270) mapRotation += 180;
    const heading = quaternionYaw(state.player.qx, state.player.qy, state.player.qz, state.player.qw) + mapRotation;
    marker.style.setProperty("--heading", `${heading}deg`);
    marker.title = `Player: ${state.player.x.toFixed(1)}, ${state.player.y.toFixed(1)}, ${state.player.z.toFixed(1)}`;
    el.markerLayer.append(marker);
  }

  function setPlayerPosition(position) {
    const values = [position.x, position.y, position.z, position.qx, position.qy, position.qz, position.qw].map(Number);
    if (values.some(v => !Number.isFinite(v))) return false;
    state.player = { x: values[0], y: values[1], z: values[2], qx: values[3], qy: values[4], qz: values[5], qw: values[6] };
    renderMarkers();
    if (state.player && state.map && window.__eftAutoPan !== false) panToPlayer();
    return true;
  }

  function panToPlayer() {
    const pos = worldToPercent(state.player.x, state.player.z);
    const rect = el.mapViewport.getBoundingClientRect();
    const worldX = state.mapFrame.width * pos.left / 100;
    const worldY = state.mapFrame.height * pos.top / 100;
    state.transform.x = rect.width / 2 - state.mapFrame.left - worldX * state.transform.scale;
    state.transform.y = rect.height / 2 - state.mapFrame.top - worldY * state.transform.scale;
    applyTransform();
  }

  function setScale(scale) {
    state.uiScale = Math.min(2, Math.max(.65, Number(scale) || 1));
    document.documentElement.style.setProperty("--ui-scale", state.uiScale);
  }

  function setPanelPosition(position) {
    state.panelPosition = ["right", "bottom", "floating"].includes(position) ? position : "right";
    el.content.classList.remove("panel-right", "panel-bottom", "panel-floating");
    el.content.classList.add(`panel-${state.panelPosition}`);
    el.panelPosition.textContent = `Panel: ${state.panelPosition}`;
    localStorage.setItem("eft-panel-position", state.panelPosition);
  }

  function setMarkerMode(mode) {
    state.markerMode = ["arrows", "opacity", "both"].includes(mode) ? mode : "arrows";
    el.markerMode.textContent = `Floor markers: ${state.markerMode}`;
    renderMarkers();
  }

  function setWallColors(enabled) {
    state.wallColors = Boolean(enabled);
    el.wallToggle.setAttribute("aria-pressed", String(state.wallColors));
    el.wallToggle.textContent = `Wall colors: ${state.wallColors ? "on" : "off"}`;
    applyWallPalette();
  }

  function configure(options = {}) {
    setScale(options.uiScale);
    setPanelPosition(options.panelPosition || state.panelPosition);
    setMarkerMode(options.markerMode || state.markerMode);
    setWallColors(options.wallColors);
    window.__eftAutoPan = options.autoPanning !== false;
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
  el.mapViewport.addEventListener("wheel", event => { event.preventDefault(); zoomAt(event.deltaY < 0 ? 1.13 : .885, event.clientX, event.clientY); }, { passive: false });

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
  el.requirementsHandle.addEventListener("pointerup", () => { panelDrag = null; });

  el.questToggle.addEventListener("click", () => el.questDrawer.classList.toggle("open"));
  el.questSearch.addEventListener("input", renderQuests);
  el.wallToggle.addEventListener("click", () => { setWallColors(!state.wallColors); post("wall-colors-changed", { enabled: state.wallColors }); });
  el.markerMode.addEventListener("click", () => { const modes = ["arrows", "opacity", "both"]; setMarkerMode(modes[(modes.indexOf(state.markerMode) + 1) % modes.length]); post("marker-mode-changed", { mode: state.markerMode }); });
  el.panelPosition.addEventListener("click", () => { const positions = ["right", "bottom", "floating"]; setPanelPosition(positions[(positions.indexOf(state.panelPosition) + 1) % positions.length]); post("panel-position-changed", { position: state.panelPosition }); });
  el.zoomIn.addEventListener("click", () => zoomAt(1.2, innerWidth / 2, innerHeight / 2));
  el.zoomOut.addEventListener("click", () => zoomAt(1 / 1.2, innerWidth / 2, innerHeight / 2));
  el.zoomReset.addEventListener("click", resetView);
  new ResizeObserver(() => {
    layoutMapWorld();
    resetView();
  }).observe(el.mapViewport);

  window.eftMap = {
    configure,
    setMap: loadMap,
    setPinnedQuests,
    setPlayerPosition,
    selectFloor,
    selectFloorByIndex: index => state.map?.floors[index] ? selectFloor(state.map.floors[index]) : false,
    toggleRequirements: () => { el.requirementsPanel.hidden = !el.requirementsPanel.hidden; return el.requirementsPanel.hidden; },
    resetView,
    getCalibrationReport: calibrationReport,
    getState: () => ({ map: state.mapKey, floor: state.currentFloor, pinned: [...state.pinned], markerMode: state.markerMode, panelPosition: state.panelPosition, wallColors: state.wallColors })
  };

  state.panelPosition = localStorage.getItem("eft-panel-position") || "right";
  setPanelPosition(state.panelPosition);
  loadMap(state.mapKey);
  loadQuests();
})();
