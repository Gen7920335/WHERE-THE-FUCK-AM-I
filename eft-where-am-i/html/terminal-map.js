(() => {
  'use strict';

  // Tarkov.dev Terminal bounds after its 180-degree CRS projection.
  // Source bounds: [[463, -580], [-433, 475]].
  const SOURCE_WIDTH = 887.70096;
  const SOURCE_HEIGHT = 1043.9554;
  const WORLD_WIDTH = 896;
  const WORLD_HEIGHT = 1055;
  // The photographed in-game wall map is not aligned to a perfect 90-degree
  // axis. Edge-orientation sampling puts the source's main rail axis at 75.3
  // degrees, while the matching wall-map axis is horizontal.
  const MAP_ROTATION_DEGREES = -75.3;
  const MAP_ROTATION_RADIANS = MAP_ROTATION_DEGREES * Math.PI / 180;
  const MAP_ROTATION_COS = Math.cos(MAP_ROTATION_RADIANS);
  const MAP_ROTATION_SIN = Math.sin(MAP_ROTATION_RADIANS);
  const rotatedCorners = [
    { x: 0, y: 0 },
    { x: SOURCE_WIDTH * MAP_ROTATION_COS, y: SOURCE_WIDTH * MAP_ROTATION_SIN },
    { x: -SOURCE_HEIGHT * MAP_ROTATION_SIN, y: SOURCE_HEIGHT * MAP_ROTATION_COS },
    {
      x: (SOURCE_WIDTH * MAP_ROTATION_COS) - (SOURCE_HEIGHT * MAP_ROTATION_SIN),
      y: (SOURCE_WIDTH * MAP_ROTATION_SIN) + (SOURCE_HEIGHT * MAP_ROTATION_COS)
    }
  ];
  const ROTATED_MIN_X = Math.min(...rotatedCorners.map((point) => point.x));
  const ROTATED_MAX_X = Math.max(...rotatedCorners.map((point) => point.x));
  const ROTATED_MIN_Y = Math.min(...rotatedCorners.map((point) => point.y));
  const ROTATED_MAX_Y = Math.max(...rotatedCorners.map((point) => point.y));
  const DISPLAY_WIDTH = ROTATED_MAX_X - ROTATED_MIN_X;
  const ROTATED_DISPLAY_HEIGHT = ROTATED_MAX_Y - ROTATED_MIN_Y;
  const REFERENCE_MAP_ASPECT_RATIO = 1280 / 905;
  const DISPLAY_HEIGHT = Math.min(ROTATED_DISPLAY_HEIGHT, DISPLAY_WIDTH / REFERENCE_MAP_ASPECT_RATIO);
  const DISPLAY_CROP_TOP = Math.min(157, Math.max(0, ROTATED_DISPLAY_HEIGHT - DISPLAY_HEIGHT));
  const SEA_PADDING_X = 80;
  const SEA_PADDING_Y = 55;
  const FOOTPRINT_WIDTH = DISPLAY_WIDTH + (SEA_PADDING_X * 2);
  const FOOTPRINT_HEIGHT = DISPLAY_HEIGHT + (SEA_PADDING_Y * 2);
  const ROTATION_OFFSET_X = -ROTATED_MIN_X;
  const ROTATION_OFFSET_Y = -ROTATED_MIN_Y;

  const viewport = document.querySelector('.terminal-map-viewport');
  const mapStage = document.getElementById('terminalMapStage');
  const mapWrap = document.querySelector('.map-wrap');
  const mapSurface = document.getElementById('terminalMapSurface');
  const playerMarker = document.getElementById('terminalPlayerMarker');
  const markerLayer = document.getElementById('terminalMarkerLayer');
  const layerList = document.getElementById('terminalLayerList');
  const rightLayersList = document.getElementById('terminalRightLayersList');
  const questList = document.getElementById('terminalQuestList');
  const leftCollapse = document.getElementById('terminalLeftCollapse');
  const popup = document.getElementById('terminalPopup');
  const locationInput = document.getElementById('terminalLocationInput');
  const whereButton = document.getElementById('terminalWhereButton');
  const panelToggle = document.getElementById('terminalPanelToggle');
  const fullScreen = document.getElementById('terminalFullScreen');
  const status = document.getElementById('terminalStatus');
  const terminalData = window.__wtfTerminalData || { sections: [], filters: [], markers: [] };
  const FILTER_STATE_VERSION = 3;

  const filterState = new Map();
  const questSelectionState = new Map();
  const filtersById = new Map(terminalData.filters.map((filter) => [filter.id, filter]));
  const markerElements = new Map();
  let activePopupMarker = null;

  try {
    const storedVersion = Number(localStorage.getItem('wtf-terminal-filter-version') || 0);
    const stored = storedVersion === FILTER_STATE_VERSION
      ? JSON.parse(localStorage.getItem('wtf-terminal-filters') || '{}')
      : {};
    for (const filter of terminalData.filters) {
      filterState.set(filter.id, typeof stored[filter.id] === 'boolean' ? stored[filter.id] : filter.defaultVisible !== false);
    }
    localStorage.setItem('wtf-terminal-filter-version', String(FILTER_STATE_VERSION));
    localStorage.setItem('wtf-terminal-filters', JSON.stringify(Object.fromEntries(filterState)));
  } catch {
    for (const filter of terminalData.filters) filterState.set(filter.id, filter.defaultVisible !== false);
  }

  try {
    const storedSelections = JSON.parse(localStorage.getItem('wtf-terminal-quest-selections') || '{}');
    for (const filter of terminalData.filters.filter((entry) => entry.section === 'quests')) {
      questSelectionState.set(
        filter.id,
        typeof storedSelections[filter.id] === 'boolean' ? storedSelections[filter.id] : true
      );
    }
  } catch {
    for (const filter of terminalData.filters.filter((entry) => entry.section === 'quests')) {
      questSelectionState.set(filter.id, true);
    }
  }

  const view = {
    scale: 1,
    x: 0,
    y: 0,
    dragging: false,
    pointerId: -1,
    lastX: 0,
    lastY: 0,
    fitted: false
  };

  const marketSvgStyle = `
    /* Tarkov Market palette and line hierarchy measured from Factory/Customs SVG. */
    .land { fill: #3a3e48 !important; }
    .trees { display: none !important; }
    .cement { fill: #58595b !important; }
    .rock { fill: #6d6e71 !important; stroke: #000 !important; stroke-width: .5px !important; }
    .water { fill: #97c9d6 !important; }
    #Ocean { display: none !important; }
    .wood { fill: #58595b !important; }
    .tarmac, .gravel { fill: #58595b !important; }
    .locked { fill: #24272d !important; }
    .map_border { fill: none !important; stroke: #000 !important; stroke-width: 2px !important; }
    .fence { fill: none !important; stroke: #000 !important; stroke-width: .5px !important; }
    .road_tarmac { fill: none !important; stroke: #6d6e71 !important; }
    .road_medium { stroke-width: 8px !important; }
    .powerline { display: none !important; }
    .danger { fill: #ff4545 !important; fill-opacity: .35 !important; stroke: #ff4545 !important; stroke-dasharray: 4 2 !important; stroke-width: 2px !important; }
    .stairs { fill: #fcee21 !important; stroke: #000 !important; stroke-width: .5px !important; }
    svg[data-terminal-floor="2"] .stairs { fill: #c87d2a !important; }
    .floor { fill: #a1d4a8 !important; stroke: #000 !important; stroke-width: .5px !important; }
    #Terminal_Rail_Body path { fill: none !important; stroke: #231f20 !important; stroke-width: 5px !important; stroke-dasharray: none !important; }
    #Railroad path { fill: none !important; stroke: #6d6e71 !important; stroke-width: 1px !important; stroke-dasharray: 6 6 !important; }
    #Terminal_Building_Floors path,
    #Terminal_Building_Floors polygon,
    #Terminal_Building_Floors rect {
      fill: #a1d4a8 !important;
      stroke: none !important;
    }
    svg[data-terminal-floor="2"] #Terminal_Building_Floors path,
    svg[data-terminal-floor="2"] #Terminal_Building_Floors polygon,
    svg[data-terminal-floor="2"] #Terminal_Building_Floors rect {
      fill: #58595b !important;
    }
    #Terminal_Inactive_Structures path,
    #Terminal_Inactive_Structures circle,
    #Terminal_Inactive_Structures polygon,
    #Terminal_Inactive_Structures rect {
      fill: #58595b !important;
      stroke: #000 !important;
      stroke-width: .5px !important;
      stroke-linecap: butt !important;
      stroke-linejoin: miter !important;
      stroke-miterlimit: 10 !important;
    }
    #Terminal_Building_Walls path,
    #Terminal_Building_Walls polygon,
    #Terminal_Building_Walls rect {
      fill: none !important;
      stroke: #000 !important;
      stroke-width: 2px !important;
      stroke-linecap: butt !important;
      stroke-linejoin: miter !important;
      stroke-miterlimit: 10 !important;
    }
    #First_Floor { opacity: .28; }
    svg[data-terminal-floor="2"] #First_Floor { opacity: 1; }
  `;

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.style.color = isError ? '#ff7777' : '';
  };

  const markerGlyph = (marker) => {
    if (marker.kind === 'quest') return String(marker.order || '!');
    return ({
      key: '⚿',
      keycard: '▣',
      explosive: '✦',
      tool: '⌁',
      loot: '◆',
      boss: '☠',
      extract: '↗',
      location: '⌖',
      panel: 'ϟ'
    })[marker.kind] || '•';
  };

  const persistFilters = () => {
    localStorage.setItem('wtf-terminal-filters', JSON.stringify(Object.fromEntries(filterState)));
  };

  const persistQuestSelections = () => {
    localStorage.setItem('wtf-terminal-quest-selections', JSON.stringify(Object.fromEntries(questSelectionState)));
  };

  const selectedFloor = () => {
    const input = document.querySelector('input[name="layers"]:checked');
    return input?.value === 'Level 2' ? 2 : 1;
  };

  const updatePopupPosition = () => {
    if (!activePopupMarker || popup.hidden) return;
    const viewportRect = viewport.getBoundingClientRect();
    const markerRect = activePopupMarker.getBoundingClientRect();
    const popupWidth = popup.offsetWidth || 360;
    const popupHeight = popup.offsetHeight || 280;
    let left = markerRect.right - viewportRect.left + 12;
    let top = markerRect.top - viewportRect.top - 18;
    if (left + popupWidth > viewportRect.width - 10) {
      left = markerRect.left - viewportRect.left - popupWidth - 12;
    }
    left = Math.max(10, Math.min(viewportRect.width - popupWidth - 10, left));
    top = Math.max(10, Math.min(viewportRect.height - popupHeight - 10, top));
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  };

  const closePopup = () => {
    popup.hidden = true;
    popup.replaceChildren();
    activePopupMarker = null;
  };

  const openPopup = (marker, markerElement) => {
    activePopupMarker = markerElement;
    popup.replaceChildren();

    const header = document.createElement('header');
    header.className = 'terminal-popup-header';
    const title = document.createElement('strong');
    title.textContent = marker.title;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'terminal-popup-close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', closePopup);
    header.append(title, close);

    const body = document.createElement('div');
    body.className = 'terminal-popup-body';
    const details = document.createElement('p');
    details.textContent = marker.details || '';
    body.appendChild(details);
    if (marker.image) {
      const image = document.createElement('img');
      image.src = marker.image;
      image.alt = `${marker.title} location guide`;
      image.loading = 'eager';
      body.appendChild(image);
    }
    if (marker.sourceUrl) {
      const source = document.createElement('a');
      source.href = marker.sourceUrl;
      source.textContent = 'Source / guide';
      source.target = '_blank';
      source.rel = 'noreferrer';
      body.appendChild(source);
    }
    popup.append(header, body);
    popup.hidden = false;
    requestAnimationFrame(updatePopupPosition);
  };

  const updateMarkerScale = () => {
    const compensation = 1 / Math.max(.01, view.scale);
    markerLayer?.style.setProperty('--terminal-marker-compensation', String(compensation));
  };

  const updateMarkers = () => {
    const floor = selectedFloor();
    for (const marker of terminalData.markers) {
      const element = markerElements.get(marker.id);
      if (!element) continue;
      const filter = filtersById.get(marker.filter);
      const questSelected = filter?.section !== 'quests' || questSelectionState.get(marker.filter) !== false;
      const visible = filterState.get(marker.filter) !== false && questSelected;
      element.hidden = !visible;
      element.classList.toggle('terminal-other-floor', visible && Number(marker.floor) !== floor);
    }
    updatePopupPosition();
  };

  const setFilter = (filterId, visible, notify = true) => {
    filterState.set(filterId, Boolean(visible));
    persistFilters();
    const checkbox = layerList?.querySelector(`input[data-filter-id="${CSS.escape(filterId)}"]`);
    const row = checkbox?.closest('.terminal-filter-row');
    if (checkbox) checkbox.checked = Boolean(visible);
    row?.classList.toggle('selected', Boolean(visible));
    document.querySelectorAll(`[data-filter-ref="${CSS.escape(filterId)}"]`).forEach((control) => {
      control.classList.toggle('active', Boolean(visible));
      control.setAttribute('aria-checked', String(Boolean(visible)));
    });
    if (!visible && activePopupMarker?.dataset.filterId === filterId) closePopup();
    updateMarkers();

  };

  const setQuestSelected = (filterId, selected, notify = true) => {
    questSelectionState.set(filterId, Boolean(selected));
    persistQuestSelections();
    const input = questList?.querySelector(`input[data-quest-selection="${CSS.escape(filterId)}"]`);
    const entry = input?.closest('.terminal-right-quest');
    if (input) input.checked = Boolean(selected);
    entry?.classList.toggle('selected', Boolean(selected));
    updateMarkers();

    if (notify && filterId === 'quest-ticket' && window.chrome?.webview) {
      window.chrome.webview.postMessage(JSON.stringify({
        action: 'quest-toggled', questName: 'The Ticket', isSelected: Boolean(selected)
      }));
    }
  };

  const renderPanel = () => {
    if (!layerList) return;
    layerList.replaceChildren();
    for (const section of terminalData.sections) {
      const group = document.createElement('section');
      group.className = 'mb-5 terminal-filter-section';
      group.dataset.section = section.id;
      const heading = document.createElement('button');
      heading.type = 'button';
      heading.className = 'terminal-section-heading';
      heading.setAttribute('aria-expanded', 'true');
      const headingText = document.createElement('span');
      headingText.className = 'bold';
      headingText.textContent = section.title;
      const headingToggle = document.createElement('span');
      headingToggle.textContent = '-/+';
      headingToggle.setAttribute('aria-hidden', 'true');
      heading.append(headingText, headingToggle);
      const items = document.createElement('div');
      items.className = 'items scroll terminal-filter-items';

      heading.addEventListener('click', () => {
        const collapsed = group.classList.toggle('collapsed');
        heading.setAttribute('aria-expanded', String(!collapsed));
      });

      for (const filter of terminalData.filters.filter((entry) => entry.section === section.id)) {
        const row = document.createElement('label');
        row.className = 'no-wrap d-flex terminal-filter-row';
        row.classList.toggle('selected', filterState.get(filter.id) !== false);
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.filterId = filter.id;
        checkbox.checked = filterState.get(filter.id) !== false;
        checkbox.addEventListener('change', () => setFilter(filter.id, checkbox.checked));
        const icon = document.createElement('span');
        icon.className = `terminal-filter-icon terminal-filter-icon-${filter.icon}`;
        icon.textContent = markerGlyph({ kind: filter.icon });
        const name = document.createElement('span');
        name.className = 'terminal-filter-name';
        name.textContent = filter.title;
        const main = document.createElement('span');
        main.className = 'terminal-filter-main';
        main.append(icon, name);
        const count = document.createElement('span');
        count.className = 'terminal-filter-count';
        count.textContent = String(terminalData.markers.filter((marker) => marker.filter === filter.id).length);
        row.append(checkbox, main, count);
        items.appendChild(row);
      }
      group.append(heading, items);
      layerList.appendChild(group);
    }
  };

  const createRightFilter = (filter) => {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'terminal-right-filter';
    control.dataset.filterRef = filter.id;
    control.setAttribute('role', 'checkbox');
    const active = filterState.get(filter.id) !== false;
    control.classList.toggle('active', active);
    control.setAttribute('aria-checked', String(active));

    const name = document.createElement('span');
    name.className = 'terminal-right-filter-name';
    name.textContent = filter.detailTitle || filter.title;
    const count = document.createElement('span');
    count.className = 'alt';
    count.textContent = `(${terminalData.markers.filter((marker) => marker.filter === filter.id).length})`;
    control.append(name, count);
    control.addEventListener('click', () => setFilter(filter.id, filterState.get(filter.id) === false));
    return control;
  };

  const createRightQuest = (filter) => {
    const entry = document.createElement('div');
    entry.className = 'terminal-right-quest';
    entry.classList.toggle('selected', questSelectionState.get(filter.id) !== false);

    const row = document.createElement('div');
    row.className = 'terminal-right-quest-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'terminal-quest-pin';
    checkbox.dataset.questSelection = filter.id;
    checkbox.checked = questSelectionState.get(filter.id) !== false;
    checkbox.setAttribute('aria-label', `Select ${filter.detailTitle || filter.title}`);
    checkbox.addEventListener('change', () => setQuestSelected(filter.id, checkbox.checked));

    const detailsButton = document.createElement('button');
    detailsButton.type = 'button';
    detailsButton.className = 'terminal-right-filter terminal-right-quest-detail story';
    detailsButton.setAttribute('aria-expanded', 'false');
    const name = document.createElement('span');
    name.className = 'terminal-right-filter-name';
    name.textContent = filter.detailTitle || filter.title;
    const markers = terminalData.markers
      .filter((marker) => marker.filter === filter.id)
      .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
    const count = document.createElement('span');
    count.className = 'alt';
    count.textContent = `(${markers.length})`;
    detailsButton.append(name, count);

    const objectives = document.createElement('div');
    objectives.className = 'terminal-quest-objectives';
    objectives.hidden = true;
    for (const marker of markers) {
      const objective = document.createElement('button');
      objective.type = 'button';
      objective.className = 'terminal-quest-objective';
      objective.textContent = `${String(marker.order || '').padStart(2, '0')}  ${marker.title}`;
      objective.addEventListener('click', () => {
        setFilter(filter.id, true, false);
        setQuestSelected(filter.id, true);
        const markerElement = markerElements.get(marker.id);
        if (markerElement) openPopup(marker, markerElement);
      });
      objectives.appendChild(objective);
    }

    detailsButton.addEventListener('click', () => {
      const expanded = objectives.hidden;
      objectives.hidden = !expanded;
      detailsButton.setAttribute('aria-expanded', String(expanded));
      entry.classList.toggle('expanded', expanded);
    });

    row.append(checkbox, detailsButton);
    entry.append(row, objectives);
    return entry;
  };

  const renderRightPanels = () => {
    rightLayersList?.replaceChildren();
    questList?.replaceChildren();
    for (const filter of terminalData.filters) {
      if (filter.section === 'map') rightLayersList?.appendChild(createRightFilter(filter));
      if (filter.section === 'quests') questList?.appendChild(createRightQuest(filter));
    }
  };

  const renderMarkers = () => {
    if (!markerLayer) return;
    markerLayer.replaceChildren();
    markerElements.clear();
    for (const marker of terminalData.markers) {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = `marker terminal-map-marker terminal-marker-${marker.kind}`;
      element.dataset.markerId = marker.id;
      element.dataset.filterId = marker.filter;
      element.dataset.floor = String(marker.floor || 1);
      element.style.left = `${marker.left}%`;
      element.style.top = `${marker.top}%`;
      element.title = marker.title;
      element.setAttribute('aria-label', marker.title);
      const icon = document.createElement('span');
      icon.className = 'terminal-marker-icon';
      icon.textContent = markerGlyph(marker);
      element.appendChild(icon);
      element.addEventListener('pointerdown', (event) => event.stopPropagation());
      element.addEventListener('dblclick', (event) => event.stopPropagation());
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        openPopup(marker, element);
      });
      markerElements.set(marker.id, element);
      markerLayer.appendChild(element);
    }
    updateMarkerScale();
    updateMarkers();
  };

  const project = (worldX, worldZ) => ({
    left: ((463 - Number(worldX)) / WORLD_WIDTH) * 100,
    top: ((Number(worldZ) + 580) / WORLD_HEIGHT) * 100
  });

  const projectDirection = (worldX, worldZ, quaternion) => {
    const [qx, qy, qz, qw] = quaternion;
    const forwardX = 2 * ((qx * qz) + (qw * qy));
    const forwardZ = 1 - (2 * ((qx * qx) + (qy * qy)));
    const start = project(worldX, worldZ);
    const end = project(worldX + forwardX, worldZ + forwardZ);
    return (Math.atan2(end.top - start.top, end.left - start.left) * 180 / Math.PI) + 90;
  };

  const parseLocation = (value) => {
    const parts = String(value || '').trim().split('_');
    if (parts.length < 3) return null;
    const coordinates = parts[1].split(',').map(Number);
    const quaternion = parts[2].split(',').slice(0, 4).map(Number);
    if (coordinates.length < 3 || quaternion.length < 4) return null;
    if (![coordinates[0], coordinates[2], ...quaternion].every(Number.isFinite)) return null;
    return {
      x: coordinates[0],
      elevation: coordinates[1],
      z: coordinates[2],
      quaternion
    };
  };

  const setLocationFromFilename = (filename) => {
    const location = parseLocation(filename);
    if (!location) {
      playerMarker.hidden = true;
      setStatus('Position filename is not valid.', true);
      return false;
    }

    const point = project(location.x, location.z);
    const direction = projectDirection(location.x, location.z, location.quaternion);
    playerMarker.style.left = `${point.left}%`;
    playerMarker.style.top = `${point.top}%`;
    playerMarker.style.setProperty('--terminal-player-direction', `${direction}deg`);
    playerMarker.title = `X ${location.x.toFixed(2)} · Z ${location.z.toFixed(2)} · Y ${Number(location.elevation).toFixed(2)}`;
    playerMarker.hidden = false;
    setStatus(`Position: ${location.x.toFixed(1)}, ${location.z.toFixed(1)}`);
    return true;
  };

  const applyTransform = () => {
    mapStage.style.left = `${view.x}px`;
    mapStage.style.top = `${view.y}px`;
    mapStage.style.width = `${FOOTPRINT_WIDTH * view.scale}px`;
    mapStage.style.height = `${FOOTPRINT_HEIGHT * view.scale}px`;
    mapWrap.style.transform = [
      `translate(${SEA_PADDING_X * view.scale}px, ${(SEA_PADDING_Y - DISPLAY_CROP_TOP) * view.scale}px)`,
      `scale(${view.scale})`,
      `translate(${ROTATION_OFFSET_X}px, ${ROTATION_OFFSET_Y}px)`,
      `rotate(${MAP_ROTATION_DEGREES}deg)`
    ].join(' ');
    mapWrap.style.setProperty('--terminal-map-counter-rotation', `${-MAP_ROTATION_DEGREES}deg`);
    updateMarkerScale();
    updatePopupPosition();
  };

  const fitMap = () => {
    const rect = viewport.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const leftPanel = document.querySelector('.terminal-side-panel');
    const rightPanel = document.querySelector('.terminal-right-panel');
    const leftVisible = leftPanel && getComputedStyle(leftPanel).display !== 'none';
    const rightVisible = rightPanel && getComputedStyle(rightPanel).display !== 'none';
    const leftInset = leftVisible ? Math.min(leftPanel.offsetWidth + 15, rect.width * .38) : 15;
    const rightInset = rightVisible ? Math.min(rightPanel.offsetWidth + 15, rect.width * .32) : 15;
    const topInset = document.body.classList.contains('terminal-clean-view') ? 15 : 42;
    const availableWidth = Math.max(100, rect.width - leftInset - rightInset);
    const availableHeight = Math.max(100, rect.height - topInset - 15);
    view.scale = Math.max(.25, Math.min(4, Math.min(availableWidth / FOOTPRINT_WIDTH, availableHeight / FOOTPRINT_HEIGHT)));
    view.x = leftInset + ((availableWidth - (FOOTPRINT_WIDTH * view.scale)) / 2);
    view.y = topInset + ((availableHeight - (FOOTPRINT_HEIGHT * view.scale)) / 2);
    view.fitted = true;
    applyTransform();
  };

  const restyleSvg = (svg) => {
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('viewBox', `0 0 ${SOURCE_WIDTH} ${SOURCE_HEIGHT}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('data-terminal-floor', '1');
    svg.setAttribute('aria-label', 'Terminal structural map');
    svg.querySelector('#style_common')?.remove();

    // Pure decoration/clutter. Physical rocks and tower footprints remain as navigation obstacles.
    svg.querySelector('#Forest')?.remove();
    svg.querySelector('#Powerlines')?.remove();

    const railroad = svg.querySelector('#Railroad');
    if (railroad) {
      const body = railroad.cloneNode(true);
      body.id = 'Terminal_Rail_Body';
      railroad.before(body);
    }

    const buildings = svg.querySelector('#Buildings');
    if (buildings) {
      // Tarkov Market's outdoor maps render buildings in three passes:
      // active floor, inactive structures, and the structural border.
      buildings.querySelector('#Powerline_Towers')?.remove();

      const floorFill = buildings.cloneNode(true);
      floorFill.id = 'Terminal_Building_Floors';
      floorFill.querySelector('#Cilinders')?.remove();
      floorFill.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));

      const wallLines = floorFill.cloneNode(true);
      wallLines.id = 'Terminal_Building_Walls';

      buildings.querySelector('[id="15degrees"]')?.remove();
      buildings.querySelector('#Straight')?.remove();
      buildings.id = 'Terminal_Inactive_Structures';

      buildings.before(floorFill);
      buildings.after(wallLines);
    }

    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.id = 'terminal_market_style';
    style.textContent = marketSvgStyle;
    svg.prepend(style);
  };

  const loadMap = async () => {
    try {
      const response = await fetch('maps/terminal-source.svg', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const source = await response.text();
      const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
      if (parsed.querySelector('parsererror')) throw new Error('Invalid SVG');
      const svg = document.importNode(parsed.documentElement, true);
      restyleSvg(svg);
      mapSurface.replaceChildren(svg);
      setStatus('Terminal structural map ready.');
      requestAnimationFrame(fitMap);
    } catch (error) {
      setStatus(`Terminal map failed to load: ${error.message}`, true);
    }
  };

  viewport.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button, input, label, a, .panel_top, .terminal-side-panel, .terminal-right-panel, .map-popup')) return;
    view.dragging = true;
    view.pointerId = event.pointerId;
    view.lastX = event.clientX;
    view.lastY = event.clientY;
    viewport.classList.add('is-dragging');
    viewport.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  viewport.addEventListener('pointermove', (event) => {
    if (!view.dragging || event.pointerId !== view.pointerId) return;
    view.x += event.clientX - view.lastX;
    view.y += event.clientY - view.lastY;
    view.lastX = event.clientX;
    view.lastY = event.clientY;
    applyTransform();
  });

  const endDrag = (event) => {
    if (!view.dragging || (event && event.pointerId !== view.pointerId)) return;
    view.dragging = false;
    view.pointerId = -1;
    viewport.classList.remove('is-dragging');
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);

  viewport.addEventListener('wheel', (event) => {
    if (event.target.closest('.terminal-side-panel, .terminal-right-panel')) return;
    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const worldX = (cursorX - view.x) / view.scale;
    const worldY = (cursorY - view.y) / view.scale;
    const nextScale = Math.max(.25, Math.min(6, view.scale * Math.exp(-event.deltaY * .0012)));
    view.x = cursorX - (worldX * nextScale);
    view.y = cursorY - (worldY * nextScale);
    view.scale = nextScale;
    applyTransform();
  }, { passive: false });

  viewport.addEventListener('dblclick', (event) => {
    if (!event.target.closest('.terminal-side-panel, .terminal-right-panel, .map-popup')) fitMap();
  });

  locationInput.addEventListener('input', () => setLocationFromFilename(locationInput.value));
  whereButton.addEventListener('click', () => setLocationFromFilename(locationInput.value));

  panelToggle.addEventListener('click', () => {
    const hidden = document.body.classList.toggle('terminal-panel-hidden');
    panelToggle.textContent = hidden ? 'Show panels' : 'Hide panels';
    requestAnimationFrame(fitMap);
  });

  fullScreen.addEventListener('click', () => {
    document.body.classList.toggle('terminal-clean-view');
    requestAnimationFrame(fitMap);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('terminal-clean-view')) {
      document.body.classList.remove('terminal-clean-view');
      requestAnimationFrame(fitMap);
    }
  });

  for (const input of document.querySelectorAll('input[name="layers"]')) {
    input.addEventListener('change', () => {
      const svg = mapSurface.querySelector('svg');
      if (svg) svg.setAttribute('data-terminal-floor', input.value === 'Level 2' ? '2' : '1');
      updateMarkers();
    });
  }

  leftCollapse?.addEventListener('click', () => {
    const collapsed = document.body.classList.toggle('terminal-left-collapsed');
    leftCollapse.setAttribute('aria-expanded', String(!collapsed));
  });

  document.querySelectorAll('[data-terminal-accordion] > .accordion-header').forEach((header) => {
    header.addEventListener('click', () => {
      const accordion = header.closest('[data-terminal-accordion]');
      const collapsed = accordion.classList.toggle('collapsed');
      header.setAttribute('aria-expanded', String(!collapsed));
    });
  });

  viewport.addEventListener('click', (event) => {
    if (event.target.closest('.terminal-popup, .terminal-map-marker, .terminal-side-panel, .terminal-right-panel, .panel_top')) return;
    closePopup();
  });

  window.addEventListener('resize', () => {
    if (view.fitted) fitMap();
  }, { passive: true });

  window.__wtfTerminalMap = {
    rotation: MAP_ROTATION_DEGREES,
    project,
    projectDirection,
    setLocationFromFilename,
    fit: fitMap,
    setQuestSelection: (questName, selected) => {
      if (String(questName).trim().toLowerCase() === 'the ticket') {
        setQuestSelected('quest-ticket', Boolean(selected), false);
      }
    },
    getVisibleFilters: () => Object.fromEntries(filterState)
  };

  renderPanel();
  renderRightPanels();
  renderMarkers();
  loadMap();
})();
