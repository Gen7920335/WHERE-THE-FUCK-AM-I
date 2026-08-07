(() => {
  if (window.__wtfEnhancementsInstalled) return;
  window.__wtfEnhancementsInstalled = true;

  const state = {
    uiScale: 1,
    fontScale: 1,
    iconScale: 1
  };

  const clamp = (value, min, max, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };

  const isMarkerCanvas = (context) =>
    context?.canvas?.classList?.contains('markers-canvas') === true;

  const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (...args) {
    if (!isMarkerCanvas(this) || state.iconScale === 1) {
      return originalDrawImage.apply(this, args);
    }

    const scale = state.iconScale;
    if (args.length === 3) {
      const [image, dx, dy] = args;
      const width = Number(image?.naturalWidth || image?.videoWidth || image?.width || 0);
      const height = Number(image?.naturalHeight || image?.videoHeight || image?.height || 0);
      if (width > 0 && height > 0) {
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
        return originalDrawImage.call(
          this,
          image,
          dx - (scaledWidth - width) / 2,
          dy - (scaledHeight - height) / 2,
          scaledWidth,
          scaledHeight
        );
      }
    } else if (args.length === 5) {
      const [image, dx, dy, width, height] = args;
      const scaledWidth = width * scale;
      const scaledHeight = height * scale;
      return originalDrawImage.call(
        this,
        image,
        dx - (scaledWidth - width) / 2,
        dy - (scaledHeight - height) / 2,
        scaledWidth,
        scaledHeight
      );
    } else if (args.length === 9) {
      const [image, sx, sy, sourceWidth, sourceHeight, dx, dy, width, height] = args;
      const scaledWidth = width * scale;
      const scaledHeight = height * scale;
      return originalDrawImage.call(
        this,
        image,
        sx,
        sy,
        sourceWidth,
        sourceHeight,
        dx - (scaledWidth - width) / 2,
        dy - (scaledHeight - height) / 2,
        scaledWidth,
        scaledHeight
      );
    }

    return originalDrawImage.apply(this, args);
  };

  const scaleCanvasFont = (context, callback) => {
    if (!isMarkerCanvas(context) || state.fontScale === 1) return callback();
    const originalFont = context.font;
    context.font = originalFont.replace(
      /(\d+(?:\.\d+)?)px/,
      (_, size) => `${Number(size) * state.fontScale}px`
    );
    try {
      return callback();
    } finally {
      context.font = originalFont;
    }
  };

  const originalFillText = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (...args) {
    return scaleCanvasFont(this, () => originalFillText.apply(this, args));
  };

  const originalStrokeText = CanvasRenderingContext2D.prototype.strokeText;
  CanvasRenderingContext2D.prototype.strokeText = function (...args) {
    return scaleCanvasFont(this, () => originalStrokeText.apply(this, args));
  };

  const applyDomScale = () => {
    const root = document.documentElement;
    if (!root) return;
    root.style.fontSize = `${state.fontScale * 100}%`;
    root.style.setProperty('--wtf-ui-scale', String(state.uiScale));
    root.style.setProperty('--wtf-font-scale', String(state.fontScale));
    root.style.setProperty('--wtf-icon-scale', String(state.iconScale));

    let style = document.getElementById('wtf-enhancement-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'wtf-enhancement-styles';
      style.textContent = `
        .panel_top,
        .panel_left,
        .panel_right {
          zoom: var(--wtf-ui-scale);
        }
        .marker {
          scale: var(--wtf-icon-scale);
          transform-origin: center;
        }
      `;
      (document.head || root).appendChild(style);
    }
  };

  const requestMarkerRedraw = () => {
    window.dispatchEvent(new Event('resize'));
    document.querySelector('.markers-canvas')?.dispatchEvent(new Event('wtf-scale-changed'));
  };

  window.__wtfSetEnhancementSettings = (settings = {}) => {
    state.uiScale = clamp(settings.uiScale, 0.65, 2, 1);
    state.fontScale = clamp(settings.fontScale, 0.5, 1.5, 1);
    state.iconScale = clamp(settings.iconScale, 0.5, 6.5, 1);
    applyDomScale();
    requestMarkerRedraw();
  };

  const questOverlayState = {
    snapshot: { map: '', quests: [] },
    questsById: new Map(),
    questByName: new Map(),
    pinned: new Set(),
    overlay: null,
    mapWrap: null,
    domObserver: null,
    mapObserver: null,
    resizeObserver: null,
    updateFrame: 0,
    hydrateFrame: 0
  };

  const normalizeQuestName = (value) => String(value || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();

  const installQuestOverlayStyles = () => {
    if (document.getElementById('wtf-quest-overlay-styles')) return;
    const style = document.createElement('style');
    style.id = 'wtf-quest-overlay-styles';
    style.textContent = `
      .wtf-quest-pin {
        appearance: auto !important;
        -webkit-appearance: checkbox !important;
        box-sizing: border-box !important;
        width: 14px !important;
        min-width: 14px !important;
        height: 14px !important;
        margin: 0 4px 0 7px !important;
        padding: 0 !important;
        flex: 0 0 14px !important;
        cursor: pointer !important;
        accent-color: #7ecb20;
        vertical-align: middle;
      }
      #wtf-quest-overlay {
        position: absolute;
        inset: 0;
        overflow: hidden;
        z-index: 6;
        pointer-events: none !important;
      }
      .wtf-quest-marker {
        position: absolute;
        width: 18px;
        height: 18px;
        margin: 0;
        padding: 0;
        border: 2px solid #efffd7;
        border-radius: 50%;
        box-sizing: border-box;
        background: #67ad16;
        color: #fff;
        font: 700 13px/14px Arial, sans-serif;
        text-align: center;
        transform: translate(-50%, -50%) scale(var(--wtf-icon-scale, 1));
        transform-origin: center;
        filter: drop-shadow(0 0 3px rgba(126, 203, 32, .95));
        user-select: none;
        pointer-events: none !important;
      }
      .wtf-quest-marker[hidden] {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  };

  const getQuestNameElement = (row) => {
    for (const child of row?.children || []) {
      if (child.tagName === 'SPAN' && !child.classList.contains('alt')) return child;
    }
    return row?.querySelector?.('span:not(.alt)') || null;
  };

  const setQuestPinned = (questId, checked, notifyHost) => {
    const quest = questOverlayState.questsById.get(questId);
    if (!quest) return;

    if (checked) questOverlayState.pinned.add(questId);
    else questOverlayState.pinned.delete(questId);

    for (const marker of questOverlayState.overlay?.querySelectorAll('.wtf-quest-marker') || []) {
      if (marker.dataset.questId === questId) {
        marker.hidden = !checked;
        marker.setAttribute('aria-hidden', checked ? 'false' : 'true');
      }
    }

    for (const checkbox of document.querySelectorAll('.wtf-quest-pin')) {
      if (checkbox.dataset.questId === questId && checkbox.checked !== checked) {
        checkbox.checked = checked;
      }
    }

    if (notifyHost) {
      window.chrome?.webview?.postMessage(JSON.stringify({
        action: 'quest-pin-changed',
        questId,
        checked
      }));
    }
  };

  const addQuestCheckboxes = () => {
    const rows = document.querySelectorAll('div.items.scroll div.no-wrap.d-flex[data-quest-uid]');
    for (const row of rows) {
      const nameElement = getQuestNameElement(row);
      const quest = questOverlayState.questByName.get(normalizeQuestName(nameElement?.textContent));
      if (!nameElement || !quest) continue;

      const existingCheckbox = row.querySelector('.wtf-quest-pin');
      if (row.dataset.wtfPinInstalled === 'true' && existingCheckbox?.dataset.questId === quest.id) continue;
      existingCheckbox?.remove();
      delete row.dataset.wtfPinInstalled;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'wtf-quest-pin';
      checkbox.dataset.questId = quest.id;
      checkbox.checked = questOverlayState.pinned.has(quest.id);
      checkbox.title = 'Pin quest markers';
      checkbox.setAttribute('aria-label', `Pin ${quest.name || 'quest'} markers`);

      const stopRowInteraction = (event) => event.stopPropagation();
      checkbox.addEventListener('pointerdown', stopRowInteraction);
      checkbox.addEventListener('mousedown', stopRowInteraction);
      checkbox.addEventListener('mouseup', stopRowInteraction);
      checkbox.addEventListener('click', stopRowInteraction);
      checkbox.addEventListener('dblclick', stopRowInteraction);
      checkbox.addEventListener('contextmenu', stopRowInteraction);
      checkbox.addEventListener('keydown', stopRowInteraction);
      checkbox.addEventListener('change', (event) => {
        event.stopPropagation();
        setQuestPinned(quest.id, checkbox.checked, true);
      });

      nameElement.insertAdjacentElement('afterend', checkbox);
      row.dataset.wtfPinInstalled = 'true';
    }
  };

  const getLayoutOffset = (element, ancestor) => {
    let left = 0;
    let top = 0;
    let current = element;
    while (current && current !== ancestor) {
      left += current.offsetLeft || 0;
      top += current.offsetTop || 0;
      current = current.offsetParent;
    }
    return { left, top };
  };

  const updateQuestMarkerPositions = () => {
    questOverlayState.updateFrame = 0;
    const overlay = questOverlayState.overlay;
    const mapWrap = questOverlayState.mapWrap;
    const mapContainer = overlay?.parentElement;
    if (!overlay?.isConnected || !mapWrap?.isConnected || !mapContainer) return;

    const computed = getComputedStyle(mapWrap);
    const Matrix = window.DOMMatrixReadOnly || window.DOMMatrix || window.WebKitCSSMatrix;
    let matrix;
    try {
      matrix = new Matrix(computed.transform === 'none' ? undefined : computed.transform);
    } catch (_) {
      matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    }

    const originParts = computed.transformOrigin.split(/\s+/);
    const originX = Number.parseFloat(originParts[0]) || 0;
    const originY = Number.parseFloat(originParts[1]) || 0;
    const layout = getLayoutOffset(mapWrap, mapContainer);
    const width = mapWrap.offsetWidth || Number.parseFloat(computed.width) || 0;
    const height = mapWrap.offsetHeight || Number.parseFloat(computed.height) || 0;

    for (const marker of overlay.querySelectorAll('.wtf-quest-marker')) {
      const localX = (Number(marker.dataset.left) / 100) * width;
      const localY = (Number(marker.dataset.top) / 100) * height;
      const relativeX = localX - originX;
      const relativeY = localY - originY;
      marker.style.left = `${layout.left + originX + (matrix.a * relativeX) + (matrix.c * relativeY) + matrix.e}px`;
      marker.style.top = `${layout.top + originY + (matrix.b * relativeX) + (matrix.d * relativeY) + matrix.f}px`;
    }
  };

  const scheduleQuestMarkerUpdate = () => {
    if (questOverlayState.updateFrame) return;
    questOverlayState.updateFrame = requestAnimationFrame(updateQuestMarkerPositions);
  };

  const observeMapTransform = (mapContainer, mapWrap) => {
    if (questOverlayState.mapWrap === mapWrap && questOverlayState.mapObserver) return;
    questOverlayState.mapObserver?.disconnect();
    questOverlayState.resizeObserver?.disconnect();
    questOverlayState.mapWrap = mapWrap;
    questOverlayState.mapObserver = new MutationObserver(scheduleQuestMarkerUpdate);
    questOverlayState.mapObserver.observe(mapWrap, {
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    if (window.ResizeObserver) {
      questOverlayState.resizeObserver = new ResizeObserver(scheduleQuestMarkerUpdate);
      questOverlayState.resizeObserver.observe(mapContainer);
      questOverlayState.resizeObserver.observe(mapWrap);
    }
    scheduleQuestMarkerUpdate();
  };

  const renderQuestMarkers = () => {
    const overlay = questOverlayState.overlay;
    if (!overlay) return;
    overlay.replaceChildren();

    for (const quest of questOverlayState.snapshot.quests || []) {
      for (const markerData of quest.markers || []) {
        const marker = document.createElement('div');
        marker.className = 'wtf-quest-marker';
        marker.dataset.questId = quest.id;
        marker.dataset.objectiveId = markerData.objectiveId || '';
        marker.dataset.left = String(markerData.left);
        marker.dataset.top = String(markerData.top);
        marker.dataset.floor = markerData.floor || '';
        marker.hidden = !questOverlayState.pinned.has(quest.id);
        marker.tabIndex = -1;
        marker.setAttribute('aria-hidden', marker.hidden ? 'true' : 'false');
        marker.textContent = '!';
        overlay.appendChild(marker);
      }
    }
    scheduleQuestMarkerUpdate();
  };

  const ensureQuestOverlay = () => {
    installQuestOverlayStyles();
    const mapContainer = document.querySelector('.map-cont');
    const mapWrap = mapContainer?.querySelector('.map-wrap');
    if (!mapContainer || !mapWrap) return false;

    let created = false;
    if (!questOverlayState.overlay?.isConnected || questOverlayState.overlay.parentElement !== mapContainer) {
      questOverlayState.overlay?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'wtf-quest-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      mapContainer.appendChild(overlay);
      questOverlayState.overlay = overlay;
      created = true;
    }

    observeMapTransform(mapContainer, mapWrap);
    if (created) renderQuestMarkers();
    return true;
  };

  const hydrateQuestOverlayDom = () => {
    questOverlayState.hydrateFrame = 0;
    ensureQuestOverlay();
    addQuestCheckboxes();
  };

  const scheduleQuestOverlayHydration = () => {
    if (questOverlayState.hydrateFrame) return;
    questOverlayState.hydrateFrame = requestAnimationFrame(hydrateQuestOverlayDom);
  };

  const startQuestOverlayObserver = () => {
    if (questOverlayState.domObserver || !document.documentElement) return;
    questOverlayState.domObserver = new MutationObserver(scheduleQuestOverlayHydration);
    questOverlayState.domObserver.observe(document.documentElement, {
      childList: true,
      characterData: true,
      subtree: true
    });
    window.addEventListener('resize', scheduleQuestMarkerUpdate, { passive: true });
  };

  window.__wtfQuestOverlay = {
    configure(snapshot = {}, pinnedQuestIds = []) {
      questOverlayState.snapshot = {
        map: String(snapshot.map || ''),
        quests: Array.isArray(snapshot.quests) ? snapshot.quests : []
      };
      questOverlayState.questsById.clear();
      questOverlayState.questByName.clear();

      for (const quest of questOverlayState.snapshot.quests) {
        if (!quest?.id) continue;
        questOverlayState.questsById.set(quest.id, quest);
        const aliases = new Set([quest.name, quest.nameKo, ...(quest.aliases || [])]);
        for (const alias of aliases) {
          const normalized = normalizeQuestName(alias);
          if (!normalized) continue;
          const existing = questOverlayState.questByName.get(normalized);
          if (!existing || (existing.markers?.length || 0) < (quest.markers?.length || 0)) {
            questOverlayState.questByName.set(normalized, quest);
          }
        }
      }

      questOverlayState.pinned = new Set(
        (Array.isArray(pinnedQuestIds) ? pinnedQuestIds : [])
          .filter(id => questOverlayState.questsById.has(id))
      );

      for (const row of document.querySelectorAll('[data-wtf-pin-installed="true"]')) {
        row.querySelector('.wtf-quest-pin')?.remove();
        delete row.dataset.wtfPinInstalled;
      }

      ensureQuestOverlay();
      renderQuestMarkers();
      addQuestCheckboxes();
      startQuestOverlayObserver();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyDomScale();
      startQuestOverlayObserver();
    }, { once: true });
  } else {
    applyDomScale();
    startQuestOverlayObserver();
  }
})();
