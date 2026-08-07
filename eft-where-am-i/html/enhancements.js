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

  const wtfOverlayState = {
    battlePass: { map: '', markers: [] },
    battlePassVisible: false,
    battlePassLayer: null,
    mapWrap: null,
    domObserver: null,
    mapObserver: null,
    resizeObserver: null,
    updateFrame: 0,
    hydrateFrame: 0
  };

  const installWtfOverlayStyles = () => {
    if (document.getElementById('wtf-overlay-styles')) return;
    const style = document.createElement('style');
    style.id = 'wtf-overlay-styles';
    style.textContent = `
      .wtf-quest-pin {
        appearance: auto !important;
        -webkit-appearance: checkbox !important;
        box-sizing: border-box !important;
        width: 14px !important;
        min-width: 14px !important;
        height: 14px !important;
        margin: 0 6px 0 5px !important;
        padding: 0 !important;
        flex: 0 0 14px !important;
        cursor: pointer !important;
        accent-color: #70a800;
        vertical-align: middle;
      }
      .wtf-quest-pin:disabled {
        cursor: default !important;
        opacity: .45;
      }
      #wtf-battle-pass-control {
        align-items: center;
        border-top: 1px solid rgba(154, 136, 102, .45);
        cursor: pointer;
        display: flex;
        gap: 8px;
        margin-top: 8px;
        padding: 8px 5px 4px;
        user-select: none;
      }
      #wtf-battle-pass-control:hover {
        color: var(--tm-text-bright, #fff);
      }
      .wtf-battle-pass-check {
        appearance: auto !important;
        -webkit-appearance: checkbox !important;
        width: 14px !important;
        min-width: 14px !important;
        height: 14px !important;
        margin: 0 !important;
        padding: 0 !important;
        accent-color: #075fd1;
      }
      .wtf-battle-pass-count {
        margin-left: auto;
        opacity: .7;
      }
      .wtf-blue-cross {
        display: inline-block;
        flex: 0 0 auto;
        height: 14px;
        position: relative;
        width: 14px;
        filter:
          drop-shadow(1px 0 0 #fff)
          drop-shadow(-1px 0 0 #fff)
          drop-shadow(0 1px 0 #fff)
          drop-shadow(0 -1px 0 #fff);
      }
      .wtf-blue-cross::before,
      .wtf-blue-cross::after {
        background: #075fd1;
        border-radius: 1px;
        content: '';
        position: absolute;
      }
      .wtf-blue-cross::before {
        height: 14px;
        left: 5px;
        top: 0;
        width: 4px;
      }
      .wtf-blue-cross::after {
        height: 4px;
        left: 0;
        top: 5px;
        width: 14px;
      }
      #wtf-battle-pass-layer {
        inset: 0;
        overflow: hidden;
        pointer-events: none !important;
        position: absolute;
        z-index: 6;
      }
      #wtf-battle-pass-layer[hidden],
      .wtf-battle-pass-marker[hidden] {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
      .wtf-battle-pass-marker {
        height: 14px;
        left: 0;
        pointer-events: none !important;
        position: absolute;
        top: 0;
        transform: translate(-50%, -50%) scale(var(--wtf-icon-scale, 1));
        transform-origin: center;
        user-select: none;
        width: 14px;
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

  const syncNativeQuestCheckbox = (row, checkbox) => {
    const selected = row.classList.contains('selected');
    checkbox.checked = selected;
    checkbox.disabled = row.classList.contains('disabled');
    checkbox.setAttribute('aria-checked', selected ? 'true' : 'false');
  };

  const toggleNativeQuestSelection = (row, checkbox) => {
    const desired = checkbox.checked;
    const selected = row.classList.contains('selected');
    if (desired === selected) return;

    row.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
      view: window
    }));

    setTimeout(() => syncNativeQuestCheckbox(row, checkbox), 120);
  };

  const addNativeQuestCheckboxes = () => {
    const rows = document.querySelectorAll('div.items.scroll div.no-wrap.d-flex[data-quest-uid]');
    for (const row of rows) {
      const nameElement = getQuestNameElement(row);
      if (!nameElement) continue;

      let checkbox = row.querySelector(':scope > .wtf-quest-pin');
      if (!checkbox) {
        checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'wtf-quest-pin';
        checkbox.dataset.questId = row.dataset.questUid || '';
        checkbox.title = 'Select quest markers';
        checkbox.setAttribute('aria-label', 'Select ' + nameElement.textContent.trim() + ' markers');

        const stopRowInteraction = (event) => event.stopPropagation();
        checkbox.addEventListener('pointerdown', stopRowInteraction);
        checkbox.addEventListener('mousedown', stopRowInteraction);
        checkbox.addEventListener('mouseup', stopRowInteraction);
        checkbox.addEventListener('click', stopRowInteraction);
        checkbox.addEventListener('dblclick', stopRowInteraction);
        checkbox.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        checkbox.addEventListener('keydown', stopRowInteraction);
        checkbox.addEventListener('change', (event) => {
          event.stopPropagation();
          toggleNativeQuestSelection(row, checkbox);
        });

        nameElement.insertAdjacentElement('beforebegin', checkbox);
      }

      syncNativeQuestCheckbox(row, checkbox);
    }
  };

  const ensureBattlePassControl = () => {
    const leftPanel = document.querySelector('.panel_left');
    if (!leftPanel) return;

    let control = document.getElementById('wtf-battle-pass-control');
    if (!control || control.parentElement !== leftPanel) {
      control?.remove();
      control = document.createElement('label');
      control.id = 'wtf-battle-pass-control';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'wtf-battle-pass-check';
      checkbox.checked = wtfOverlayState.battlePassVisible;
      checkbox.setAttribute('aria-label', 'Toggle Battle Pass document spawns');
      checkbox.addEventListener('change', (event) => {
        event.stopPropagation();
        setBattlePassVisible(checkbox.checked, true);
      });

      const icon = document.createElement('span');
      icon.className = 'wtf-blue-cross';
      icon.setAttribute('aria-hidden', 'true');

      const label = document.createElement('span');
      label.textContent = 'Battle Pass';

      const count = document.createElement('span');
      count.className = 'wtf-battle-pass-count';
      count.textContent = String(wtfOverlayState.battlePass.markers?.length || 0);

      control.append(checkbox, icon, label, count);
      leftPanel.appendChild(control);
    } else {
      const checkbox = control.querySelector('.wtf-battle-pass-check');
      const count = control.querySelector('.wtf-battle-pass-count');
      if (checkbox) checkbox.checked = wtfOverlayState.battlePassVisible;
      if (count) count.textContent = String(wtfOverlayState.battlePass.markers?.length || 0);
      if (control !== leftPanel.lastElementChild) leftPanel.appendChild(control);
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

  const updateBattlePassPositions = () => {
    wtfOverlayState.updateFrame = 0;
    const overlay = wtfOverlayState.battlePassLayer;
    const mapWrap = wtfOverlayState.mapWrap;
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

    for (const marker of overlay.querySelectorAll('.wtf-battle-pass-marker')) {
      const localX = (Number(marker.dataset.left) / 100) * width;
      const localY = (Number(marker.dataset.top) / 100) * height;
      const relativeX = localX - originX;
      const relativeY = localY - originY;
      marker.style.left = (layout.left + originX + (matrix.a * relativeX) + (matrix.c * relativeY) + matrix.e) + 'px';
      marker.style.top = (layout.top + originY + (matrix.b * relativeX) + (matrix.d * relativeY) + matrix.f) + 'px';
    }
  };

  const scheduleBattlePassPositionUpdate = () => {
    if (wtfOverlayState.updateFrame) return;
    wtfOverlayState.updateFrame = requestAnimationFrame(updateBattlePassPositions);
  };

  const observeMapTransform = (mapContainer, mapWrap) => {
    if (wtfOverlayState.mapWrap === mapWrap && wtfOverlayState.mapObserver) return;
    wtfOverlayState.mapObserver?.disconnect();
    wtfOverlayState.resizeObserver?.disconnect();
    wtfOverlayState.mapWrap = mapWrap;
    wtfOverlayState.mapObserver = new MutationObserver(scheduleBattlePassPositionUpdate);
    wtfOverlayState.mapObserver.observe(mapWrap, {
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    if (window.ResizeObserver) {
      wtfOverlayState.resizeObserver = new ResizeObserver(scheduleBattlePassPositionUpdate);
      wtfOverlayState.resizeObserver.observe(mapContainer);
      wtfOverlayState.resizeObserver.observe(mapWrap);
    }
    scheduleBattlePassPositionUpdate();
  };

  const renderBattlePassMarkers = () => {
    const overlay = wtfOverlayState.battlePassLayer;
    if (!overlay) return;
    overlay.replaceChildren();
    overlay.hidden = !wtfOverlayState.battlePassVisible;

    for (const markerData of wtfOverlayState.battlePass.markers || []) {
      const marker = document.createElement('div');
      marker.className = 'wtf-battle-pass-marker';
      marker.dataset.left = String(markerData.left);
      marker.dataset.top = String(markerData.top);
      marker.dataset.elevation = String(markerData.elevation ?? '');
      marker.title = [markerData.title, markerData.details].filter(Boolean).join(' · ');
      marker.setAttribute('aria-hidden', 'true');
      marker.tabIndex = -1;

      const cross = document.createElement('span');
      cross.className = 'wtf-blue-cross';
      cross.setAttribute('aria-hidden', 'true');
      marker.appendChild(cross);
      overlay.appendChild(marker);
    }
    scheduleBattlePassPositionUpdate();
  };

  const ensureBattlePassLayer = () => {
    const mapContainer = document.querySelector('.map-cont');
    const mapWrap = mapContainer?.querySelector('.map-wrap');
    if (!mapContainer || !mapWrap) return false;

    let created = false;
    if (!wtfOverlayState.battlePassLayer?.isConnected || wtfOverlayState.battlePassLayer.parentElement !== mapContainer) {
      wtfOverlayState.battlePassLayer?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'wtf-battle-pass-layer';
      overlay.setAttribute('aria-hidden', 'true');
      mapContainer.appendChild(overlay);
      wtfOverlayState.battlePassLayer = overlay;
      created = true;
    }

    observeMapTransform(mapContainer, mapWrap);
    if (created) renderBattlePassMarkers();
    return true;
  };

  const setBattlePassVisible = (visible, notifyHost) => {
    wtfOverlayState.battlePassVisible = Boolean(visible);
    if (wtfOverlayState.battlePassLayer) {
      wtfOverlayState.battlePassLayer.hidden = !wtfOverlayState.battlePassVisible;
    }
    const checkbox = document.querySelector('.wtf-battle-pass-check');
    if (checkbox) checkbox.checked = wtfOverlayState.battlePassVisible;
    if (notifyHost) {
      window.chrome?.webview?.postMessage(JSON.stringify({
        action: 'battle-pass-toggle',
        checked: wtfOverlayState.battlePassVisible
      }));
    }
  };

  const hydrateWtfEnhancementDom = () => {
    wtfOverlayState.hydrateFrame = 0;
    installWtfOverlayStyles();
    addNativeQuestCheckboxes();
    ensureBattlePassControl();
    ensureBattlePassLayer();
  };

  const scheduleWtfEnhancementHydration = () => {
    if (wtfOverlayState.hydrateFrame) return;
    wtfOverlayState.hydrateFrame = requestAnimationFrame(hydrateWtfEnhancementDom);
  };

  const startWtfEnhancementObserver = () => {
    if (wtfOverlayState.domObserver || !document.documentElement) return;
    wtfOverlayState.domObserver = new MutationObserver(scheduleWtfEnhancementHydration);
    wtfOverlayState.domObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true
    });
    window.addEventListener('resize', scheduleBattlePassPositionUpdate, { passive: true });
    scheduleWtfEnhancementHydration();
  };

  window.__wtfBattlePassOverlay = {
    configure(snapshot = {}, visible = false) {
      wtfOverlayState.battlePass = {
        map: String(snapshot.map || ''),
        markers: Array.isArray(snapshot.markers) ? snapshot.markers : []
      };
      wtfOverlayState.battlePassVisible = Boolean(visible);
      installWtfOverlayStyles();
      ensureBattlePassControl();
      ensureBattlePassLayer();
      renderBattlePassMarkers();
      setBattlePassVisible(visible, false);
      startWtfEnhancementObserver();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyDomScale();
      startWtfEnhancementObserver();
    }, { once: true });
  } else {
    applyDomScale();
    startWtfEnhancementObserver();
  }
})();
