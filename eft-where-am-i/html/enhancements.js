(() => {
  if (window.__wtfEnhancementsInstalled) return;
  window.__wtfEnhancementsInstalled = true;

  // Terminal opens turned like the in-game wall map (-75.3 deg): the first visit sets
  // the site's own rotation to 270 deg and the Terminal tilt below adds 14.7 deg.
  // After that the user's own rotation is kept. This runs before the site's scripts,
  // which read the key when the map loads.
  try {
    const mapSlug = String(location.pathname || '').match(/\/maps\/([^/?#]+)/)?.[1];
    if (mapSlug === 'terminal' && localStorage.getItem('wtf_terminal_default_rotation_v1') !== '1') {
      if (localStorage.getItem('tm_map_rotation:terminal') === null) {
        localStorage.setItem('tm_map_rotation:terminal', '270');
      }
      localStorage.setItem('wtf_terminal_default_rotation_v1', '1');
    }
  } catch {}

  // Native Pro actions can be divs/SVGs and teleported popup controls, not
  // just panel buttons. Match exact class tokens, never "progress"/"profile".
  const paidUiSelector = [
    '.panel_top .pro', '.panel_left .pro', '.panel_right .pro',
    '.map-popup .pro', '.popup .pro',
    '.panel_right .guide-row',
    '.panel_right .user-layers-panel', '.panel_right .squad-panel',
    '.hint-root:has(> .pro)',
    '[class~="paywall"]', '[class~="pro-only"]',
    '[data-premium="true"]', '[data-pro-only="true"]'
  ].join(',');

  // Toolbar items the app does not use: phone sign-in (Screenshot OCR is
  // matched by its label in hideCommercialAndPaidUi).
  const removedToolbarSelector = '.map-toolbar > .phone-tools';

  // Hidden from view but still clicked by the host: full screen (entered on
  // load), the More menu and its "Where am i?" toggle (location is always on),
  // and the location row the host types screenshot names into.
  const scriptOnlyToolbarSelector = [
    '.map-toolbar > .toolbar-more',
    '.map-toolbar .view-tools > .hint-root:nth-child(2)',
    '.panel_top > .toolbar-context'
  ].join(',');

  const state = {
    language: 'en',
    uiScale: 1,
    fontScale: 1,
    iconScale: 1,
    popupOpacity: 1,
    routeLineWidth: 1.5,
    questRequirementsPanel: {
      mode: 'right',
      x: 0,
      y: 80,
      width: 360,
      height: 520,
      collapsed: false
    }
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

  // ---- Terminal at the in-game wall-map angle (-75.3 deg) ------------------
  // The site rotates its map only in 90-degree steps (0/90/180/270). Terminal
  // must look like the in-game wall map, which is 14.7 deg clockwise of the
  // site's 270 deg view, so on Terminal every site rotation gets that extra
  // 14.7 deg (270 -> -75.3, then the site's own button keeps adding 90).
  // The extra angle is folded into the view transform of the site's canvases,
  // so map shapes, markers, the player arrow and our overlays (which read that
  // transform) all turn together; icons and text are turned back upright around
  // their own anchor. Mouse events on the map are turned back by the same angle
  // before the site sees them, so its hit tests, hover, wheel zoom anchor and
  // drag panning keep working in its own unrotated space.
  const TERMINAL_EXTRA_TILT_DEG = 14.7;
  const tiltCanvasPattern = /(?:^|\s)(?:doc-map-canvas|markers-canvas|players-canvas|pilot-heatmap-canvas)(?:\s|$)/;
  const glyphCanvasPattern = /(?:^|\s)(?:markers-canvas|players-canvas)(?:\s|$)/;
  // The canvas hooks below run on every draw call, so the map slug is parsed
  // once per path instead of once per call.
  let pathMapSlugCache = { path: null, slug: '' };
  const pathMapSlug = () => {
    const path = String(location.pathname || '');
    if (pathMapSlugCache.path !== path) {
      pathMapSlugCache = { path, slug: path.match(/\/maps\/([^/?#]+)/)?.[1]?.toLowerCase() || '' };
    }
    return pathMapSlugCache.slug;
  };
  const mapTiltRadians = () => (pathMapSlug() === 'terminal' ? TERMINAL_EXTRA_TILT_DEG * Math.PI / 180 : 0);
  window.__wtfMapTiltDegrees = () => mapTiltRadians() * 180 / Math.PI;
  const contextTilt = (context) => {
    const canvas = context?.canvas;
    if (!canvas?.classList || !tiltCanvasPattern.test(canvas.className)) return 0;
    if (canvas.style?.display === 'none') return 0;
    return mapTiltRadians();
  };
  const tiltedMatrix = (context, matrix, radians) => {
    // Rotation about the canvas centre (the view centre), applied after the site matrix.
    const cx = context.canvas.width / 2;
    const cy = context.canvas.height / 2;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const r = { a: cos, b: sin, c: -sin, d: cos, e: cx - (cos * cx) + (sin * cy), f: cy - (sin * cx) - (cos * cy) };
    return {
      a: (r.a * matrix.a) + (r.c * matrix.b),
      b: (r.b * matrix.a) + (r.d * matrix.b),
      c: (r.a * matrix.c) + (r.c * matrix.d),
      d: (r.b * matrix.c) + (r.d * matrix.d),
      e: (r.a * matrix.e) + (r.c * matrix.f) + r.e,
      f: (r.b * matrix.e) + (r.d * matrix.f) + r.f
    };
  };
  const contextPrototype = CanvasRenderingContext2D.prototype;
  const nativeSetTransform = contextPrototype.setTransform;
  contextPrototype.setTransform = function (...args) {
    const radians = contextTilt(this);
    if (!radians) {
      this.__wtfTilted = false;
      this.__wtfRequestedTransform = null;
      return nativeSetTransform.apply(this, args);
    }
    const source = args.length >= 6
      ? { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] }
      : (args[0] || { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    const matrix = {
      a: source.a ?? source.m11 ?? 1, b: source.b ?? source.m12 ?? 0, c: source.c ?? source.m21 ?? 0,
      d: source.d ?? source.m22 ?? 1, e: source.e ?? source.m41 ?? 0, f: source.f ?? source.m42 ?? 0
    };
    // Remember the site's own matrix: clearing uses it untilted (see clearRect).
    this.__wtfRequestedTransform = matrix;
    // The map canvas uses identity only to clear or copy whole layers; the marker
    // and player canvases draw with it (device scale 1, no padding).
    const isIdentity = matrix.a === 1 && matrix.b === 0 && matrix.c === 0 && matrix.d === 1 && matrix.e === 0 && matrix.f === 0;
    if (isIdentity && !glyphCanvasPattern.test(this.canvas.className)) {
      this.__wtfTilted = false;
      return nativeSetTransform.call(this, 1, 0, 0, 1, 0, 0);
    }
    const tilted = tiltedMatrix(this, matrix, radians);
    this.__wtfTilted = true;
    return nativeSetTransform.call(this, tilted.a, tilted.b, tilted.c, tilted.d, tilted.e, tilted.f);
  };
  // Where the site drew its marker icons in the last frame (container pixels),
  // so our step rings can stand beside them instead of on top of them. Only maps
  // with built-in steps need it (wanted is set next to builtInQuestSteps).
  const nativeIconFrame = { icons: [], box: null, onDrawn: null, wanted: () => false };
  const isMarkersCanvas = (context) => /(?:^|\s)markers-canvas(?:\s|$)/.test(context?.canvas?.className || '');
  const beginNativeIconFrame = (context, width, height) => {
    const canvas = context.canvas;
    if (!(width >= canvas.width / 2) || !(height >= canvas.height / 2)) return;
    nativeIconFrame.icons = [];
    const container = canvas.closest?.('.map-cont');
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
    nativeIconFrame.box = {
      left: canvasRect.left - containerRect.left,
      top: canvasRect.top - containerRect.top,
      ratio: canvasRect.width > 0 ? canvas.width / canvasRect.width : 1
    };
  };
  const recordNativeIcon = (context, x, y, width, height) => {
    const box = nativeIconFrame.box;
    if (!box || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const m = context.getTransform();
    const scale = Math.hypot(m.a, m.b) / box.ratio;
    const size = Math.max(Math.abs(width), Math.abs(height)) * scale;
    // Icons only: skip tiny dots and whole-layer images.
    if (!(size >= 8 && size <= 64)) return;
    if (nativeIconFrame.icons.length >= 4000) return;
    // The icon-size setting enlarges the drawn icon around this same centre
    // (drawImage hook above), so the ring must clear the enlarged icon.
    const iconScale = state.iconScale > 0 ? state.iconScale : 1;
    nativeIconFrame.icons.push({
      x: box.left + ((m.a * x) + (m.c * y) + m.e) / box.ratio,
      y: box.top + ((m.b * x) + (m.d * y) + m.f) / box.ratio,
      // Some sprites carry transparent padding or a caption; the visible icon
      // itself is at most about 26 px across.
      r: Math.min(size / 2, 13) * iconScale
    });
    nativeIconFrame.onDrawn?.();
  };
  window.__wtfNativeIconFrame = () => nativeIconFrame.icons.map((icon) => ({ ...icon }));

  // The site clears its canvases with the rectangle it asked for; a tilted clear
  // would leave the corners uncleared, so clear in the site's own space.
  const nativeClearRect = contextPrototype.clearRect;
  contextPrototype.clearRect = function (...args) {
    // A new frame: the last label box no longer frames anything.
    this.__wtfLabelBox = null;
    if (isMarkersCanvas(this) && nativeIconFrame.wanted(pathMapSlug())) beginNativeIconFrame(this, args[2], args[3]);
    const requested = this.__wtfTilted ? this.__wtfRequestedTransform : null;
    if (!requested) return nativeClearRect.apply(this, args);
    this.save();
    nativeSetTransform.call(this, requested.a, requested.b, requested.c, requested.d, requested.e, requested.f);
    try {
      return nativeClearRect.apply(this, args);
    } finally {
      this.restore();
    }
  };
  // save()/restore() bring the transform back, so they bring back what we know
  // about it too; otherwise a restore() after an untilted identity (a layer copy)
  // leaves a tilted canvas marked untilted (labels drawn tilted, corners left
  // uncleared). resetTransform() is identity, which setTransform tilts where the
  // canvas draws with it.
  const nativeSave = contextPrototype.save;
  const nativeRestore = contextPrototype.restore;
  if (typeof nativeSave === 'function' && typeof nativeRestore === 'function') {
    contextPrototype.save = function (...args) {
      (this.__wtfTiltStack ||= []).push([this.__wtfTilted, this.__wtfRequestedTransform]);
      return nativeSave.apply(this, args);
    };
    contextPrototype.restore = function (...args) {
      const saved = this.__wtfTiltStack?.pop();
      if (saved) [this.__wtfTilted, this.__wtfRequestedTransform] = saved;
      return nativeRestore.apply(this, args);
    };
  }
  if (typeof contextPrototype.resetTransform === 'function') {
    contextPrototype.resetTransform = function () {
      return this.setTransform(1, 0, 0, 1, 0, 0);
    };
  }

  // Draw a glyph upright around its own anchor while the canvas is tilted.
  const drawUpright = (context, x, y, draw) => {
    const radians = context.__wtfTilted ? contextTilt(context) : 0;
    if (!radians || !Number.isFinite(x) || !Number.isFinite(y)) return draw();
    context.save();
    context.translate(x, y);
    context.rotate(-radians);
    context.translate(-x, -y);
    try {
      return draw();
    } finally {
      context.restore();
    }
  };
  const isGlyphCanvas = (context) => glyphCanvasPattern.test(context?.canvas?.className || '');
  const tiltedDrawImage = contextPrototype.drawImage;
  contextPrototype.drawImage = function (...args) {
    const markers = isMarkersCanvas(this) && nativeIconFrame.wanted(pathMapSlug());
    if (!markers && (!this.__wtfTilted || !isGlyphCanvas(this))) return tiltedDrawImage.apply(this, args);
    let x;
    let y;
    let width;
    let height;
    if (args.length >= 9) {
      [width, height] = [args[7], args[8]];
      x = args[5] + (width / 2);
      y = args[6] + (height / 2);
    } else if (args.length >= 5) {
      [width, height] = [args[3], args[4]];
      x = args[1] + (width / 2);
      y = args[2] + (height / 2);
    } else {
      const image = args[0];
      [width, height] = [Number(image?.width) || 0, Number(image?.height) || 0];
      x = args[1] + width / 2;
      y = args[2] + height / 2;
    }
    if (markers) recordNativeIcon(this, x, y, width, height);
    if (!this.__wtfTilted || !isGlyphCanvas(this)) return tiltedDrawImage.apply(this, args);
    return drawUpright(this, x, y, () => tiltedDrawImage.apply(this, args));
  };
  // Label boxes: the site fills a translucent black box, then writes the label
  // inside it; both turn upright around the box centre so the text stays inside.
  const isLabelBoxFill = (style) => /^rgba\(0, 0, 0, 0\.(?:5|8)\)$/.test(String(style));
  const nativeFillRect = contextPrototype.fillRect;
  contextPrototype.fillRect = function (x, y, width, height) {
    if (!this.__wtfTilted || !isGlyphCanvas(this) || !isLabelBoxFill(this.fillStyle)) {
      return nativeFillRect.call(this, x, y, width, height);
    }
    const box = { x, y, width, height, cx: x + width / 2, cy: y + height / 2 };
    this.__wtfLabelBox = box;
    return drawUpright(this, box.cx, box.cy, () => nativeFillRect.call(this, x, y, width, height));
  };
  const textPivot = (context, x, y) => {
    const box = context.__wtfLabelBox;
    if (box && x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) return [box.cx, box.cy];
    return [x, y];
  };
  for (const name of ['fillText', 'strokeText']) {
    const nativeText = contextPrototype[name];
    contextPrototype[name] = function (text, x, y, ...rest) {
      if (!this.__wtfTilted) return nativeText.call(this, text, x, y, ...rest);
      const [px, py] = textPivot(this, x, y);
      return drawUpright(this, px, py, () => nativeText.call(this, text, x, y, ...rest));
    };
  }
  const nativeStrokeRect = contextPrototype.strokeRect;
  contextPrototype.strokeRect = function (x, y, width, height) {
    // The dashed hover/selection box around an icon stays square to the screen.
    if (!this.__wtfTilted || !isGlyphCanvas(this) || !this.getLineDash?.().length) {
      return nativeStrokeRect.call(this, x, y, width, height);
    }
    return drawUpright(this, x + width / 2, y + height / 2, () => nativeStrokeRect.call(this, x, y, width, height));
  };

  // Map mouse input: turn the pointer back into the site's unrotated space.
  const tiltEventTypes = ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mousemove', 'mouseup',
    'click', 'dblclick', 'auxclick', 'contextmenu', 'wheel'];
  const tiltUiSelector = '.panel_top, .panel_left, .panel_right, .map-popup, .wtf-quest-marker, .wtf-route-node, '
    + '.wtf-ping-marker, .wtf-squad-marker, button, input, a, label, select, textarea, #wtf-quest-requirements-panel';
  let tiltGesture = false;
  const unrotateClientPoint = (container, clientX, clientY, radians) => {
    const rect = container.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return { x: cx + (dx * cos) + (dy * sin), y: cy - (dx * sin) + (dy * cos) };
  };
  const rewriteTiltedMapEvent = (event) => {
    if (!event.isTrusted) return;
    const radians = mapTiltRadians();
    if (!radians) {
      tiltGesture = false;
      return;
    }
    const container = document.querySelector('.map-cont');
    if (!container) return;
    const target = event.target instanceof Element ? event.target : null;
    const onMap = Boolean(target && container.contains(target) && !target.closest(tiltUiSelector));
    const continuing = tiltGesture && /move|up$/.test(event.type);
    if (!onMap && !continuing) return;
    const point = unrotateClientPoint(container, event.clientX, event.clientY, radians);
    const init = {
      bubbles: event.bubbles, cancelable: event.cancelable, composed: event.composed, view: event.view,
      detail: event.detail, screenX: event.screenX + (point.x - event.clientX), screenY: event.screenY + (point.y - event.clientY),
      clientX: point.x, clientY: point.y, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey,
      metaKey: event.metaKey, button: event.button, buttons: event.buttons, relatedTarget: event.relatedTarget,
      movementX: event.movementX, movementY: event.movementY
    };
    if (typeof PointerEvent !== 'undefined' && event instanceof PointerEvent) {
      Object.assign(init, {
        pointerId: event.pointerId, width: event.width, height: event.height, pressure: event.pressure,
        tangentialPressure: event.tangentialPressure, tiltX: event.tiltX, tiltY: event.tiltY, twist: event.twist,
        pointerType: event.pointerType, isPrimary: event.isPrimary
      });
    }
    if (typeof WheelEvent !== 'undefined' && event instanceof WheelEvent) {
      Object.assign(init, { deltaX: event.deltaX, deltaY: event.deltaY, deltaZ: event.deltaZ, deltaMode: event.deltaMode });
    }
    const clone = new event.constructor(event.type, init);
    // Our own map handlers read screen positions (their geometry includes the tilt).
    clone.__wtfScreenPoint = { clientX: event.clientX, clientY: event.clientY };
    event.stopImmediatePropagation();
    (target || container).dispatchEvent(clone);
    if (clone.defaultPrevented) event.preventDefault();
    if (onMap && (event.type === 'mousedown' || event.type === 'pointerdown')) tiltGesture = true;
    if (event.type === 'mouseup' || event.type === 'pointerup') tiltGesture = event.buttons !== 0;
  };
  // The site's panels stop mouseup, so a map drag released over a panel never
  // ends: the map keeps following the cursor until the next plain click (pings
  // and route nodes don't count, the site never sees them). Once a drag that
  // began on the map reaches a panel, hold the pointer on the map so the release
  // still lands there. Capture starts only then, so clicks are not retargeted.
  // Registered before the tilt rewrite, which stops trusted events on Terminal.
  const mapDragPanelSelector = '.panel_top, .panel_left, .panel_right';
  let mapDragPointerId = null;
  const keepMapDragOnMap = (event) => {
    if (!event.isTrusted) return;
    const target = event.target instanceof Element ? event.target : null;
    const container = document.querySelector('.map-cont');
    if (event.type === 'pointerdown') {
      mapDragPointerId = event.button === 0 && container && target && container.contains(target)
        && !target.closest(`${mapDragPanelSelector}, .map-popup, #wtf-quest-requirements-panel`)
        ? event.pointerId
        : null;
      return;
    }
    if (event.type !== 'pointermove' || !(event.buttons & 1)) {
      mapDragPointerId = null;
      return;
    }
    if (event.pointerId !== mapDragPointerId || !container || !target?.closest(mapDragPanelSelector)) return;
    if (container.hasPointerCapture?.(event.pointerId)) return;
    try {
      container.setPointerCapture(event.pointerId);
    } catch (error) {
      mapDragPointerId = null;
    }
  };
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
    window.addEventListener(type, keepMapDragOnMap, { capture: true });
  }
  for (const type of tiltEventTypes) {
    window.addEventListener(type, rewriteTiltedMapEvent, { capture: true, passive: false });
  }
  // A gesture that ends without a release reaching the page (pointer cancelled,
  // window lost focus) must not keep rewriting later moves over the panels.
  window.addEventListener('pointercancel', () => { tiltGesture = false; }, { capture: true });
  window.addEventListener('blur', () => { tiltGesture = false; });
  const screenPointOf = (event) => event?.__wtfScreenPoint || event;

  const applyDomScale = () => {
    const root = document.documentElement;
    if (!root) return;
    root.style.fontSize = `${state.fontScale * 100}%`;
    root.style.setProperty('--wtf-ui-scale', String(state.uiScale));
    root.style.setProperty('--wtf-font-scale', String(state.fontScale));
    root.style.setProperty('--wtf-icon-scale', String(state.iconScale));
    root.style.setProperty('--wtf-popup-opacity', String(state.popupOpacity));
    root.style.setProperty('--wtf-route-line-width', `${state.routeLineWidth}px`);

    let style = document.getElementById('wtf-enhancement-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'wtf-enhancement-styles';
      style.textContent = `
        .panel_top {
          box-sizing: border-box;
          max-width: calc(100vw - 30px);
          zoom: var(--wtf-top-ui-scale, var(--wtf-ui-scale));
        }
        ${scriptOnlyToolbarSelector} {
          display: none !important;
        }
        /* Ruler stays a direct button; the site would fold it into More. */
        .map-toolbar > .primary-tools {
          display: flex !important;
        }
        .wtf-toolbar-break {
          display: none;
        }
        /* Portrait: only the ping/route clear buttons drop to a second row. */
        html[data-wtf-layout="portrait"] .map-toolbar {
          flex-wrap: wrap !important;
        }
        html[data-wtf-layout="portrait"] .map-toolbar > .wtf-toolbar-break {
          display: block;
          flex: 0 0 100% !important;
          height: 0;
          min-width: 0;
        }
        .panel_top.desktop-panel {
          display: block !important;
        }
        .mobile-map-ui {
          display: none !important;
          pointer-events: none !important;
          visibility: hidden !important;
        }
        .panel_left,
        .panel_right {
          box-sizing: border-box;
          zoom: var(--wtf-side-ui-scale, var(--wtf-ui-scale));
        }
        .panel_top > :first-child {
          align-items: center;
          display: flex !important;
          flex-wrap: wrap !important;
          max-width: 100%;
        }
        .panel_top > :first-child > * {
          flex: 0 0 auto !important;
          min-width: max-content;
        }
        .panel_top .position-controls {
          display: flex;
          flex-wrap: wrap;
          max-width: 100%;
          min-width: 0;
        }
        .panel_top .position-controls input {
          min-width: 0;
          max-width: 100%;
        }
        #wtf-clear-pings-button,
        #wtf-clear-route-button {
          pointer-events: auto;
          width: auto;
          min-width: max-content;
        }
        html[data-wtf-layout="landscape"] .panel_left,
        html[data-wtf-layout="landscape"] .panel_right {
          top: var(--wtf-landscape-panel-top, 160px) !important;
          max-height: var(--wtf-landscape-panel-height, calc(100% - 170px)) !important;
        }
        .panel_top button,
        .panel_top input,
        .panel_top label {
          white-space: nowrap;
        }
        #wtf-portrait-panel-shell {
          background: rgba(11, 12, 12, .94);
          border: 1px solid rgba(129, 117, 91, .72);
          box-shadow: 0 8px 24px rgba(0, 0, 0, .62);
          box-sizing: border-box;
          display: none;
          pointer-events: none;
          position: absolute;
          z-index: 19;
        }
        #wtf-portrait-panel-shell[hidden] {
          display: none !important;
        }
        html[data-wtf-layout="portrait"] #wtf-portrait-panel-shell {
          display: block;
          height: var(--wtf-portrait-panel-height);
          left: var(--wtf-portrait-panel-left);
          top: var(--wtf-portrait-panel-top);
          width: var(--wtf-portrait-panel-width);
        }
        html[data-wtf-layout="portrait"] .panel_left,
        html[data-wtf-layout="portrait"] .panel_right {
          background: rgba(11, 12, 12, .9) !important;
          bottom: auto !important;
          box-sizing: border-box !important;
          height: var(--wtf-portrait-panel-height) !important;
          margin: 0 !important;
          max-height: var(--wtf-portrait-panel-height) !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          right: auto !important;
          top: var(--wtf-portrait-panel-top) !important;
          zoom: 1 !important;
        }
        html[data-wtf-layout="portrait"] .panel_left {
          border-right: 1px solid rgba(129, 117, 91, .55);
          left: var(--wtf-portrait-panel-left) !important;
          padding: 8px 6px 8px 8px;
          width: var(--wtf-portrait-left-width) !important;
        }
        html[data-wtf-layout="portrait"] .panel_right {
          align-items: stretch !important;
          display: flex !important;
          flex-direction: column !important;
          left: var(--wtf-portrait-right-left) !important;
          overflow-y: hidden !important;
          padding: 8px 8px 8px 6px;
          width: var(--wtf-portrait-right-width) !important;
        }
        html[data-wtf-layout="portrait"] .panel_left > *,
        html[data-wtf-layout="portrait"] .panel_right > * {
          box-sizing: border-box !important;
          flex: 0 0 auto;
          max-width: none !important;
          zoom: var(--wtf-portrait-content-scale);
        }
        html[data-wtf-layout="portrait"] .panel_left > * {
          width: var(--wtf-portrait-left-content-width) !important;
        }
        html[data-wtf-layout="portrait"] .panel_right > * {
          width: var(--wtf-portrait-right-content-width) !important;
        }
        html[data-wtf-layout="portrait"] .panel_right .tools_quests .items.scroll {
          flex: 1 1 auto !important;
          height: auto !important;
          max-width: none !important;
          max-height: none !important;
          min-height: 0 !important;
          overscroll-behavior: contain;
          overflow-y: auto !important;
          width: 100% !important;
        }
        html[data-wtf-layout="portrait"] .panel_right > .tools_quests {
          display: flex !important;
          flex: 0 0 var(--wtf-portrait-quest-height, 200px) !important;
          flex-direction: column !important;
          height: var(--wtf-portrait-quest-height, 200px) !important;
          max-height: var(--wtf-portrait-quest-height, 200px) !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }
        html[data-wtf-layout="portrait"] .panel_right > .tools_quests > .quests-content {
          display: flex !important;
          flex: 1 1 auto !important;
          height: auto !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }
        html[data-wtf-layout="portrait"] .panel_right > .tools_quests > .quests-content > :not(.quests-details-col) {
          display: flex !important;
          flex: 1 1 auto !important;
          flex-direction: column !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }
        html[data-wtf-layout="portrait"][data-wtf-panels-collapsed="true"] .panel_left,
        html[data-wtf-layout="portrait"][data-wtf-panels-collapsed="true"] .panel_right {
          display: none !important;
        }
        .marker {
          scale: var(--wtf-icon-scale);
          transform-origin: center;
        }
        ${paidUiSelector},
        ${removedToolbarSelector},
        [data-wtf-commercial-hidden="true"] {
          display: none !important;
          pointer-events: none !important;
          visibility: hidden !important;
        }
      `;
      (document.head || root).appendChild(style);
    }
    scheduleResponsivePanelLayout();
  };

  const requestMarkerRedraw = () => {
    window.dispatchEvent(new Event('resize'));
    document.querySelector('.markers-canvas')?.dispatchEvent(new Event('wtf-scale-changed'));
  };

  window.__wtfSetEnhancementSettings = (settings = {}) => {
    state.language = String(settings.language || 'en').toLowerCase();
    state.uiScale = clamp(settings.uiScale, 0.65, 2, 1);
    state.fontScale = clamp(settings.fontScale, 0.5, 1.5, 1);
    state.iconScale = clamp(settings.iconScale, 0.5, 6.5, 1);
    state.popupOpacity = clamp(settings.popupOpacity, 0.3, 1, 1);
    state.routeLineWidth = clamp(settings.routeLineWidth, 0.5, 8, 1.5);
    const panel = settings.questRequirementsPanel || {};
    const mode = String(panel.mode || 'right').toLowerCase();
    state.questRequirementsPanel = {
      mode: mode === 'bottom' || mode === 'floating' ? mode : 'right',
      x: clamp(panel.x, 0, Math.max(0, window.innerWidth - 260), 0),
      y: clamp(panel.y, 0, Math.max(0, window.innerHeight - 120), 80),
      width: clamp(panel.width, 260, 1200, 360),
      height: clamp(panel.height, 120, 1000, 520),
      collapsed: Boolean(panel.collapsed)
    };
    applyDomScale();
    applyQuestRequirementsPanelLayout();
    requestMarkerRedraw();
    renderQuestRequirementsPanel();
  };

  const wtfOverlayState = {
    quest: { map: '', markers: [] },
    questPins: new Map(),
    liveQuestStore: null,
    liveQuestLoadPromise: null,
    liveQuestRetryTimer: 0,
    liveQuestSource: 'not-loaded',
    liveQuestError: '',
    questLayer: null,
    nativeQuestFilterGuardId: 0,
    floorEventsInstalled: false,
    squad: { map: '', members: [] },
    squadLayer: null,
    pings: { map: '', pings: [] },
    pingsVisible: true,
    pingLayer: null,
    route: { map: '', nodes: [], maxNodes: 40, localNodeCount: 0 },
    routeVisible: true,
    panelLayoutFrame: 0,
    portraitPanelShell: null,
    routeLayer: null,
    mapContainer: null,
    mapWrap: null,
    mapScene: null,
    mapCanvas: null,
    layerNumbersKey: '',
    layerNumbers: null,
    domObserver: null,
    mapObserver: null,
    resizeObserver: null,
    questRequirementsCache: new Map(),
    questRequirementsPending: new Map(),
    questRequirementsLoadChain: Promise.resolve(),
    selectedQuests: [],
    questSelectionKey: '',
    questRequirementsSaveTimer: 0,
    questRequirementsResizeObserver: null,
    questIdentityCache: new Map(),
    // From the live Tarkov-Market quest store: uid -> English name, and
    // normalized English/localized name -> English name / localized name.
    questEnglishNamesByUid: new Map(),
    questEnglishNamesByAnyName: new Map(),
    questLocalizedNames: new Map(),
    updateFrame: 0,
    hydrateFrame: 0
  };

  const numericCssVariable = (root, name, fallback) => {
    const value = Number.parseFloat(getComputedStyle(root).getPropertyValue(name));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };

  const ensurePortraitPanelShell = (mapContainer) => {
    let shell = wtfOverlayState.portraitPanelShell;
    if (!shell || !shell.isConnected) {
      shell = document.getElementById('wtf-portrait-panel-shell');
    }
    if (!shell) {
      shell = document.createElement('div');
      shell.id = 'wtf-portrait-panel-shell';
      shell.hidden = true;
      shell.setAttribute('aria-hidden', 'true');
      mapContainer.appendChild(shell);
    } else if (shell.parentElement !== mapContainer) {
      mapContainer.appendChild(shell);
    }
    wtfOverlayState.portraitPanelShell = shell;
    return shell;
  };

  const applyPortraitQuestScrollHeight = (rightPanel, panelHeight, contentScale, root) => {
    const questPanel = Array.from(rightPanel.children)
      .find(element => element.classList?.contains('tools_quests'));
    if (!questPanel) return;

    const panelStyle = getComputedStyle(rightPanel);
    const padding = Number.parseFloat(panelStyle.paddingTop || '0')
      + Number.parseFloat(panelStyle.paddingBottom || '0');
    const marginHeight = (element) => {
      const style = getComputedStyle(element);
      return (
        Number.parseFloat(style.marginTop || '0')
        + Number.parseFloat(style.marginBottom || '0')
      ) * contentScale;
    };
    const fixedPhysicalHeight = Array.from(rightPanel.children)
      .filter(element => element !== questPanel)
      .reduce((total, element) => total + element.getBoundingClientRect().height + marginHeight(element), 0);
    const availablePhysicalHeight = Math.max(
      80,
      panelHeight - padding - fixedPhysicalHeight - marginHeight(questPanel)
    );
    root.style.setProperty(
      '--wtf-portrait-quest-height',
      `${availablePhysicalHeight / contentScale}px`
    );
  };

  // Unscaled single-row width of the toolbar. The panel itself is a block that
  // fills its max-width, so its own width would feed the previous scale back in
  // and the toolbar could never grow again after the UI size was lowered.
  const naturalTopPanelWidth = (topPanel, currentScale) => {
    const fallback = topPanel.getBoundingClientRect().width / currentScale;
    const row = topPanel.querySelector(':scope > .map-toolbar')
      || (getComputedStyle(topPanel).display.includes('flex') ? topPanel : topPanel.firstElementChild);
    if (!row) return fallback;
    const items = [...row.children].filter((item) => !item.matches('.wtf-toolbar-break')
      && item.getBoundingClientRect().width > 0);
    if (!items.length) return fallback;
    const rowStyle = getComputedStyle(row);
    const panelStyle = getComputedStyle(topPanel);
    const px = (value) => Number.parseFloat(value) || 0;
    let width = (px(rowStyle.columnGap) * (items.length - 1))
      + px(rowStyle.paddingLeft) + px(rowStyle.paddingRight);
    if (row !== topPanel) {
      width += px(panelStyle.paddingLeft) + px(panelStyle.paddingRight)
        + px(panelStyle.borderLeftWidth) + px(panelStyle.borderRightWidth);
    }
    for (const item of items) {
      const itemStyle = getComputedStyle(item);
      width += (item.getBoundingClientRect().width / currentScale)
        + px(itemStyle.marginLeft) + px(itemStyle.marginRight);
    }
    return width > 0 ? width : fallback;
  };

  const applyResponsivePanelLayout = () => {
    wtfOverlayState.panelLayoutFrame = 0;
    const root = document.documentElement;
    const topPanel = document.querySelector('.panel_top');
    const leftPanel = document.querySelector('.panel_left');
    const rightPanel = document.querySelector('.panel_right');
    const mapContainer = document.querySelector('.map-cont');
    if (!root) return;

    const viewportWidth = Math.max(0, document.documentElement.clientWidth || window.innerWidth || 0);
    const viewportHeight = Math.max(0, document.documentElement.clientHeight || window.innerHeight || 0);
    const portrait = viewportHeight > viewportWidth;
    const previousLayout = root.dataset.wtfLayout || '';
    const currentTopScale = numericCssVariable(root, '--wtf-top-ui-scale', state.uiScale);
    const currentSideScale = numericCssVariable(root, '--wtf-side-ui-scale', state.uiScale);
    let topScale = state.uiScale;
    let sideScale = state.uiScale;

    root.dataset.wtfLayout = portrait ? 'portrait' : 'landscape';

    if (topPanel && viewportWidth > 0) {
      const topWidth = naturalTopPanelWidth(topPanel, currentTopScale);
      if (topWidth > 0) {
        const maximumTopScale = portrait ? 1.15 : state.uiScale;
        const minimumTopScale = portrait ? 0.5 : 0.65;
        // 2% headroom so sub-pixel rounding never pushes the last item to a second row.
        const fittedTopScale = Math.min(
          topScale,
          maximumTopScale,
          Math.max(minimumTopScale, (viewportWidth - 30) / (topWidth * 1.02))
        );
        // The host shrinks the whole page (WebView2 zoom down to 0.5) to keep
        // the desktop layout. Portrait halves the toolbar on top of that, so
        // keep it at least half of its 100% size on screen.
        const hostZoom = clamp(window.__wtfHostZoom, 0.25, 1, 1);
        topScale = portrait
          ? clamp(Math.max(fittedTopScale * 0.5, 0.5 / hostZoom), 0.35, 1.15, 0.5)
          : fittedTopScale;
        // Flexible items (the search box) change width with the scale; ignore
        // sub-1.5% re-fits so the toolbar does not jitter on every DOM update.
        if (Math.abs(topScale - currentTopScale) < 0.015) topScale = currentTopScale;
      }
      topPanel.style.maxWidth = `${Math.max(1, (viewportWidth - 30) / topScale)}px`;
    }
    root.style.setProperty('--wtf-top-ui-scale', String(topScale));

    if (leftPanel && rightPanel && mapContainer) {
      const mapRect = mapContainer.getBoundingClientRect();
      const shell = ensurePortraitPanelShell(mapContainer);
      const panelsCollapsed = leftPanel.classList.contains('collapsed')
        || rightPanel.classList.contains('collapsed');
      root.dataset.wtfPanelsCollapsed = panelsCollapsed ? 'true' : 'false';

      if (portrait && mapRect.width > 0 && mapRect.height > 0) {
        const panelLeft = Math.min(12, Math.max(6, mapRect.width * 0.02));
        const panelWidth = Math.max(1, mapRect.width - panelLeft * 2);
        const leftWidth = panelWidth * 0.25;
        const rightWidth = panelWidth - leftWidth;
        const topRect = topPanel?.getBoundingClientRect();
        const topClearance = Math.max(
          8,
          topRect?.height > 0 ? topRect.bottom - mapRect.top + 8 : 76
        );
        const panelBottom = 12;
        const availableHeight = Math.max(180, mapRect.height - topClearance - panelBottom);
        const panelHeight = Math.min(availableHeight, Math.min(480, Math.max(260, mapRect.height * 0.34)));
        const panelTop = Math.max(topClearance, mapRect.height - panelHeight - panelBottom);
        const automaticPortraitScale = clamp(mapRect.width / 980, 0.72, 1, 0.85);
        const portraitContentScale = clamp(
          automaticPortraitScale * state.uiScale,
          0.65,
          1.15,
          automaticPortraitScale
        );

        sideScale = 1;
        root.style.setProperty('--wtf-portrait-panel-left', `${panelLeft}px`);
        root.style.setProperty('--wtf-portrait-panel-top', `${panelTop}px`);
        root.style.setProperty('--wtf-portrait-panel-width', `${panelWidth}px`);
        root.style.setProperty('--wtf-portrait-panel-height', `${panelHeight}px`);
        root.style.setProperty('--wtf-portrait-left-width', `${leftWidth}px`);
        root.style.setProperty('--wtf-portrait-right-left', `${panelLeft + leftWidth}px`);
        root.style.setProperty('--wtf-portrait-right-width', `${rightWidth}px`);
        root.style.setProperty('--wtf-portrait-content-scale', String(portraitContentScale));
        root.style.setProperty(
          '--wtf-portrait-left-content-width',
          `${Math.max(1, leftWidth - 15) / portraitContentScale}px`
        );
        root.style.setProperty(
          '--wtf-portrait-right-content-width',
          `${Math.max(1, rightWidth - 14) / portraitContentScale}px`
        );
        applyPortraitQuestScrollHeight(rightPanel, panelHeight, portraitContentScale, root);
        shell.hidden = panelsCollapsed;
      } else {
        shell.hidden = true;
        if (previousLayout === 'portrait') {
          // Tarkov-Market writes an inline max-height from the panel's current
          // top position. In portrait mode that position is near the bottom of
          // the viewport; keeping the value after returning to landscape can
          // produce a negative max-height and leave the scrolled panel above
          // the visible map. Restore the native landscape baseline first.
          leftPanel.scrollTop = 0;
          rightPanel.scrollTop = 0;
          leftPanel.style.removeProperty('max-height');
          rightPanel.style.removeProperty('max-height');
          for (const scrollArea of [
            ...leftPanel.querySelectorAll('.scroll'),
            ...rightPanel.querySelectorAll('.scroll')
          ]) {
            scrollArea.scrollTop = 0;
            scrollArea.style.removeProperty('max-height');
          }
        }
        const mapWidth = mapRect.width;
        const leftWidth = leftPanel.getBoundingClientRect().width / currentSideScale;
        const rightWidth = rightPanel.getBoundingClientRect().width / currentSideScale;
        const basePanelWidth = leftWidth + rightWidth;
        const minimumMapWidth = 260;
        const panelMarginsAndGap = 30;
        if (mapWidth > 0 && basePanelWidth > 0) {
          const maximumSideScale = (mapWidth - minimumMapWidth - panelMarginsAndGap) / basePanelWidth;
          sideScale = Math.min(sideScale, Math.max(0.65, maximumSideScale));
        }
        // The new map toolbar no longer reserves vertical space for the panels.
        const toolbarBottom = topPanel?.getBoundingClientRect().bottom || mapRect.top;
        const panelTop = Math.max(10, toolbarBottom - mapRect.top + 8);
        root.style.setProperty('--wtf-landscape-panel-top', `${panelTop / sideScale}px`);
        root.style.setProperty('--wtf-landscape-panel-height', `${Math.max(80, mapRect.height - panelTop - 12) / sideScale}px`);
      }
    }

    root.style.setProperty('--wtf-top-ui-scale', String(topScale));
    root.style.setProperty('--wtf-side-ui-scale', String(sideScale));
    applyQuestRequirementsPanelLayout();
  };

  const scheduleResponsivePanelLayout = () => {
    if (wtfOverlayState.panelLayoutFrame) return;
    wtfOverlayState.panelLayoutFrame = requestAnimationFrame(applyResponsivePanelLayout);
  };

  const tarkovMarketQuestIconPath = 'm253.943,502.885c-66.495,0-129.01-25.895-176.029-72.913C30.895,382.953,5,320.438,5,253.943S30.895,124.933,77.914,77.914,187.448,5,253.943,5s129.01,25.895,176.029,72.914c47.019,47.019,72.913,109.534,72.913,176.029s-25.895,129.01-72.913,176.029c-47.02,47.019-109.534,72.913-176.029,72.913Zm0-437.885c-104.184,0-188.943,84.759-188.943,188.943s84.759,188.942,188.943,188.942,188.942-84.759,188.942-188.942-84.759-188.943-188.942-188.943Zm40,289.2h-80v70h80v-70Zm0-269.75h-80v250.265h80V84.449Z';
  // The quest icon's outer ring only (outer r 248.943, hole r 188.943).
  const tarkovMarketQuestRingPath = 'M253.943 5A248.943 248.943 0 1 1 253.943 502.886A248.943 248.943 0 1 1 253.943 5Z'
    + 'M253.943 65A188.943 188.943 0 1 0 253.943 442.886A188.943 188.943 0 1 0 253.943 65Z';

  // Keep the same projection constants and operation order as Tarkov-Market's
  // canvas renderer. Live marker geometry is projected directly from its store.
  const tarkovMarketMapDefinitions = {
    'ground-zero': { width: 2800, height: 3100, zoom: 1, rotate: 90, xOffset: 1600, yOffset: 1300, ratio: 2 },
    factory: { width: 3600, height: 3600, zoom: 0.7, rotate: 0, xOffset: 1800, yOffset: 1850, ratio: 10 },
    customs: { width: 4400, height: 3200, zoom: 0.6, rotate: 90, xOffset: 2600, yOffset: 1600, ratio: 2 },
    interchange: { width: 4000, height: 3900, zoom: 0.55, rotate: 90, xOffset: 2166, yOffset: 2004, ratio: 2 },
    woods: { width: 4800, height: 4800, zoom: 0.4, rotate: 90, xOffset: 2200, yOffset: 2840, ratio: 2 },
    shoreline: { width: 3700, height: 3100, zoom: 0.8, rotate: 90, xOffset: 1570, yOffset: 1450, ratio: 1 },
    reserve: { width: 3200, height: 3000, zoom: 1, rotate: 105, xOffset: 1600, yOffset: 1520, ratio: 2 },
    lighthouse: { width: 3100, height: 3700, zoom: 0.65, rotate: 90, xOffset: 1550, yOffset: 2050, ratio: 1 },
    streets: { width: 3260, height: 3500, zoom: 0.7, rotate: 90, xOffset: 1660, yOffset: 1420, ratio: 2 },
    lab: { width: 5500, height: 4200, zoom: 0.41, rotate: 180, xOffset: 6100, yOffset: 4050, ratio: 10 },
    labyrinth: { width: 3300, height: 3200, zoom: 0.8, rotate: 180, xOffset: 1485, yOffset: 1602, ratio: 10 },
    terminal: { width: 3850, height: 4150, zoom: 0.52, rotate: 90, xOffset: 1926, yOffset: 2160, ratio: 2 },
    icebreaker: { width: 5000, height: 8400, zoom: 0.24, rotate: 90, xOffset: 2500, yOffset: 4200, ratio: 25 }
  };

  // Tarkov-Market has no Terminal markers for The Ticket (its quest marker sits on
  // Shoreline), so the Terminal walkthrough steps are ours. Positions are game
  // coordinates in the site's own marker space (geometry.x / geometry.y), placed
  // from re3mr's Terminal PSD (CC BY-NC-SA 4.0) and the EFT wiki walkthrough;
  // step 10 sits on the site's Pier Door unlock icon (measured in the app).
  // They render as numbered rings and follow the quest pin like site markers.
  const builtInQuestSteps = {
    terminal: {
      quest: 'The Ticket',
      wiki: 'https://escapefromtarkov.fandom.com/wiki/The_Ticket',
      steps: [
        {
          x: -327.5, y: 176.1, en: 'Find the key for the armory', kr: '무기고 열쇠 찾기',
          details: { en: 'The Armory key spawns in one of 4 places: three dead RUAF soldiers (outside the spawn building, on the route, outside the armory) or the table inside the armory.', kr: '무기고 열쇠는 4곳 중 1곳에 스폰: RUAF 병사 시체 3구(스폰 건물 앞, 무기고 가는 길, 무기고 앞) 또는 무기고 안 테이블.' },
          images: [
            { src: 'maps/terminal-photos/armory-key-1-body-armory.webp', en: 'Inside a dead RUAF soldier outside the armory building.', kr: '무기고 건물 앞 RUAF 병사 시체 안.' },
            { src: 'maps/terminal-photos/armory-key-2-table.webp', en: 'On a table inside the armory building.', kr: '무기고 건물 안 테이블 위.' },
            { src: 'maps/terminal-photos/armory-key-3-body-route.webp', en: 'In the left hand of a dead RUAF soldier on the way to the armory.', kr: '무기고 가는 길 RUAF 병사 시체의 왼손.' },
            { src: 'maps/terminal-photos/armory-key-4-body-spawn.webp', en: 'In the right hand of a dead RUAF soldier right outside the spawn building.', kr: '스폰 건물 바로 앞 RUAF 병사 시체의 오른손.' }
          ]
        },
        {
          x: -257.4, y: 188.4, en: 'Unlock the armory and recover your equipment', kr: '무기고를 열고 장비 회수',
          details: { en: 'Open the armory with the Armory key. Your equipment is in a random locker. Savior ending: also take the Alpha-1 container from the desk under the window.', kr: 'Armory key로 무기고 열기. 장비는 무작위 사물함 1곳에 있음. Savior 엔딩: 창문 아래 책상의 Alpha-1 컨테이너도 획득.' },
          images: [
            { src: 'maps/terminal-photos/armory-equipment-locker.webp', en: 'The equipment is in a random locker.', kr: '장비는 무작위 사물함에 있음.' },
            { src: 'maps/terminal-photos/alpha1-container.webp', en: 'Savior ending: Alpha-1 container on the desk under the window.', kr: 'Savior 엔딩: 창문 아래 책상 위 Alpha-1 컨테이너.' }
          ]
        },
        {
          x: -267.1, y: 264.4, en: 'Obtain the Black Division keycard', kr: '블랙 디비전 키카드 획득',
          details: { en: 'Seaport Terminal building (MS), west of the armory: weapon box on a tipped-over ATM. A Black Division squad guards the building.', kr: '무기고 서쪽 Seaport Terminal 건물(MS): 넘어진 ATM 위 무기 상자. 건물은 블랙 디비전 분대가 지킴.' },
          images: [
            { src: 'maps/terminal-photos/black-keycard-spawn.webp', en: 'Inside the weapon box on an ATM.', kr: 'ATM 위 무기 상자 안.' },
            { src: 'maps/terminal-photos/seaport-weapon-box.webp', en: 'The weapon box inside the building.', kr: '건물 안 무기 상자.' },
            { src: 'maps/terminal-photos/seaport-building.webp', en: 'The Seaport Terminal building (MS).', kr: 'Seaport Terminal 건물(MS).' }
          ]
        },
        {
          x: -153.8, y: 85.3, en: 'Access the Terminal loading zone', kr: '터미널 하역 구역 진입',
          details: { en: 'Admin building (D3): clear the Black Division team at the entrance, then swipe the keycard at the scanner next to the service-passage door.', kr: 'Admin 건물(D3): 입구의 블랙 디비전 팀 처리 후, 서비스 통로 문 옆 스캐너에 키카드 사용.' },
          images: [
            { src: 'maps/terminal-photos/admin-keypad-door.webp', en: 'The door.', kr: '문.' },
            { src: 'maps/terminal-photos/admin-building.webp', en: 'The administration building.', kr: 'Admin 건물.' }
          ]
        },
        {
          x: 7.8, y: 122.5, en: 'Open the metal gate to the fuel depot', kr: '연료 저장소 금속 문 열기',
          details: { en: 'Use an SZ-1 explosive charge (7 spawns nearby), Elite Strength, or push it with another player.', kr: 'SZ-1 폭약(근처 스폰 7곳) 사용, Strength 엘리트, 또는 다른 플레이어와 함께 밀어서 열기.' },
          images: [
            { src: 'maps/terminal-photos/metal-gate.webp', en: 'The gate.', kr: '게이트.' }
          ]
        },
        {
          x: 24.5, y: 128.8, en: '(Optional) Take a Toolset', kr: '(선택) 공구 세트 챙기기',
          details: { en: 'Three Toolsets spawn every raid just past the metal gate. Not required: panels can be repaired bare-handed, but with a low success chance and arm damage on failure.', kr: 'Metal Gate 바로 지나 Toolset 3개가 매 레이드 스폰. 필수 아님: 맨손 수리도 가능하지만 성공률이 낮고 실패 시 팔 손상.' },
          images: [
            { src: 'maps/terminal-photos/toolset-1.webp', en: '1: In front of the BRDM after the gate, on a concrete barricade.', kr: '1: 게이트 지나 BRDM 앞 콘크리트 바리케이드 위.' },
            { src: 'maps/terminal-photos/toolset-3.webp', en: '3: Next to the fuel pumps left after the gate, on barrels.', kr: '3: 게이트 지나 왼쪽 주유기 옆 드럼통 위.' }
          ]
        },
        {
          x: 253.1, y: 180.1, en: 'Repair the broken electrical panel', kr: '고장 난 배전반 수리',
          details: { en: 'Solo: always panel 9 or 10. 2-5 players: 1-5 panels across all 10 locations. Look for the open, sparking panel.', kr: '솔로: 항상 9번 또는 10번 배전반. 2-5명: 10곳 중 1-5개. 열려 있고 스파크가 튀는 배전반 찾기.' },
          images: [
            { src: 'maps/terminal-photos/panel-10.webp', en: 'No. 10 - Right outside the pumping station door.', kr: '10번 - 펌핑 스테이션 문 바로 앞.' },
            { src: 'maps/terminal-photos/panel-9.webp', en: 'No. 9 - Behind the building right after the metal gate.', kr: '9번 - Metal Gate 바로 지나 건물 뒤.' }
          ]
        },
        {
          x: 260.7, y: 154.8, en: 'Drain the water in the pumping station', kr: '펌핑 스테이션 물 빼기',
          details: { en: 'Once power is restored, press the drain button inside the pumping station.', kr: '전력 복구 후 펌핑 스테이션 안 배수 버튼 누르기.' },
          images: [
            { src: 'maps/terminal-photos/pump-drain-button.webp', en: 'The button that drains the water.', kr: '물을 빼는 버튼.' },
            { src: 'maps/terminal-photos/pump-station.webp', en: 'The pumping station.', kr: '펌핑 스테이션.' }
          ]
        },
        {
          x: 266.1, y: 150.3, en: 'Take the Pier door key', kr: '부두 문 열쇠 챙기기',
          details: { en: 'From the safe inside the pumping station, only after draining the water.', kr: '물을 뺀 뒤에만, 펌핑 스테이션 안 금고에서 획득.' },
          images: [
            { src: 'maps/terminal-photos/pier-key-safe.webp', en: 'The safe.', kr: '금고.' },
            { src: 'maps/terminal-photos/pier-key-room.webp', en: 'The room with the safe.', kr: '금고가 있는 방.' }
          ]
        },
        {
          x: 338.7, y: -259.6, en: 'Unlock the pier door', kr: '부두 문 열기',
          details: { en: 'Three routes through the container loading bays (east / centre / west); Black Division squads on every route. Opening the door starts a 3-minute extraction timer for everyone.', kr: '컨테이너 하역장을 지나는 경로 3개(동쪽 / 가운데 / 서쪽), 모든 경로에 블랙 디비전 분대. 문을 열면 모두에게 3분 탈출 타이머 시작.' },
          images: [
            { src: 'maps/terminal-photos/pier-door.webp', en: 'The pier door.', kr: '부두 문.' }
          ]
        },
        {
          x: 74.6, y: -295.2, en: 'Escape from Tarkov', kr: '타르코프 탈출',
          details: { en: 'Reach the Zubr Boat within 3 minutes of the pier door opening. A final Black Division team guards the pier.', kr: '부두 문이 열린 뒤 3분 안에 Zubr Boat 도착. 부두는 마지막 블랙 디비전 팀이 지킴.' },
          images: [
            { src: 'maps/terminal-photos/zubr-boat.webp', en: 'The Zubr Boat extraction.', kr: 'Zubr Boat 탈출구.' }
          ]
        }
      ]
    }
  };
  // Site icon positions are recorded only where step rings may need them.
  nativeIconFrame.wanted = (slug) => Object.prototype.hasOwnProperty.call(builtInQuestSteps, slug);

  const participantPalette = [
    { color: '#ff3b30', glow: 'rgba(255, 59, 48, .9)' },
    { color: '#ffd60a', glow: 'rgba(255, 214, 10, .9)' },
    { color: '#30d158', glow: 'rgba(48, 209, 88, .9)' },
    { color: '#00c7a5', glow: 'rgba(0, 199, 165, .9)' },
    { color: '#9a6a3a', glow: 'rgba(154, 106, 58, .9)' }
  ];
  const participantSlotByCreator = new Map();

  const participantKey = item => String(item?.creatorId || item?.creatorName || 'local').trim().toLowerCase();
  const resolveParticipantSlot = item => {
    const explicit = Math.trunc(Number(item?.participantSlot));
    const key = participantKey(item);
    if (explicit >= 1 && explicit <= participantPalette.length) {
      participantSlotByCreator.set(key, explicit);
      return explicit;
    }
    if (participantSlotByCreator.has(key)) return participantSlotByCreator.get(key);
    const used = new Set(participantSlotByCreator.values());
    const slot = Array.from({ length: participantPalette.length }, (_, index) => index + 1)
      .find(value => !used.has(value)) || 1;
    participantSlotByCreator.set(key, slot);
    return slot;
  };

  const applyParticipantColor = (element, item) => {
    const slot = resolveParticipantSlot(item);
    const palette = participantPalette[slot - 1];
    element.dataset.participantSlot = String(slot);
    element.style.setProperty('--wtf-participant-color', palette.color);
    element.style.setProperty('--wtf-participant-glow', palette.glow);
    return slot;
  };

  // Game names and quest text come from Tarkov-Market's own localization
  // (the app opens /kr/ pages in Korean mode); we only read the site locale to
  // label our own overlays the same way the site does.
  const siteLocale = () => {
    const prefix = String(location.pathname || '').match(/^\/([a-z]{2})\/(?:maps|progression)\//i)?.[1];
    return prefix ? prefix.toLowerCase() : 'en';
  };

  const sitePathPrefix = () => (siteLocale() === 'en' ? '' : `/${siteLocale()}`);

  const localizedLiveText = (english, l10n) => {
    const locale = siteLocale();
    const localized = locale === 'en' ? '' : String(l10n?.[locale] || '').replace(/\s+/g, ' ').trim();
    return localized || String(english || '').replace(/\s+/g, ' ').trim();
  };

  const isKoreanQuestMode = () => state.language === 'ko' || state.language.startsWith('ko-');

  // Quest identity stays the English name/UID; display uses the site locale.
  const formatQuestName = (english) => {
    const key = normalizeQuestName(english);
    return wtfOverlayState.questLocalizedNames.get(key) || String(english || '').replace(/\s+/g, ' ').trim();
  };

  const questPanelCopy = (key, count = 0) => {
    const english = {
      title: `Quest requirements (${count})`,
      ariaLabel: 'Pinned quest requirements',
      prerequisites: 'Prerequisites',
      objectives: 'Objectives',
      noPrerequisites: 'No prerequisite quests',
      noObjectives: 'No objectives listed',
      loading: 'Loading requirements…',
      loadError: 'Unable to load quest requirements',
      dockRight: 'Dock right',
      dockBottom: 'Dock bottom',
      expand: 'Expand',
      collapse: 'Collapse'
    };
    if (!isKoreanQuestMode()) return english[key] || key;
    const korean = {
      title: `고정 퀘스트 할 일 (${count})`,
      ariaLabel: '고정한 퀘스트의 선행 조건과 목표',
      prerequisites: '선행 조건',
      objectives: '현재 목표',
      noPrerequisites: '필요한 선행 퀘스트 없음',
      noObjectives: '표시할 목표 없음',
      loading: '퀘스트 내용을 불러오는 중…',
      loadError: '퀘스트 내용을 불러오지 못했습니다',
      dockRight: '오른쪽에 고정',
      dockBottom: '아래쪽에 고정',
      expand: '펼치기',
      collapse: '접기'
    };
    return korean[key] || english[key] || key;
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
      div.items.scroll div.no-wrap.d-flex[data-wtf-pinned="true"] > span:not(.alt) {
        color: #ded9cd !important;
      }
      #wtf-quest-layer {
        inset: 0;
        overflow: hidden;
        pointer-events: none !important;
        position: absolute;
        z-index: 7;
      }
      .wtf-quest-zone-canvas {
        height: 100%;
        inset: 0;
        overflow: hidden;
        pointer-events: none !important;
        position: absolute;
        width: 100%;
      }
      .wtf-quest-zone {
        fill-opacity: .22;
        pointer-events: none !important;
        stroke-linejoin: round;
        stroke-width: 1.4;
      }
      .wtf-quest-zone.wtf-other-floor {
        opacity: .2;
      }
      .wtf-quest-marker {
        align-items: center;
        cursor: pointer;
        display: flex;
        height: 30px;
        justify-content: center;
        left: 0;
        pointer-events: auto !important;
        position: absolute;
        top: 0;
        transform: translate(-50%, -50%) scale(var(--wtf-quest-marker-scale, 1));
        transform-origin: center;
        user-select: none;
        width: 30px;
      }
      .wtf-quest-marker-icon {
        display: block;
        height: 30px;
        overflow: visible;
        width: 30px;
      }
      .wtf-quest-marker.wtf-other-floor {
        opacity: .2;
      }
      .wtf-quest-step-number {
        font-family: Arial, Helvetica, sans-serif;
        font-weight: 700;
      }
      .wtf-quest-marker:focus-visible {
        outline: 2px solid #e5b35c;
        outline-offset: 4px;
      }
      #wtf-quest-requirements-panel {
        background: rgba(20, 20, 18, .97);
        border: 1px solid rgba(154, 136, 102, .72);
        box-shadow: 0 7px 24px rgba(0, 0, 0, .65);
        box-sizing: border-box;
        color: #d8d3c6;
        display: flex;
        flex-direction: column;
        min-height: 120px;
        min-width: 260px;
        overflow: hidden;
        position: fixed;
        resize: both;
        z-index: 10000;
      }
      #wtf-quest-requirements-panel[hidden] {
        display: none !important;
      }
      #wtf-quest-requirements-panel.wtf-collapsed {
        height: auto !important;
        min-height: 0;
        resize: none;
      }
      .wtf-quest-requirements-header {
        align-items: center;
        background: rgba(49, 46, 39, .98);
        border-bottom: 1px solid rgba(154, 136, 102, .45);
        cursor: move;
        display: flex;
        flex: 0 0 auto;
        gap: 6px;
        min-height: 34px;
        padding: 4px 6px 4px 10px;
        user-select: none;
      }
      .wtf-quest-requirements-title {
        color: #eee9dd;
        flex: 1 1 auto;
        font-size: 13px;
        font-weight: 700;
        min-width: 0;
      }
      .wtf-quest-requirements-button {
        align-items: center;
        background: #27251f;
        border: 1px solid rgba(154, 136, 102, .6);
        color: #c8c1b2;
        cursor: pointer;
        display: inline-flex;
        font: 700 11px/1 sans-serif;
        height: 23px;
        justify-content: center;
        min-width: 25px;
        padding: 0 6px;
      }
      .wtf-quest-requirements-button:hover,
      .wtf-quest-requirements-button.wtf-active {
        background: #514b3d;
        color: #fff;
      }
      .wtf-quest-requirements-body {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
        padding: 8px;
      }
      .wtf-collapsed .wtf-quest-requirements-body {
        display: none;
      }
      .wtf-quest-requirements-card {
        background: rgba(38, 36, 31, .82);
        border-left: 3px solid #8e7d5c;
        margin-bottom: 8px;
        padding: 8px 9px;
      }
      .wtf-quest-requirements-name {
        color: #f0eadc;
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 7px;
      }
      .wtf-quest-requirements-section + .wtf-quest-requirements-section {
        margin-top: 7px;
      }
      .wtf-quest-requirements-label {
        color: #a99b7c;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .06em;
        margin-bottom: 3px;
        text-transform: uppercase;
      }
      .wtf-quest-requirements-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .wtf-quest-requirements-list li {
        line-height: 1.35;
        padding: 2px 0 2px 13px;
        position: relative;
      }
      .wtf-quest-requirements-list li::before {
        color: #8e7d5c;
        content: '•';
        left: 2px;
        position: absolute;
      }
      .wtf-quest-requirements-status {
        color: #a49d90;
        font-size: 11px;
        padding: 4px 1px;
      }
      #wtf-quest-requirements-loader {
        border: 0;
        height: 1px;
        left: -10000px;
        opacity: 0;
        pointer-events: none;
        position: fixed;
        top: -10000px;
        width: 1px;
      }
      .map-popup {
        opacity: var(--wtf-popup-opacity, 1) !important;
      }
      /* Terminal tilt: the site's compass turns with the map, letters stay upright. */
      .map-compass__rose,
      .map-compass__cardinal-orbit {
        rotate: var(--wtf-map-tilt, 0deg);
      }
      .map-compass__cardinal {
        rotate: calc(-1 * var(--wtf-map-tilt, 0deg));
      }
      .map-compass-anchor {
        translate: var(--wtf-compass-tilt-x, 0px) var(--wtf-compass-tilt-y, 0px);
      }
      .map-popup:not(.mobile) {
        box-sizing: border-box;
        max-width: var(--wtf-popup-max-width, calc(100vw - 16px)) !important;
        max-height: var(--wtf-popup-max-height, calc(100vh - 16px)) !important;
        overflow: auto;
        overscroll-behavior: contain;
        translate: calc(var(--wtf-popup-shift-x, 0px) + var(--wtf-popup-tilt-x, 0px)) calc(var(--wtf-popup-shift-y, 0px) + var(--wtf-popup-tilt-y, 0px));
      }
      .wtf-popup-close {
        align-items: center;
        background: transparent !important;
        border: 0 !important;
        color: #a49d90 !important;
        cursor: pointer;
        display: inline-flex;
        font-family: Arial, sans-serif;
        font-size: 24px !important;
        font-weight: 400 !important;
        height: 28px;
        justify-content: center;
        line-height: 24px !important;
        margin: -6px -7px 0 8px !important;
        min-width: 28px !important;
        padding: 0 !important;
        width: 28px;
      }
      .wtf-popup-close:hover,
      .wtf-popup-close:focus-visible {
        color: #e5b35c !important;
      }
      .map-popup.mobile .wtf-native-popup-close {
        display: none !important;
      }
      .map-popup .large.pointer.text-right {
        display: none !important;
      }
      #wtf-squad-layer {
        inset: 0;
        overflow: hidden;
        pointer-events: none !important;
        position: absolute;
        z-index: 8;
      }
      .wtf-squad-marker {
        height: 24px;
        left: 0;
        pointer-events: none !important;
        position: absolute;
        top: 0;
        transform: translate(-50%, -50%) scale(var(--wtf-icon-scale, 1));
        transform-origin: center;
        user-select: none;
        width: 24px;
      }
      .wtf-squad-direction {
        height: 24px;
        left: 0;
        position: absolute;
        top: 0;
        transform: rotate(var(--wtf-squad-direction, 0deg));
        transform-origin: 12px 12px;
        width: 24px;
      }
      .wtf-squad-circle {
        background: #1672e8;
        border: 2px solid #fff;
        border-radius: 50%;
        box-shadow: 0 0 6px rgba(22, 114, 232, .95);
        height: 16px;
        left: 4px;
        position: absolute;
        top: 6px;
        width: 16px;
      }
      .wtf-squad-arrow {
        border-bottom: 9px solid #1672e8;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        filter:
          drop-shadow(1px 0 0 #fff)
          drop-shadow(-1px 0 0 #fff)
          drop-shadow(0 -1px 0 #fff);
        height: 0;
        left: 7px;
        position: absolute;
        top: -1px;
        width: 0;
      }
      .wtf-squad-name {
        background: rgba(0, 0, 0, .72);
        border-radius: 2px;
        color: #fff;
        font-size: 10px;
        left: 50%;
        max-width: 120px;
        overflow: hidden;
        padding: 1px 3px;
        position: absolute;
        text-overflow: ellipsis;
        top: 25px;
        transform: translateX(-50%);
        white-space: nowrap;
      }
      #wtf-ping-layer {
        inset: 0;
        overflow: hidden;
        pointer-events: none !important;
        position: absolute;
        z-index: 9;
      }
      #wtf-ping-layer[hidden] { display: none !important; }
      .wtf-ping-marker {
        height: 24px;
        left: 0;
        pointer-events: none !important;
        position: absolute;
        top: 0;
        transform: translate(-50%, -50%) scale(var(--wtf-icon-scale, 1));
        transform-origin: center;
        width: 24px;
      }
      .wtf-ping-marker::before,
      .wtf-ping-marker::after {
        border: 2px solid var(--wtf-participant-color, #ff3b30);
        border-radius: 50%;
        box-sizing: border-box;
        content: '';
        left: 50%;
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%);
      }
      .wtf-ping-marker::before {
        background: var(--wtf-participant-color, #ff3b30);
        box-shadow: 0 0 8px var(--wtf-participant-glow, rgba(255, 59, 48, .95));
        height: 8px;
        width: 8px;
      }
      .wtf-ping-marker::after {
        height: 22px;
        width: 22px;
      }
      .wtf-ping-marker.wtf-other-floor { opacity: .35; }
      .wtf-ping-name {
        background: rgba(0, 0, 0, .76);
        border-radius: 2px;
        color: var(--wtf-participant-color, #ffd992);
        font: 700 10px/1.2 Arial, sans-serif;
        left: 50%;
        max-width: 130px;
        overflow: hidden;
        padding: 2px 4px;
        position: absolute;
        text-overflow: ellipsis;
        top: 25px;
        transform: translateX(-50%);
        white-space: nowrap;
      }
      #wtf-ping-control {
        cursor: pointer;
        user-select: none;
      }
      .wtf-ping-dot {
        background: conic-gradient(#ff3b30 0 20%, #ffd60a 20% 40%, #30d158 40% 60%, #00c7a5 60% 80%, #9a6a3a 80%);
        border: 1px solid rgba(255, 255, 255, .75);
        border-radius: 50%;
        box-shadow: 0 0 4px rgba(48, 209, 88, .8);
        box-sizing: border-box;
        display: inline-block;
        height: 12px;
        margin: 3px 4px 0 2px;
        width: 12px;
      }
      #wtf-clear-pings-button {
        white-space: nowrap;
      }
      #wtf-route-layer {
        inset: 0;
        overflow: hidden;
        pointer-events: none !important;
        position: absolute;
        z-index: 8;
      }
      #wtf-route-layer[hidden] { display: none !important; }
      .wtf-route-lines {
        height: 100%;
        inset: 0;
        overflow: visible;
        pointer-events: none !important;
        position: absolute;
        width: 100%;
      }
      .wtf-route-line {
        fill: none;
        opacity: .48;
        stroke: var(--wtf-participant-color, #ff3b30);
        stroke-dasharray: 4 5;
        stroke-linecap: round;
        stroke-width: var(--wtf-route-line-width, 1.5px);
      }
      .wtf-route-line.wtf-other-floor { opacity: .32; }
      .wtf-route-node {
        background: var(--wtf-participant-color, #ff3b30);
        border: 1px solid rgba(225, 246, 255, .95);
        border-radius: 50%;
        box-shadow: 0 0 4px var(--wtf-participant-glow, rgba(255, 59, 48, .8));
        box-sizing: border-box;
        cursor: context-menu;
        height: 7px;
        left: 0;
        pointer-events: auto !important;
        position: absolute;
        top: 0;
        transform: translate(-50%, -50%) scale(var(--wtf-icon-scale, 1));
        transform-origin: center;
        width: 7px;
      }
      .wtf-route-node.wtf-other-floor { opacity: .32; }
      .wtf-route-node[data-owned="false"] {
        cursor: default;
        pointer-events: none !important;
      }
      #wtf-route-control {
        cursor: pointer;
        user-select: none;
      }
      .wtf-route-dot {
        background: conic-gradient(#ff3b30 0 20%, #ffd60a 20% 40%, #30d158 40% 60%, #00c7a5 60% 80%, #9a6a3a 80%);
        border: 1px solid #d7f2ff;
        border-radius: 50%;
        box-shadow: 0 0 3px rgba(48, 209, 88, .7);
        box-sizing: border-box;
        display: inline-block;
        height: 8px;
        margin: 5px 6px 0 4px;
        width: 8px;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  };

  const postQuestRequirementsLayout = () => {
    const panel = document.getElementById('wtf-quest-requirements-panel');
    if (!panel) return;
    const layout = state.questRequirementsPanel;
    const rect = panel.getBoundingClientRect();
    if (!layout.collapsed && rect.width >= 260 && rect.height >= 120) {
      layout.width = rect.width;
      layout.height = rect.height;
    }
    window.chrome?.webview?.postMessage(JSON.stringify({
      action: 'quest-requirements-layout',
      mode: layout.mode,
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
      collapsed: layout.collapsed
    }));
  };

  const scheduleQuestRequirementsLayoutSave = () => {
    clearTimeout(wtfOverlayState.questRequirementsSaveTimer);
    wtfOverlayState.questRequirementsSaveTimer = setTimeout(postQuestRequirementsLayout, 180);
  };

  const applyQuestRequirementsPanelLayout = () => {
    const panel = document.getElementById('wtf-quest-requirements-panel');
    if (!panel) return;
    const layout = state.questRequirementsPanel;
    const mode = layout.mode;
    const topPanelRect = document.querySelector('.panel_top')?.getBoundingClientRect();
    const leftPanelRect = document.querySelector('.panel_left')?.getBoundingClientRect();
    const rightPanelRect = document.querySelector('.panel_right')?.getBoundingClientRect();
    const portrait = document.documentElement?.dataset.wtfLayout === 'portrait';
    const leftBoundary = portrait
      ? 10
      : leftPanelRect?.width > 0 ? leftPanelRect.right + 10 : 10;
    const rightBoundary = portrait
      ? window.innerWidth - 10
      : rightPanelRect?.width > 0 ? rightPanelRect.left - 10 : window.innerWidth - 10;
    const centerWidth = Math.max(260, rightBoundary - leftBoundary);
    const width = Math.min(layout.width, mode === 'bottom' ? centerWidth : Math.max(260, window.innerWidth - 20));
    const portraitPanelTop = Math.min(
      leftPanelRect?.height > 0 ? leftPanelRect.top : Number.POSITIVE_INFINITY,
      rightPanelRect?.height > 0 ? rightPanelRect.top : Number.POSITIVE_INFINITY
    );
    const dockTop = portrait && topPanelRect?.height > 0
      ? topPanelRect.bottom + 10
      : rightPanelRect?.height > 0 ? Math.max(10, rightPanelRect.top) : 72;
    const dockBottom = portrait && Number.isFinite(portraitPanelTop)
      ? Math.max(dockTop + 120, portraitPanelTop - 10)
      : window.innerHeight - 10;
    const height = Math.min(layout.height, Math.max(120, dockBottom - dockTop));

    panel.classList.toggle('wtf-collapsed', layout.collapsed);
    panel.dataset.mode = mode;
    panel.style.left = '';
    panel.style.right = '';
    panel.style.top = '';
    panel.style.bottom = '';
    panel.style.transform = '';
    panel.style.width = `${width}px`;
    panel.style.height = layout.collapsed ? 'auto' : `${height}px`;

    if (mode === 'bottom') {
      panel.style.left = `${leftBoundary + centerWidth / 2}px`;
      panel.style.bottom = portrait && Number.isFinite(portraitPanelTop)
        ? `${Math.max(10, window.innerHeight - portraitPanelTop + 10)}px`
        : '10px';
      panel.style.transform = 'translateX(-50%)';
    } else if (mode === 'floating') {
      const x = Math.min(Math.max(0, layout.x), Math.max(0, window.innerWidth - width));
      const y = Math.min(Math.max(0, layout.y), Math.max(0, window.innerHeight - (layout.collapsed ? 34 : height)));
      layout.x = x;
      layout.y = y;
      panel.style.left = `${x}px`;
      panel.style.top = `${y}px`;
    } else {
      panel.style.right = portrait
        ? '10px'
        : rightPanelRect?.width > 0
        ? `${Math.max(10, window.innerWidth - rightPanelRect.left + 10)}px`
        : '10px';
      panel.style.top = `${dockTop}px`;
    }

    panel.querySelector('[data-dock="right"]')?.classList.toggle('wtf-active', mode === 'right');
    panel.querySelector('[data-dock="bottom"]')?.classList.toggle('wtf-active', mode === 'bottom');
    const collapseButton = panel.querySelector('[data-action="collapse"]');
    if (collapseButton) {
      const collapseText = layout.collapsed ? '+' : '−';
      const collapseTitle = layout.collapsed ? questPanelCopy('expand') : questPanelCopy('collapse');
      if (collapseButton.textContent !== collapseText) collapseButton.textContent = collapseText;
      if (collapseButton.title !== collapseTitle) collapseButton.title = collapseTitle;
    }
  };

  const setQuestRequirementsDock = (mode) => {
    state.questRequirementsPanel.mode = mode;
    applyQuestRequirementsPanelLayout();
    scheduleQuestRequirementsLayoutSave();
  };

  const installQuestRequirementsDrag = (panel, header) => {
    header.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('button')) return;
      const rect = panel.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      state.questRequirementsPanel.mode = 'floating';
      state.questRequirementsPanel.x = rect.left;
      state.questRequirementsPanel.y = rect.top;
      applyQuestRequirementsPanelLayout();
      header.setPointerCapture(event.pointerId);

      const move = (moveEvent) => {
        const maxX = Math.max(0, window.innerWidth - panel.offsetWidth);
        const maxY = Math.max(0, window.innerHeight - panel.offsetHeight);
        state.questRequirementsPanel.x = Math.min(maxX, Math.max(0, moveEvent.clientX - offsetX));
        state.questRequirementsPanel.y = Math.min(maxY, Math.max(0, moveEvent.clientY - offsetY));
        panel.style.left = `${state.questRequirementsPanel.x}px`;
        panel.style.top = `${state.questRequirementsPanel.y}px`;
      };
      const finish = () => {
        header.removeEventListener('pointermove', move);
        header.removeEventListener('pointerup', finish);
        header.removeEventListener('pointercancel', finish);
        scheduleQuestRequirementsLayoutSave();
      };
      header.addEventListener('pointermove', move);
      header.addEventListener('pointerup', finish);
      header.addEventListener('pointercancel', finish);
    });
  };

  const ensureQuestRequirementsPanel = () => {
    let panel = document.getElementById('wtf-quest-requirements-panel');
    if (panel) return panel;

    panel = document.createElement('section');
    panel.id = 'wtf-quest-requirements-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', questPanelCopy('ariaLabel'));

    const header = document.createElement('div');
    header.className = 'wtf-quest-requirements-header';
    const title = document.createElement('div');
    title.className = 'wtf-quest-requirements-title';
    title.textContent = questPanelCopy('title', 0);

    const rightButton = document.createElement('button');
    rightButton.type = 'button';
    rightButton.className = 'wtf-quest-requirements-button';
    rightButton.dataset.dock = 'right';
    rightButton.textContent = 'R';
    rightButton.title = questPanelCopy('dockRight');
    rightButton.addEventListener('click', () => setQuestRequirementsDock('right'));

    const bottomButton = document.createElement('button');
    bottomButton.type = 'button';
    bottomButton.className = 'wtf-quest-requirements-button';
    bottomButton.dataset.dock = 'bottom';
    bottomButton.textContent = 'B';
    bottomButton.title = questPanelCopy('dockBottom');
    bottomButton.addEventListener('click', () => setQuestRequirementsDock('bottom'));

    const collapseButton = document.createElement('button');
    collapseButton.type = 'button';
    collapseButton.className = 'wtf-quest-requirements-button';
    collapseButton.dataset.action = 'collapse';
    collapseButton.addEventListener('click', () => {
      state.questRequirementsPanel.collapsed = !state.questRequirementsPanel.collapsed;
      applyQuestRequirementsPanelLayout();
      scheduleQuestRequirementsLayoutSave();
    });

    const body = document.createElement('div');
    body.className = 'wtf-quest-requirements-body';
    header.append(title, rightButton, bottomButton, collapseButton);
    panel.append(header, body);
    (document.body || document.documentElement).appendChild(panel);
    installQuestRequirementsDrag(panel, header);

    if (window.ResizeObserver) {
      wtfOverlayState.questRequirementsResizeObserver?.disconnect();
      wtfOverlayState.questRequirementsResizeObserver = new ResizeObserver(() => {
        if (!panel.hidden && !state.questRequirementsPanel.collapsed) {
          scheduleQuestRequirementsLayoutSave();
        }
      });
      wtfOverlayState.questRequirementsResizeObserver.observe(panel);
    }
    applyQuestRequirementsPanelLayout();
    return panel;
  };

  const ensureQuestRequirementsLoader = () => {
    let iframe = document.getElementById('wtf-quest-requirements-loader');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'wtf-quest-requirements-loader';
      iframe.tabIndex = -1;
      iframe.setAttribute('aria-hidden', 'true');
      (document.body || document.documentElement).appendChild(iframe);
    }
    return iframe;
  };

  const normalizeQuestStepText = (element) => {
    const preferred = element.querySelector('.step-text') || element.querySelector('.step-body') || element;
    return String(preferred.textContent || '').replace(/\s+/g, ' ').replace(/^•\s*/, '').trim();
  };

  const scrapeQuestRequirements = async (quest) => {
    const iframe = ensureQuestRequirementsLoader();
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Quest detail page timed out')), 20000);
      iframe.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      iframe.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Quest detail page failed to load'));
      };
      iframe.src = `${sitePathPrefix()}/progression/quests?quest=${encodeURIComponent(quest.id)}`;
    });

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const frameDocument = iframe.contentDocument;
      const objectivesRoot = frameDocument?.querySelector('.quest .objectives');
      if (objectivesRoot) {
        const headings = [...objectivesRoot.querySelectorAll('.title')];
        const getList = (labels) => {
          const acceptedLabels = new Set(labels.map((label) => label.toLocaleLowerCase()));
          const heading = headings.find((element) => acceptedLabels.has(element.textContent.trim().toLocaleLowerCase()));
          const list = heading?.nextElementSibling?.matches('ul')
            ? heading.nextElementSibling
            : heading?.parentElement?.querySelector('ul.list');
          return [...(list?.querySelectorAll(':scope > li') || [])]
            .map(normalizeQuestStepText)
            .filter(Boolean);
        };
        return {
          requirements: getList(['Requirements', 'Prerequisites', '요구 조건', '요구 사항', '선행 조건']),
          objectives: getList(['Objectives', 'Current objectives', '목표', '현재 목표'])
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Quest requirements were not found');
  };

  const loadQuestRequirements = (quest) => {
    if (wtfOverlayState.questRequirementsCache.has(quest.id)) {
      return Promise.resolve(wtfOverlayState.questRequirementsCache.get(quest.id));
    }
    if (wtfOverlayState.questRequirementsPending.has(quest.id)) {
      return wtfOverlayState.questRequirementsPending.get(quest.id);
    }

    const pending = wtfOverlayState.questRequirementsLoadChain
      .catch(() => undefined)
      .then(() => scrapeQuestRequirements(quest))
      .then((details) => {
        wtfOverlayState.questRequirementsCache.set(quest.id, details);
        return details;
      })
      .catch((error) => {
        const details = { error: error?.message || questPanelCopy('loadError') };
        wtfOverlayState.questRequirementsCache.set(quest.id, details);
        return details;
      })
      .finally(() => {
        wtfOverlayState.questRequirementsPending.delete(quest.id);
        renderQuestRequirementsPanel();
      });
    wtfOverlayState.questRequirementsPending.set(quest.id, pending);
    wtfOverlayState.questRequirementsLoadChain = pending;
    return pending;
  };

  const appendQuestRequirementsSection = (card, label, items, emptyText) => {
    const section = document.createElement('div');
    section.className = 'wtf-quest-requirements-section';
    const heading = document.createElement('div');
    heading.className = 'wtf-quest-requirements-label';
    heading.textContent = label;
    section.appendChild(heading);
    if (items.length) {
      const list = document.createElement('ul');
      list.className = 'wtf-quest-requirements-list';
      for (const item of items) {
        const row = document.createElement('li');
        row.textContent = item;
        list.appendChild(row);
      }
      section.appendChild(list);
    } else {
      const empty = document.createElement('div');
      empty.className = 'wtf-quest-requirements-status';
      empty.textContent = emptyText;
      section.appendChild(empty);
    }
    card.appendChild(section);
  };

  const renderQuestRequirementsPanel = () => {
    const panel = ensureQuestRequirementsPanel();
    const quests = wtfOverlayState.selectedQuests;
    panel.hidden = quests.length === 0;
    if (!quests.length) return;

    const title = panel.querySelector('.wtf-quest-requirements-title');
    const body = panel.querySelector('.wtf-quest-requirements-body');
    panel.setAttribute('aria-label', questPanelCopy('ariaLabel'));
    panel.querySelector('[data-dock="right"]')?.setAttribute('title', questPanelCopy('dockRight'));
    panel.querySelector('[data-dock="bottom"]')?.setAttribute('title', questPanelCopy('dockBottom'));
    title.textContent = questPanelCopy('title', quests.length);
    body.replaceChildren();

    for (const quest of quests) {
      const card = document.createElement('article');
      card.className = 'wtf-quest-requirements-card';
      const name = document.createElement('div');
      name.className = 'wtf-quest-requirements-name';
      name.textContent = formatQuestName(quest.name);
      card.appendChild(name);

      const details = wtfOverlayState.questRequirementsCache.get(quest.id);
      if (!details) {
        const loading = document.createElement('div');
        loading.className = 'wtf-quest-requirements-status';
        loading.textContent = questPanelCopy('loading');
        card.appendChild(loading);
        loadQuestRequirements(quest);
      } else if (details.error) {
        const error = document.createElement('div');
        error.className = 'wtf-quest-requirements-status';
        error.textContent = isKoreanQuestMode() ? questPanelCopy('loadError') : details.error;
        card.appendChild(error);
      } else {
        appendQuestRequirementsSection(
          card,
          questPanelCopy('prerequisites'),
          details.requirements || [],
          questPanelCopy('noPrerequisites'));
        appendQuestRequirementsSection(
          card,
          questPanelCopy('objectives'),
          details.objectives || [],
          questPanelCopy('noObjectives'));
      }
      body.appendChild(card);
    }
    applyQuestRequirementsPanelLayout();
  };

  const syncQuestRequirementsPanel = () => {
    const previousIdentityCache = wtfOverlayState.questIdentityCache;
    const nextIdentityCache = new Map(previousIdentityCache);
    const pinnedUidSignature = (cache) => [...wtfOverlayState.questPins.keys()]
      .sort()
      .map((key) => `${key}:${String(cache.get(key)?.id || '')}`)
      .join('|');
    const previousPinnedUidSignature = pinnedUidSignature(previousIdentityCache);

    // Native rows may briefly contain stale/localized identity data while the
    // Tarkov-Market store is hydrating. Merge them first, then let the live
    // marker store be authoritative. Compare only the final snapshots: comparing
    // each intermediate write made one key oscillate native -> live -> native on
    // every MutationObserver hydration and continuously rebuilt the marker layer.
    for (const row of document.querySelectorAll('div.items.scroll div.no-wrap.d-flex[data-quest-uid]')) {
      const name = getCanonicalQuestName(row);
      const key = normalizeQuestName(name);
      const id = row.dataset.questUid || '';
      if (key && id) {
        nextIdentityCache.set(key, { id, name });
      }
    }
    for (const marker of wtfOverlayState.quest.markers || []) {
      const name = resolveCanonicalQuestName(marker?.quest);
      const key = normalizeQuestName(name);
      const id = String(marker?.questId || '');
      if (!key || !id) continue;
      nextIdentityCache.set(key, { id, name });
    }

    wtfOverlayState.questIdentityCache = nextIdentityCache;
    const quests = [...nextIdentityCache.entries()]
      .filter(([key]) => wtfOverlayState.questPins.has(key))
      .map(([, quest]) => quest);
    const key = quests.map((quest) => `${quest.id}:${quest.name}`).join('|');
    if (previousPinnedUidSignature !== pinnedUidSignature(nextIdentityCache)) renderQuestMarkers();
    if (key === wtfOverlayState.questSelectionKey) return;
    wtfOverlayState.questSelectionKey = key;
    wtfOverlayState.selectedQuests = quests;
    renderQuestRequirementsPanel();
  };

  const getQuestNameElement = (row) => {
    for (const child of row?.children || []) {
      if (child.tagName === 'SPAN' && !child.classList.contains('alt')) return child;
    }
    return row?.querySelector?.('span:not(.alt)') || null;
  };

  // Pin keys stay the English quest name even when the site shows another
  // language: rows carry data-quest-uid and the live store maps uid -> name.
  const getCanonicalQuestName = (row) => {
    const uid = String(row?.dataset?.questUid || '');
    const english = uid ? wtfOverlayState.questEnglishNamesByUid.get(uid) : '';
    if (english) return english;
    const nameElement = getQuestNameElement(row);
    return resolveCanonicalQuestName(nameElement?.textContent || '');
  };

  const normalizeQuestName = (value) => String(value || '')
    .normalize('NFKC')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const resolveCanonicalQuestName = (value) => {
    const source = String(value || '').replace(/\s+/g, ' ').trim();
    if (!source) return '';
    const known = wtfOverlayState.questEnglishNamesByAnyName.get(normalizeQuestName(source));
    if (known) return known;
    // Pins saved by older builds may carry the "Korean(English)" display form.
    const englishSuffix = source.match(/\(([^()]*)\)\s*$/)?.[1]?.trim() || '';
    return wtfOverlayState.questEnglishNamesByAnyName.get(normalizeQuestName(englishSuffix)) || source;
  };

  const rememberLiveQuestNames = (quests) => {
    const byUid = new Map();
    const byAnyName = new Map();
    const localizedNames = new Map();
    for (const quest of quests) {
      const english = questDisplayNameFromLiveData(quest);
      if (!english) continue;
      const localized = localizedLiveText(english, quest?.name_l10n);
      if (quest?.uid) byUid.set(String(quest.uid), english);
      byAnyName.set(normalizeQuestName(english), english);
      if (localized) byAnyName.set(normalizeQuestName(localized), english);
      localizedNames.set(normalizeQuestName(english), localized);
    }
    wtfOverlayState.questEnglishNamesByUid = byUid;
    wtfOverlayState.questEnglishNamesByAnyName = byAnyName;
    wtfOverlayState.questLocalizedNames = localizedNames;
  };

  const migrateQuestPinsToCanonicalNames = () => {
    const pinnedNames = [...wtfOverlayState.questPins.values()];
    wtfOverlayState.questPins.clear();
    for (const pinnedName of pinnedNames) {
      const canonical = resolveCanonicalQuestName(pinnedName);
      const key = normalizeQuestName(canonical);
      if (key) wtfOverlayState.questPins.set(key, canonical);
    }
  };

  const unwrapReactiveValue = (value) => (
    value && typeof value === 'object' && 'value' in value ? value.value : value
  );

  const projectLiveQuestMarker = (mapSlug, x, y, allowOutside = false) => {
    const definition = tarkovMarketMapDefinitions[String(mapSlug || '').toLowerCase()];
    x = Number(x);
    y = Number(y);
    if (!definition || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    const radians = -definition.rotate * (Math.PI / 180);
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const rotatedX = Math.round(((x * cosine) - (y * sine)) * 10000) / 10000;
    const rotatedY = Math.round(((x * sine) + (y * cosine)) * 10000) / 10000;
    const mapX = Math.round((definition.xOffset - (rotatedX * definition.ratio)) * 10000) / 10000;
    const mapY = Math.round((definition.yOffset - (rotatedY * definition.ratio)) * 10000) / 10000;
    const left = (mapX / definition.width) * 100;
    const top = (mapY / definition.height) * 100;
    if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
    if (!allowOutside && (left < 0 || left > 100 || top < 0 || top > 100)) return null;
    return { left, top };
  };

  const questDisplayNameFromLiveData = (quest) => String(
    quest?.name || quest?.name_en || quest?.shortName || quest?.uid || ''
  ).replace(/\s+/g, ' ').trim();

  const liveQuestMarkerColor = (markerData) => {
    // Built-in walkthrough rings use the green quest markers show on other maps.
    if (markerData.builtInStep) return '#70a800';
    if (markerData.storyline) return '#8598a6';
    if (markerData.requiredForKappa) return '#70a800';
    return '#a87b00';
  };

  const getPinnedQuestUids = () => {
    const result = new Set();
    for (const [key, identity] of wtfOverlayState.questIdentityCache.entries()) {
      if (wtfOverlayState.questPins.has(key) && identity?.id) result.add(String(identity.id));
    }
    return result;
  };

  const createLiveQuestSnapshot = (source, mapSlug) => {
    const allMarkers = unwrapReactiveValue(source?.allMarkers)
      || unwrapReactiveValue(source?.state)?.allMarkers
      || [];
    const quests = unwrapReactiveValue(source?.quests)
      || unwrapReactiveValue(source?.state)?.quests
      || [];
    if (!Array.isArray(allMarkers) || !Array.isArray(quests)) {
      throw new Error('The live Tarkov-Market quest store returned an unexpected shape.');
    }
    const questsByUid = new Map(quests.map((quest) => [String(quest?.uid || ''), quest]));
    const markers = [];
    for (const marker of allMarkers) {
      if (String(marker?.map || '').toLowerCase() !== mapSlug
        || marker?.category !== 'Quests'
        || marker?.subCategory !== 'Quest'
        || !marker?.questUid
        || !marker?.geometry) continue;
      const quest = questsByUid.get(String(marker.questUid));
      const questName = questDisplayNameFromLiveData(quest);
      const common = {
        markerUid: String(marker.uid || ''),
        questId: String(marker.questUid),
        quest: questName,
        objective: marker.name
          ? localizedLiveText(marker.name, marker.name_l10n)
          : localizedLiveText(marker.desc, marker.desc_l10n),
        questStepUids: Array.isArray(marker.questStepUids) ? [...marker.questStepUids] : [],
        level: marker.level === null || marker.level === undefined ? null : Number(marker.level),
        storyline: quest?.type === 'Storyline',
        requiredForKappa: Boolean(quest?.requiredForKappa)
      };
      const polygon = Array.isArray(marker.geometry.points)
        ? marker.geometry.points
          .map((coordinate) => Array.isArray(coordinate) && coordinate.length >= 2
            ? projectLiveQuestMarker(mapSlug, coordinate[0], coordinate[1], true)
            : null)
          .filter(Boolean)
        : [];
      if (polygon.length >= 3) {
        markers.push({ ...common, kind: 'zone', points: polygon });
        continue;
      }
      const point = projectLiveQuestMarker(mapSlug, marker.geometry.x, marker.geometry.y);
      if (!point) continue;
      markers.push({ ...common, kind: 'point', left: point.left, top: point.top });
    }
    const builtIn = builtInQuestSteps[mapSlug];
    if (builtIn) {
      const builtInKey = normalizeQuestName(builtIn.quest);
      const quest = quests.find((candidate) => normalizeQuestName(questDisplayNameFromLiveData(candidate)) === builtInKey
        || normalizeQuestName(candidate?.name_en) === builtInKey);
      wtfOverlayState.builtInQuestUid = String(quest?.uid || '');
      builtIn.steps.forEach((step, index) => {
        const point = projectLiveQuestMarker(mapSlug, step.x, step.y);
        if (!point) return;
        markers.push({
          markerUid: '',
          questId: String(quest?.uid || ''),
          quest: quest ? questDisplayNameFromLiveData(quest) : builtIn.quest,
          objective: localizedLiveText(step.en, { kr: step.kr, ko: step.kr }),
          questStepUids: [],
          level: null,
          storyline: quest ? quest.type === 'Storyline' : true,
          requiredForKappa: Boolean(quest?.requiredForKappa),
          kind: 'point',
          step: index + 1,
          builtInStep: step,
          wiki: builtIn.wiki,
          left: point.left,
          top: point.top
        });
      });
    }
    rememberLiveQuestNames(quests);
    return { map: mapSlug, markers, questCount: quests.length };
  };

  const discoverTarkovMarketQuestStore = async () => {
    if (window.__wtfQuestLiveSource) {
      const source = typeof window.__wtfQuestLiveSource === 'function'
        ? await window.__wtfQuestLiveSource()
        : window.__wtfQuestLiveSource;
      return { source, label: 'test-live-store' };
    }
    const moduleUrls = [...document.querySelectorAll('script[src]')]
      .map((script) => script.src)
      .filter((url) => {
        try {
          const parsed = new URL(url, location.href);
          return parsed.origin === location.origin
            && parsed.pathname.includes('/_nuxt')
            && parsed.pathname.endsWith('.js');
        } catch {
          return false;
        }
      });
    const queue = [...new Set(moduleUrls)];
    const visited = new Set();
    while (queue.length && visited.size < 80) {
      const moduleUrl = queue.shift();
      if (!moduleUrl || visited.has(moduleUrl)) continue;
      visited.add(moduleUrl);
      const response = await fetch(moduleUrl, { credentials: 'same-origin' });
      if (!response.ok) continue;
      const moduleText = await response.text();
      if (moduleText.includes('fetchAllMarkers')
        && moduleText.includes('questsAllMarkersMap')
        && moduleText.includes('waitForQuestsDataLoaded')) {
        const module = await import(moduleUrl);
        const factory = Object.values(module).find((candidate) => {
          if (typeof candidate !== 'function') return false;
          const source = Function.prototype.toString.call(candidate);
          return source.includes('fetchAllMarkers')
            && source.includes('questsAllMarkersMap')
            && source.includes('waitForQuestsDataLoaded');
        });
        if (factory) {
          const source = factory();
          if (typeof source?.fetchQuests === 'function') await source.fetchQuests();
          if (typeof source?.fetchAllMarkers === 'function') await source.fetchAllMarkers();
          return { source, label: 'tarkov-market-live-store' };
        }
      }
      for (const match of moduleText.matchAll(/["'](\.\/[^"']+\.js)["']/g)) {
        const dependencyUrl = new URL(match[1], moduleUrl).href;
        if (!visited.has(dependencyUrl) && !queue.includes(dependencyUrl)) queue.push(dependencyUrl);
      }
    }
    throw new Error('Unable to locate the Tarkov-Market quest store module.');
  };

  const reportLiveQuestStatus = (status, extra = {}) => {
    window.chrome?.webview?.postMessage(JSON.stringify({
      action: 'quest-overlay-status',
      status,
      source: wtfOverlayState.liveQuestSource,
      map: wtfOverlayState.quest.map,
      markerCount: wtfOverlayState.quest.markers.length,
      ...extra
    }));
  };

  const loadLiveQuestMarkers = async () => {
    if (wtfOverlayState.liveQuestLoadPromise) return wtfOverlayState.liveQuestLoadPromise;
    wtfOverlayState.liveQuestLoadPromise = (async () => {
      try {
        const mapSlug = String(wtfOverlayState.quest.map || '').toLowerCase();
        if (!tarkovMarketMapDefinitions[mapSlug]) {
          wtfOverlayState.liveQuestSource = 'unsupported-map';
          wtfOverlayState.quest.markers = [];
          renderQuestMarkers();
          return;
        }
        const discovered = wtfOverlayState.liveQuestStore
          ? { source: wtfOverlayState.liveQuestStore, label: wtfOverlayState.liveQuestSource }
          : await discoverTarkovMarketQuestStore();
        wtfOverlayState.liveQuestStore = discovered.source;
        wtfOverlayState.liveQuestSource = discovered.label;
        const snapshot = createLiveQuestSnapshot(discovered.source, mapSlug);
        if (!snapshot.markers.length) throw new Error(`No live quest markers were returned for ${mapSlug}.`);
        wtfOverlayState.quest = snapshot;
        wtfOverlayState.liveQuestError = '';
        migrateQuestPinsToCanonicalNames();
        addNativeQuestCheckboxes();
        syncQuestRequirementsPanel();
        renderQuestMarkers();
        reportLiveQuestStatus('ready', { questCount: snapshot.questCount });
      } catch (error) {
        wtfOverlayState.liveQuestError = String(error?.message || error);
        wtfOverlayState.liveQuestSource = 'load-failed';
        reportLiveQuestStatus('error', { error: wtfOverlayState.liveQuestError });
        clearTimeout(wtfOverlayState.liveQuestRetryTimer);
        wtfOverlayState.liveQuestRetryTimer = window.setTimeout(() => {
          wtfOverlayState.liveQuestLoadPromise = null;
          loadLiveQuestMarkers();
        }, 2000);
      } finally {
        if (wtfOverlayState.liveQuestSource !== 'load-failed') {
          wtfOverlayState.liveQuestLoadPromise = null;
        }
      }
    })();
    return wtfOverlayState.liveQuestLoadPromise;
  };

  const syncNativeQuestCheckbox = (row, checkbox) => {
    const questName = getCanonicalQuestName(row);
    const selected = wtfOverlayState.questPins.has(normalizeQuestName(questName));
    checkbox.checked = selected;
    checkbox.disabled = false;
    checkbox.setAttribute('aria-checked', selected ? 'true' : 'false');
    row.dataset.wtfPinned = selected ? 'true' : 'false';
  };

  const toggleNativeQuestSelection = (row, checkbox) => {
    const desired = checkbox.checked;
    const questName = getCanonicalQuestName(row);
    const key = normalizeQuestName(questName);
    const selected = wtfOverlayState.questPins.has(key);
    if (desired === selected) return;

    if (desired) wtfOverlayState.questPins.set(key, questName);
    else wtfOverlayState.questPins.delete(key);
    if (desired) forceNativeQuestFilterOff();
    syncNativeQuestCheckbox(row, checkbox);
    syncQuestRequirementsPanel();
    renderQuestMarkers();
    window.chrome?.webview?.postMessage(JSON.stringify({
      action: 'quest-toggled',
      questName,
      isSelected: desired
    }));
  };

  // The site lists no Terminal quest for our built-in steps (The Ticket), so the
  // quest list gets one row of its own, shaped like the site's rows, to pin it.
  const ensureBuiltInQuestRow = () => {
    const builtIn = builtInQuestSteps[String(wtfOverlayState.quest.map || '').toLowerCase()];
    const existing = document.querySelector('[data-wtf-built-in-quest]');
    const nativeRow = document.querySelector('div.items.scroll div.no-wrap.d-flex[data-quest-uid]:not([data-wtf-built-in-quest])');
    // An empty list (the default Story filter on Terminal) has no site row to
    // find it by, so fall back to the quest tool's own list.
    if (nativeRow) wtfOverlayState.questListContainer = nativeRow.parentElement;
    else if (!wtfOverlayState.questListContainer?.isConnected) {
      wtfOverlayState.questListContainer = document.querySelector('.panel_right .tools_quests div.items.scroll') || null;
    }
    const container = wtfOverlayState.questListContainer?.isConnected ? wtfOverlayState.questListContainer : null;
    if (!builtIn || !container) {
      if (existing && !builtIn) existing.remove();
      return;
    }
    const uid = String(wtfOverlayState.builtInQuestUid || '');
    let row = existing;
    if (!row || row.parentElement !== container || row.dataset.questUid !== uid) {
      row?.remove();
      row = document.createElement('div');
      row.className = nativeRow?.className || 'no-wrap d-flex';
      row.dataset.wtfBuiltInQuest = builtIn.quest;
      row.dataset.questUid = uid;
      const name = document.createElement('span');
      row.appendChild(name);
      container.prepend(row);
    }
    const name = getQuestNameElement(row);
    const label = formatQuestName(builtIn.quest);
    if (name && name.textContent !== label) name.textContent = label;
  };

  const addNativeQuestCheckboxes = () => {
    ensureBuiltInQuestRow();
    const rows = document.querySelectorAll('div.items.scroll div.no-wrap.d-flex[data-quest-uid]');
    for (const row of rows) {
      const nameElement = getQuestNameElement(row);
      if (!nameElement) continue;
      const questName = getCanonicalQuestName(row);

      let checkbox = row.querySelector(':scope > .wtf-quest-pin');
      if (!checkbox) {
        checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'wtf-quest-pin';
        checkbox.dataset.questId = row.dataset.questUid || '';
        checkbox.title = 'Select quest markers';
        checkbox.setAttribute('aria-label', 'Select ' + questName + ' markers');

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

      if (!row.dataset.wtfQuestContextListener) {
        row.dataset.wtfQuestContextListener = 'true';
        row.addEventListener('contextmenu', (event) => {
          if (event.target instanceof Element && event.target.closest('.wtf-quest-pin')) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          checkbox.checked = !wtfOverlayState.questPins.has(normalizeQuestName(getCanonicalQuestName(row)));
          toggleNativeQuestSelection(row, checkbox);
        }, true);
      }

      syncNativeQuestCheckbox(row, checkbox);
    }
  };

  const pingCopy = (english, korean) => state.language.startsWith('ko') ? korean : english;

  const setPingsVisible = (visible, notifyHost) => {
    wtfOverlayState.pingsVisible = Boolean(visible);
    if (wtfOverlayState.pingLayer) wtfOverlayState.pingLayer.hidden = !wtfOverlayState.pingsVisible;
    const control = document.getElementById('wtf-ping-control');
    control?.classList.toggle('active', wtfOverlayState.pingsVisible);
    control?.classList.toggle('inactive', !wtfOverlayState.pingsVisible);
    control?.classList.toggle('selected', wtfOverlayState.pingsVisible);
    control?.setAttribute('aria-checked', String(wtfOverlayState.pingsVisible));
    if (notifyHost) {
      window.chrome?.webview?.postMessage(JSON.stringify({
        action: 'map-pings-toggle', checked: wtfOverlayState.pingsVisible
      }));
    }
  };

  const ensurePingControl = () => {
    const leftPanel = document.querySelector('.panel_left');
    if (!leftPanel) return;
    let items = null;
    let scopeSource = null;

    const columns = leftPanel.querySelector('.two-columns');
    if (!columns) return;
    const titles = [...columns.querySelectorAll(':scope > .mb-5 > div:first-child > .bold')];
    const title = titles.find(element => /^(?:visibility|가시성)$/i.test(element.textContent.trim()));
    items = title?.parentElement?.nextElementSibling || null;
    scopeSource = items?.firstElementChild || title;
    if (!items?.classList.contains('items')) {
      let group = columns.querySelector(':scope > .wtf-ping-filter-group');
      if (!group) {
        group = document.createElement('div');
        group.className = 'mb-5 wtf-ping-filter-group';
        const headingRow = document.createElement('div');
        const heading = document.createElement('span');
        heading.className = 'bold';
        heading.textContent = pingCopy('Visibility', '가시성');
        headingRow.appendChild(heading);
        items = document.createElement('div');
        items.className = 'items';
        group.append(headingRow, items);
        columns.appendChild(group);
      } else {
        items = group.querySelector('.items');
      }
      scopeSource = titles[0] || columns.firstElementChild;
    }
    if (!items) return;

    const scopeAttributes = [...(scopeSource?.attributes || [])]
      .filter(attribute => attribute.name.startsWith('data-v-'))
      .map(attribute => attribute.name);
    const applyScope = (element) => {
      for (const attribute of scopeAttributes) element.setAttribute(attribute, '');
      return element;
    };
    let control = document.getElementById('wtf-ping-control');
    if (!control || control.parentElement !== items) {
      control?.remove();
      control = applyScope(document.createElement('div'));
      control.id = 'wtf-ping-control';
      control.className = 'd-flex h-space-between mb-5 no-wrap inactive';
      control.tabIndex = 0;
      control.setAttribute('role', 'checkbox');
      control.title = pingCopy(
        'Alt + click to add a ping; repeat near a ping to delete it',
        'Alt + 좌클릭으로 핑 추가 · 핑 근처에서 반복하면 삭제'
      );
      const toggle = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setPingsVisible(!wtfOverlayState.pingsVisible, true);
      };
      control.addEventListener('click', toggle);
      control.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') toggle(event);
      });
      const label = applyScope(document.createElement('span'));
      label.className = 'd-flex';
      const icon = document.createElement('span');
      icon.className = 'wtf-ping-dot';
      label.append(icon, document.createTextNode(` ${pingCopy('Pings', '핑')}`));
      const count = applyScope(document.createElement('span'));
      count.className = 'sub alt';
      count.dataset.wtfPingCount = '';
      control.append(label, count);
      items.appendChild(control);
    }
    const count = control.querySelector('[data-wtf-ping-count]');
    const countText = String(wtfOverlayState.pings.pings?.length || 0);
    if (count && count.textContent !== countText) count.textContent = countText;
    setPingsVisible(wtfOverlayState.pingsVisible, false);
  };

  const setRouteVisible = (visible, notifyHost) => {
    wtfOverlayState.routeVisible = Boolean(visible);
    if (wtfOverlayState.routeLayer) wtfOverlayState.routeLayer.hidden = !wtfOverlayState.routeVisible;
    const control = document.getElementById('wtf-route-control');
    control?.classList.toggle('active', wtfOverlayState.routeVisible);
    control?.classList.toggle('inactive', !wtfOverlayState.routeVisible);
    control?.classList.toggle('selected', wtfOverlayState.routeVisible);
    control?.setAttribute('aria-checked', String(wtfOverlayState.routeVisible));
    if (notifyHost) {
      window.chrome?.webview?.postMessage(JSON.stringify({
        action: 'map-route-toggle', checked: wtfOverlayState.routeVisible
      }));
    }
  };

  const ensureRouteControl = () => {
    ensurePingControl();
    const pingControl = document.getElementById('wtf-ping-control');
    const items = pingControl?.parentElement;
    if (!pingControl || !items) return;
    let control = document.getElementById('wtf-route-control');
    if (!control || control.parentElement !== items) {
      control?.remove();
      control = document.createElement('div');
      control.id = 'wtf-route-control';
      control.className = pingControl.className;
      control.tabIndex = 0;
      control.setAttribute('role', 'checkbox');
      control.title = pingCopy(
        'Wheel-click to add a node; repeat near a node to delete it',
        '휠 클릭으로 노드 추가 · 노드 근처에서 반복하면 삭제'
      );
      for (const attribute of pingControl.attributes) {
        if (attribute.name.startsWith('data-v-')) control.setAttribute(attribute.name, '');
      }
      const toggle = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setRouteVisible(!wtfOverlayState.routeVisible, true);
      };
      control.addEventListener('click', toggle);
      control.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') toggle(event);
      });
      const label = document.createElement('span');
      label.className = 'd-flex';
      const icon = document.createElement('span');
      icon.className = 'wtf-route-dot';
      label.append(icon, document.createTextNode(` ${pingCopy('Route', '경로')}`));
      const count = document.createElement('span');
      count.className = 'sub alt';
      count.dataset.wtfRouteCount = '';
      for (const attribute of pingControl.attributes) {
        if (!attribute.name.startsWith('data-v-')) continue;
        label.setAttribute(attribute.name, '');
        count.setAttribute(attribute.name, '');
      }
      control.append(label, count);
      pingControl.after(control);
    }
    const count = control.querySelector('[data-wtf-route-count]');
    const countText = `${wtfOverlayState.route.localNodeCount || 0}/${wtfOverlayState.route.maxNodes || 40}`;
    if (count && count.textContent !== countText) count.textContent = countText;
    setRouteVisible(wtfOverlayState.routeVisible, false);
  };

  // "Delete all" removes only what this player placed (no creatorId).
  const ownPingCount = () => (wtfOverlayState.pings.pings || []).filter((ping) => !ping.creatorId).length;
  const ownRouteNodeCount = () => (wtfOverlayState.route.nodes || []).filter((node) => !node.creatorId).length;

  const ensureClearPingsButton = () => {
    const topPanel = document.querySelector('.panel_top');
    if (!topPanel) return;
    const buttonHost = topPanel.querySelector('.map-toolbar') || topPanel;
    let button = document.getElementById('wtf-clear-pings-button');
    if (!button || button.parentElement !== buttonHost) {
      button?.remove();
      button = document.createElement('button');
      button.id = 'wtf-clear-pings-button';
      button.type = 'button';
      const nativeButton = topPanel.querySelector('.primary-tools > button:not(.pro)') || topPanel.querySelector('button');
      if (nativeButton) {
        button.className = nativeButton.className;
        button.classList.remove('active', 'toolbar-icon');
        for (const attribute of nativeButton.attributes) {
          if (attribute.name.startsWith('data-v-')) button.setAttribute(attribute.name, '');
        }
      }
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (!ownPingCount()) return;
        const confirmed = window.confirm(pingCopy(
          'Delete all of your pings on this map?',
          '이 지도에 내가 찍은 핑을 전부 삭제할까요?'
        ));
        if (confirmed) window.chrome?.webview?.postMessage(JSON.stringify({ action: 'map-pings-clear' }));
      });
      buttonHost.appendChild(button);
    }
    if (buttonHost.matches('.map-toolbar') && !button.previousElementSibling?.matches('.wtf-toolbar-break')) {
      const lineBreak = buttonHost.querySelector(':scope > .wtf-toolbar-break') || document.createElement('span');
      lineBreak.className = 'wtf-toolbar-break';
      lineBreak.setAttribute('aria-hidden', 'true');
      button.before(lineBreak);
    }
    const buttonText = pingCopy('Delete all pings', '핑 전부 삭제');
    if (button.textContent !== buttonText) button.textContent = buttonText;
    button.disabled = !ownPingCount();
  };

  const ensureClearRouteButton = () => {
    const topPanel = document.querySelector('.panel_top');
    if (!topPanel) return;
    const buttonHost = topPanel.querySelector('.map-toolbar') || topPanel;
    let button = document.getElementById('wtf-clear-route-button');
    if (!button || button.parentElement !== buttonHost) {
      button?.remove();
      button = document.createElement('button');
      button.id = 'wtf-clear-route-button';
      button.type = 'button';
      const nativeButton = topPanel.querySelector('.primary-tools > button:not(.pro)') || topPanel.querySelector('button');
      if (nativeButton) {
        button.className = nativeButton.className;
        button.classList.remove('active', 'toolbar-icon');
        for (const attribute of nativeButton.attributes) {
          if (attribute.name.startsWith('data-v-')) button.setAttribute(attribute.name, '');
        }
      }
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (!ownRouteNodeCount()) return;
        const confirmed = window.confirm(pingCopy(
          'Delete all of your route nodes on this map?',
          '이 지도에 내가 놓은 경로 노드를 전부 삭제할까요?'
        ));
        if (confirmed) {
          window.chrome?.webview?.postMessage(JSON.stringify({ action: 'map-route-nodes-clear' }));
        }
      });
      const pingButton = document.getElementById('wtf-clear-pings-button');
      if (pingButton?.parentElement === buttonHost) pingButton.after(button);
      else buttonHost.appendChild(button);
    }
    const buttonText = pingCopy('Delete all route nodes', '경로 전부 삭제');
    if (button.textContent !== buttonText) button.textContent = buttonText;
    button.disabled = !ownRouteNodeCount();
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

  const parseMapTransform = (transform) => {
    if (!transform || transform === 'none') return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const Matrix = window.DOMMatrixReadOnly || window.DOMMatrix || window.WebKitCSSMatrix;
    if (typeof Matrix === 'function') {
      try { return new Matrix(transform); } catch (_) { }
    }
    const matrix2d = transform.match(/^matrix\(\s*([^)]*)\)$/i);
    if (matrix2d) {
      const values = matrix2d[1].split(',').map(value => Number.parseFloat(value.trim()));
      if (values.length === 6 && values.every(Number.isFinite)) {
        return { a: values[0], b: values[1], c: values[2], d: values[3], e: values[4], f: values[5] };
      }
    }
    const matrix3d = transform.match(/^matrix3d\(\s*([^)]*)\)$/i);
    if (matrix3d) {
      const values = matrix3d[1].split(',').map(value => Number.parseFloat(value.trim()));
      if (values.length === 16 && values.every(Number.isFinite)) {
        return { a: values[0], b: values[1], c: values[4], d: values[5], e: values[12], f: values[13] };
      }
    }
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  };

  const mapSceneTransformInfo = (mapWrap) => {
    const scene = mapWrap?.querySelector('.map-scene');
    if (!scene) return null;
    const computed = getComputedStyle(scene);
    const originParts = computed.transformOrigin.split(/\s+/);
    return {
      element: scene,
      matrix: parseMapTransform(computed.transform),
      originX: Number.parseFloat(originParts[0]) || 0,
      originY: Number.parseFloat(originParts[1]) || 0,
      layout: getLayoutOffset(scene, mapWrap),
      width: scene.offsetWidth || Number.parseFloat(computed.width) || 0,
      height: scene.offsetHeight || Number.parseFloat(computed.height) || 0
    };
  };

  const transformPoint = (x, y, transform) => {
    const relativeX = x - transform.originX;
    const relativeY = y - transform.originY;
    return {
      x: transform.layout.left + transform.originX
        + (transform.matrix.a * relativeX) + (transform.matrix.c * relativeY) + transform.matrix.e,
      y: transform.layout.top + transform.originY
        + (transform.matrix.b * relativeX) + (transform.matrix.d * relativeY) + transform.matrix.f
    };
  };

  const inverseTransformPoint = (x, y, transform) => {
    const determinant = (transform.matrix.a * transform.matrix.d)
      - (transform.matrix.b * transform.matrix.c);
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-8) return null;
    const mappedX = x - transform.layout.left - transform.originX - transform.matrix.e;
    const mappedY = y - transform.layout.top - transform.originY - transform.matrix.f;
    return {
      x: ((transform.matrix.d * mappedX) - (transform.matrix.c * mappedY)) / determinant
        + transform.originX,
      y: ((-transform.matrix.b * mappedX) + (transform.matrix.a * mappedY)) / determinant
        + transform.originY
    };
  };

  const applyNativePopupScope = (element) => {
    element.setAttribute('data-v-6c75efb4', '');
    return element;
  };

  // Site popups are placed at the marker's unrotated screen point; on Terminal
  // move them to where the tilted canvas actually draws that marker.
  const setNativePopupTilt = (popup) => {
    const radians = mapTiltRadians();
    let dx = 0;
    let dy = 0;
    const container = document.querySelector('.map-cont');
    const layer = popup.offsetParent || popup.parentElement;
    if (radians && container && layer && !popup.dataset.wtfBuiltInStep) {
      const x = Number.parseFloat(popup.style.left);
      const y = Number.parseFloat(popup.style.top);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        const containerRect = container.getBoundingClientRect();
        const layerRect = layer.getBoundingClientRect();
        const cx = containerRect.left + containerRect.width / 2 - layerRect.left;
        const cy = containerRect.top + containerRect.height / 2 - layerRect.top;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        dx = cx + ((x - cx) * cos) - ((y - cy) * sin) - x;
        dy = cy + ((x - cx) * sin) + ((y - cy) * cos) - y;
      }
    }
    for (const [key, value] of [['--wtf-popup-tilt-x', dx], ['--wtf-popup-tilt-y', dy]]) {
      const text = `${Math.round(value * 100) / 100}px`;
      if (popup.style.getPropertyValue(key) !== text) popup.style.setProperty(key, text);
    }
  };

  // The site anchors its compass to a map point in unrotated screen space; on
  // Terminal move it with the tilt and turn the rose by the same angle.
  const updateCompassTilt = () => {
    const radians = mapTiltRadians();
    const root = document.documentElement;
    const angle = `${Math.round(radians * 180 / Math.PI * 1000) / 1000}deg`;
    if (root.style.getPropertyValue('--wtf-map-tilt') !== angle) root.style.setProperty('--wtf-map-tilt', angle);
    const anchor = document.querySelector('.map-compass-anchor');
    const container = document.querySelector('.map-cont');
    if (!anchor || !container) return;
    let dx = 0;
    let dy = 0;
    const x = Number.parseFloat(anchor.style.left);
    const y = Number.parseFloat(anchor.style.top);
    const layer = anchor.offsetParent || anchor.parentElement;
    if (radians && layer && Number.isFinite(x) && Number.isFinite(y)) {
      const containerRect = container.getBoundingClientRect();
      const layerRect = layer.getBoundingClientRect();
      const cx = containerRect.left + containerRect.width / 2 - layerRect.left;
      const cy = containerRect.top + containerRect.height / 2 - layerRect.top;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      dx = cx + ((x - cx) * cos) - ((y - cy) * sin) - x;
      dy = cy + ((x - cx) * sin) + ((y - cy) * cos) - y;
    }
    for (const [key, value] of [['--wtf-compass-tilt-x', dx], ['--wtf-compass-tilt-y', dy]]) {
      const text = `${Math.round(value * 100) / 100}px`;
      if (anchor.style.getPropertyValue(key) !== text) anchor.style.setProperty(key, text);
    }
  };

  const nativePopupLayouts = new Map();
  const nativePopupFitMs = 700;
  let nativePopupLayoutFrame = 0;
  const fitNativeQuestPopups = () => {
    nativePopupLayoutFrame = 0;
    const margin = 8;
    const toolbar = document.querySelector('.panel_top')?.getBoundingClientRect();
    const top = Math.min(Math.max(margin, (toolbar?.bottom || 0) + margin), Math.max(margin, window.innerHeight - 80));
    for (const [popup, entry] of nativePopupLayouts) {
      if (!popup.isConnected || popup.classList.contains('mobile')) {
        entry.resize?.disconnect();
        entry.mutation.disconnect();
        nativePopupLayouts.delete(popup);
        for (const suffix of ['max-width', 'max-height', 'shift-x', 'shift-y']) popup.style.removeProperty(`--wtf-popup-${suffix}`);
        continue;
      }
      if (!popup.getClientRects().length) continue;
      setNativePopupTilt(popup);
      const rect = popup.getBoundingClientRect();
      // Popup layer is outside the rotating/scaling map scene. Account for
      // CSS zoom, without touching the native marker anchor or transform.
      const sx = popup.offsetWidth ? rect.width / popup.offsetWidth : 1;
      const sy = popup.offsetHeight ? rect.height / popup.offsetHeight : 1;
      const set = (key, value) => {
        const text = `${Math.round(value * 100) / 100}px`;
        if (popup.style.getPropertyValue(key) !== text) popup.style.setProperty(key, text);
      };
      set('--wtf-popup-max-width', Math.max(1, window.innerWidth - margin * 2) / sx);
      set('--wtf-popup-max-height', Math.max(1, window.innerHeight - top - margin) / sy);
      // Fit the popup on screen only while it opens (the site's own open move
      // takes 0.4 s); after that it stays put on its marker and moves with the
      // map instead of chasing the screen edges.
      // A popup element the site reuses for another marker opens again, so it
      // gets its own fit instead of keeping the last marker's shift.
      const opened = [...popup.querySelectorAll('.title')].map((node) => node.textContent).join('\n');
      if (entry.opened !== opened) {
        entry.opened = opened;
        entry.openedAt = performance.now();
      }
      if (performance.now() - entry.openedAt > nativePopupFitMs) {
        entry.style = popup.getAttribute('style');
        continue;
      }
      const sized = popup.getBoundingClientRect();
      const baseX = sized.left - entry.x * sx;
      const baseY = sized.top - entry.y * sy;
      const x = Math.min(Math.max(baseX, margin), Math.max(margin, window.innerWidth - margin - sized.width));
      const y = Math.min(Math.max(baseY, top), Math.max(top, window.innerHeight - margin - sized.height));
      entry.x = Math.round((x - baseX) / sx * 100) / 100;
      entry.y = Math.round((y - baseY) / sy * 100) / 100;
      set('--wtf-popup-shift-x', entry.x);
      set('--wtf-popup-shift-y', entry.y);
      // Ignore our own style mutations, otherwise this becomes an idle loop.
      entry.style = popup.getAttribute('style');
    }
  };
  const scheduleNativeQuestPopupLayout = () => {
    if (!nativePopupLayoutFrame && nativePopupLayouts.size) nativePopupLayoutFrame = requestAnimationFrame(fitNativeQuestPopups);
  };

  const ensureNativeQuestPopupCloseButton = () => {
    for (const [popup, entry] of nativePopupLayouts) {
      if (!popup.isConnected || popup.classList.contains('mobile')) {
        entry.resize?.disconnect();
        entry.mutation.disconnect();
        nativePopupLayouts.delete(popup);
        for (const suffix of ['max-width', 'max-height', 'shift-x', 'shift-y']) popup.style.removeProperty(`--wtf-popup-${suffix}`);
      }
    }
    for (const popup of document.querySelectorAll('.map-popup:not(.mobile)')) {
      if (!nativePopupLayouts.has(popup)) {
        const entry = { x: 0, y: 0, style: popup.getAttribute('style') };
        entry.resize = window.ResizeObserver ? new ResizeObserver(scheduleNativeQuestPopupLayout) : null;
        entry.resize?.observe(popup);
        entry.mutation = new MutationObserver(() => {
          if (entry.style !== popup.getAttribute('style')) scheduleNativeQuestPopupLayout();
        });
        entry.mutation.observe(popup, { attributes: true, attributeFilter: ['style'] });
        nativePopupLayouts.set(popup, entry);
      }
      const nativeSizeToggle = popup.querySelector('.large.pointer.text-right');
      nativeSizeToggle?.setAttribute('aria-hidden', 'true');
      const controls = nativeSizeToggle?.parentElement || popup.querySelector('.ml-15.self-start');
      if (!controls || controls.querySelector('.wtf-native-popup-close')) continue;
      const close = applyNativePopupScope(document.createElement('button'));
      close.type = 'button';
      close.className = 'wtf-popup-close wtf-native-popup-close';
      close.textContent = '×';
      close.title = state.language === 'ko' ? '닫기' : 'Close';
      close.setAttribute('aria-label', close.title);
      close.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      controls.appendChild(close);
    }
    scheduleNativeQuestPopupLayout();
  };

  const findNativeQuestVisibilityRow = () => {
    const iconRow = (
      document.querySelector('.panel_left .icon_quest')
      || document.querySelector('.panel_left path[d^="m253.943,502.885"]')
    )?.closest('.items > div');
    if (iconRow) return iconRow;

    const normalize = (value) => String(value || '')
      .replace(/\s+/g, '')
      .toLowerCase();
    const isQuestLabel = (value) => {
      const normalized = normalize(value).replace(/\d+$/, '');
      return normalized.includes('quest')
        || normalized.includes('mission')
        || normalized.includes('퀘스트')
        || normalized.includes('임무');
    };

    for (const section of document.querySelectorAll('.panel_left .two-columns > div')) {
      const heading = section.querySelector(':scope > div:first-child .bold');
      if (!isQuestLabel(heading?.textContent)) continue;
      const rows = [...section.querySelectorAll(':scope > .items > div')];
      return rows.find((row) => {
        const label = row.querySelector(':scope > span:first-child') || row;
        return isQuestLabel(label.textContent);
      }) || rows[0] || null;
    }
    return null;
  };

  const findNativeQuestFilterController = () => {
    for (const panel of document.querySelectorAll('.panel_left')) {
      let component = panel.__vueParentComponent;
      for (let depth = 0; component && depth < 5; depth += 1, component = component.parent) {
        const selectedMap = component.props?.selectedSubCategoriesMap;
        const toggle = component.vnode?.props?.onToggleSubCategory;
        if (selectedMap && typeof toggle === 'function') {
          return {
            active: Boolean(selectedMap.Quests_Quest),
            disable: () => toggle('Quests', 'Quest', false)
          };
        }
      }
    }
    return null;
  };

  const forceNativeQuestFilterOff = () => {
    const guardId = ++wtfOverlayState.nativeQuestFilterGuardId;
    const leftPanel = document.querySelector('.panel_left');
    let frameCount = 0;
    let togglePending = false;
    let observer = null;
    const stop = () => observer?.disconnect();
    const enforce = () => {
      // Pinned quests take priority over the site's own quest layer, so keep
      // the native filter off for as long as any pin exists.
      if (guardId !== wtfOverlayState.nativeQuestFilterGuardId || !wtfOverlayState.questPins.size) {
        stop();
        return;
      }
      const controller = findNativeQuestFilterController();
      if (controller) {
        if (!controller.active) {
          togglePending = false;
        } else if (!togglePending) {
          togglePending = true;
          controller.disable();
        }
        return;
      }
      const row = findNativeQuestVisibilityRow();
      if (!row) return;
      if (row.classList.contains('inactive')) {
        togglePending = false;
      } else if (!togglePending) {
        togglePending = true;
        row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    };
    const poll = () => {
      enforce();
      frameCount += 1;
      if (frameCount <= 90) requestAnimationFrame(poll);
    };
    if (leftPanel) {
      observer = new MutationObserver(() => enforce());
      observer.observe(leftPanel, {
        attributes: true,
        attributeFilter: ['class'],
        childList: true,
        subtree: true
      });
    }
    requestAnimationFrame(poll);
  };

  const openNativeQuestMarkerDetails = (markerData) => {
    if (!markerData?.questId || !markerData?.markerUid) return;
    forceNativeQuestFilterOff();
    const url = new URL(location.href);
    url.searchParams.delete('view');
    url.searchParams.set('obj', String(markerData.markerUid));
    history.pushState(history.state, '', url);
    window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
    requestAnimationFrame(renderQuestMarkers);
  };

  // Built-in walkthrough steps (The Ticket on Terminal) have no site marker to
  // open, so their popup is rebuilt from the site's own MapPopup markup: the same
  // element tree, classes and scoped-style attributes, placed in the site's
  // popup layer. The site's CSS then styles it exactly like a native quest popup.
  const builtInStepPopupState = { popup: null, marker: null, markerData: null, index: 0 };

  // Vue scoped styles key elements by data-v-<hash>; the hashes change with every
  // site build, so read them from the site's own stylesheet rules.
  const nativePopupScopeIds = () => {
    if (wtfOverlayState.nativePopupScopes?.popup) return wtfOverlayState.nativePopupScopes;
    const found = { popup: '', layer: '' };
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      for (const rule of rules || []) {
        const text = rule.selectorText || '';
        if (!found.popup) found.popup = text.match(/\.map-popup\[data-v-([0-9a-f]{6,})\]/)?.[1] || '';
        if (!found.layer) found.layer = text.match(/\.popup-layer\[data-v-([0-9a-f]{6,})\]/)?.[1] || '';
        if (found.popup && found.layer) break;
      }
      if (found.popup && found.layer) break;
    }
    if (found.popup) wtfOverlayState.nativePopupScopes = found;
    return found;
  };

  const builtInStepText = (value) => (siteLocale() === 'kr' ? value?.kr : '') || value?.en || '';

  const closeBuiltInStepPopup = () => {
    builtInStepPopupState.popup?.remove();
    builtInStepPopupState.popup = null;
    builtInStepPopupState.marker = null;
    builtInStepPopupState.markerData = null;
  };

  const updateBuiltInStepPopupPosition = () => {
    const { popup, marker } = builtInStepPopupState;
    if (!popup) return;
    if (!popup.isConnected || !marker?.isConnected) {
      closeBuiltInStepPopup();
      return;
    }
    const layerRect = popup.parentElement.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const x = markerRect.left + markerRect.width / 2 - layerRect.left;
    const y = markerRect.top + markerRect.height / 2 - layerRect.top;
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
  };

  const renderBuiltInStepPopup = () => {
    const { popup, markerData } = builtInStepPopupState;
    if (!popup || !markerData) return;
    const scope = nativePopupScopeIds();
    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (scope.popup) node.setAttribute(`data-v-${scope.popup}`, '');
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const step = markerData.builtInStep;
    const images = step.images || [];
    const count = images.length;
    builtInStepPopupState.index = Math.min(Math.max(0, builtInStepPopupState.index), Math.max(0, count - 1));
    const index = builtInStepPopupState.index;

    const inner = el('div', 'inner');
    const header = el('div', 'd-flex h-space-between v-start');
    const textColumn = el('div', 'w-100');
    const titleBlock = el('div');
    const questRow = el('div', 'd-flex h-space-between');
    const questLink = el('a', 'title plus d-flex');
    questLink.classList.toggle('story', Boolean(markerData.storyline));
    questLink.classList.toggle('side', !markerData.requiredForKappa);
    if (markerData.questId) questLink.href = `${sitePathPrefix()}/progression/quests?quest=${encodeURIComponent(markerData.questId)}`;
    questLink.appendChild(el('div', '', formatQuestName(markerData.quest)));
    questRow.append(questLink, el('div', 'd-flex'));
    const stepTitle = el('div', 'title');
    stepTitle.appendChild(el('div', '', builtInStepText(step)));
    const wikiRow = el('div', 'mt-n5');
    const wiki = el('a', 'ext-link sub', 'Wiki');
    wiki.href = markerData.wiki || 'https://escapefromtarkov.fandom.com/wiki/The_Ticket';
    wiki.target = '_blank';
    wikiRow.appendChild(wiki);
    titleBlock.append(questRow, stepTitle, wikiRow);
    textColumn.appendChild(titleBlock);
    const controls = el('div', 'ml-15 self-start');
    const sizeToggle = el('div', 'large pointer text-right', '⤢');
    sizeToggle.addEventListener('click', () => popup.classList.toggle('xlsize'));
    controls.appendChild(sizeToggle);
    header.append(textColumn, controls);
    inner.append(header, el('div', 'd-flex'), el('div', '', builtInStepText(step.details)));
    const nodes = [inner];

    if (count) {
      const image = images[index];
      const caption = el('div');
      caption.append(el('div', 'px-10 bold', builtInStepText(image)), el('div', 'px-10'));
      const frame = el('div', 'fs-0 mt-10');
      const view = el('div', 'p-relative');
      const nav = el('div', 'img-nav');
      const go = (delta) => {
        builtInStepPopupState.index = (builtInStepPopupState.index + delta + count) % count;
        renderBuiltInStepPopup();
      };
      for (const [arrow, delta] of [['←', -1], ['→', 1]]) {
        const button = el('div');
        button.appendChild(el('span', '', arrow));
        button.addEventListener('click', () => go(delta));
        nav.appendChild(button);
      }
      const photo = el('img');
      photo.src = `https://appcontent/${image.src}`;
      photo.alt = builtInStepText(image);
      photo.addEventListener('click', () => popup.classList.toggle('xlsize'));
      photo.addEventListener('load', scheduleNativeQuestPopupLayout);
      view.append(nav, photo);
      if (count > 1) {
        const hint = el('div', 'mouse-hint');
        hint.innerHTML = '<svg class="icon icon_mid_mouse" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 100"><rect fill="currentColor" x="6.377" y="18.032" width="37.246" height="63.935" rx="18.623" ry="18.623" style="stroke: rgb(0, 0, 0); stroke-miterlimit: 10; stroke-width: 3px;"></rect><rect fill="currentColor" x="20.946" y="24.937" width="8.107" height="19.87" rx="2.859" ry="2.859" style="stroke: rgb(0, 0, 0); stroke-miterlimit: 10; stroke-width: 3px;"></rect><path fill="currentColor" d="m25,96.196l-12.897-9.522c-.889-.656-1.077-1.908-.421-2.797.656-.889,1.908-1.078,2.797-.422l10.521,7.769,10.522-7.769c.89-.656,2.141-.467,2.797.422.655.889.467,2.141-.422,2.797l-12.897,9.522Z"></path><path fill="currentColor" d="m36.708,16.936c-.412,0-.828-.127-1.186-.391l-10.522-7.768-10.521,7.768c-.889.657-2.141.468-2.797-.421s-.468-2.141.421-2.797L25,3.805l12.897,9.522c.889.656,1.077,1.908.422,2.797-.393.531-.998.812-1.611.812Z"></path></svg>';
        if (scope.popup) for (const node of hint.querySelectorAll('*')) node.setAttribute(`data-v-${scope.popup}`, '');
        view.appendChild(hint);
        // Like the site: the wheel over the photo steps through the photos.
        view.addEventListener('wheel', (event) => {
          event.preventDefault();
          event.stopPropagation();
          go(event.deltaY > 0 ? 1 : -1);
        }, { passive: false });
      }
      frame.appendChild(view);
      nodes.push(caption, frame);
      if (count > 1) {
        const previews = el('div', 'img-preview-cont scroll');
        images.forEach((entry, previewIndex) => {
          const preview = el('img', 'img-preview');
          preview.classList.toggle('selected', previewIndex === index);
          preview.src = `https://appcontent/${entry.src}`;
          preview.alt = builtInStepText(entry);
          preview.addEventListener('click', () => {
            builtInStepPopupState.index = previewIndex;
            renderBuiltInStepPopup();
          });
          previews.appendChild(preview);
        });
        previews.addEventListener('wheel', (event) => {
          event.preventDefault();
          event.stopPropagation();
          previews.scrollLeft += event.deltaY;
        }, { passive: false });
        nodes.push(previews);
      }
    }
    popup.replaceChildren(...nodes);
    ensureNativeQuestPopupCloseButton();
    scheduleNativeQuestPopupLayout();
  };

  const openBuiltInStepPopup = (markerData, marker) => {
    if (!markerData?.builtInStep || !marker) return;
    const mapContainer = document.querySelector('.map-cont');
    if (!mapContainer) return;
    // Only one popup at a time, like the site: close a native one first.
    if (document.querySelector('.map-popup:not([data-wtf-built-in-step])')) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }
    if (builtInStepPopupState.markerData === markerData && builtInStepPopupState.popup?.isConnected) return;
    closeBuiltInStepPopup();
    const scope = nativePopupScopeIds();
    let layer = mapContainer.querySelector(':scope > .popup-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'popup-layer';
      if (scope.layer) layer.setAttribute(`data-v-${scope.layer}`, '');
      layer.dataset.wtfBuiltInStepLayer = 'true';
      mapContainer.appendChild(layer);
    }
    const popup = document.createElement('div');
    popup.className = 'map-popup';
    if (scope.popup) popup.setAttribute(`data-v-${scope.popup}`, '');
    if (scope.layer) popup.setAttribute(`data-v-${scope.layer}`, '');
    popup.dataset.wtfBuiltInStep = String(markerData.step);
    const offset = Math.round(marker.getBoundingClientRect().height / 2) + 3;
    popup.style.transformOrigin = `calc(50% + 10px) calc(100% + ${12 + offset}px)`;
    popup.style.transform = `translateX(calc(-50% - 10px)) translateY(calc(-100% - ${12 + offset}px))`;
    // The site's popup keeps map gestures from reaching the map underneath.
    for (const type of ['click', 'dblclick', 'mousedown', 'pointerdown', 'keydown', 'touchstart', 'touchmove', 'touchend']) {
      popup.addEventListener(type, (event) => event.stopPropagation());
    }
    layer.appendChild(popup);
    builtInStepPopupState.popup = popup;
    builtInStepPopupState.marker = marker;
    builtInStepPopupState.markerData = markerData;
    builtInStepPopupState.index = 0;
    renderBuiltInStepPopup();
    updateBuiltInStepPopupPosition();
  };

  // Closing follows the site's popup: Escape (also sent by the close button),
  // a click on the map, or another popup opening. Capture phase: the popup stops
  // keydown from bubbling, so Escape pressed inside it would never reach here.
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeBuiltInStepPopup();
  }, true);
  // Like the site's popup it stays open while the map is dragged or zoomed and
  // follows its ring; only a click (press and release without moving) on the map
  // itself closes it, not one on the panels and toolbar laid over the map.
  let builtInPopupPress = null;
  const isMapClickTarget = (target) => target instanceof Element
    && Boolean(target.closest('.map-cont'))
    && !target.closest('.map-popup[data-wtf-built-in-step], .wtf-quest-marker, '
      + '.panel_top, .panel_left, .panel_right, #wtf-quest-requirements-panel');
  document.addEventListener('pointerdown', (event) => {
    builtInPopupPress = builtInStepPopupState.popup && event.button === 0 && isMapClickTarget(event.target)
      ? { x: event.clientX, y: event.clientY, moved: false }
      : null;
  }, true);
  document.addEventListener('pointermove', (event) => {
    if (builtInPopupPress && Math.hypot(event.clientX - builtInPopupPress.x, event.clientY - builtInPopupPress.y) > 4) {
      builtInPopupPress.moved = true;
    }
  }, true);
  document.addEventListener('pointerup', (event) => {
    const press = builtInPopupPress;
    builtInPopupPress = null;
    if (!press || press.moved || event.button !== 0 || !builtInStepPopupState.popup) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 4) return;
    if (isMapClickTarget(event.target)) closeBuiltInStepPopup();
  }, true);

  const updateQuestMarkerFloorOpacity = () => {
    const selectedFloor = selectedPingFloor();
    for (const marker of document.querySelectorAll('.wtf-quest-marker, .wtf-quest-zone')) {
      const markerFloor = Number(marker.dataset.floor);
      const hasFloor = marker.dataset.floor !== '' && Number.isFinite(markerFloor);
      marker.classList.toggle('wtf-other-floor', selectedFloor !== null
        && hasFloor && markerFloor !== selectedFloor);
    }
  };

  const renderQuestMarkers = () => {
    const overlay = wtfOverlayState.questLayer;
    if (!overlay) return;
    overlay.replaceChildren();

    const pinnedQuestUids = getPinnedQuestUids();
    const markerDataList = (wtfOverlayState.quest.markers || [])
      .filter((markerData) => pinnedQuestUids.has(String(markerData.questId))
        || wtfOverlayState.questPins.has(normalizeQuestName(markerData.quest)));

    const zoneDataList = markerDataList.filter((markerData) => markerData.kind === 'zone');
    if (zoneDataList.length) {
      const zoneCanvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      zoneCanvas.classList.add('wtf-quest-zone-canvas');
      zoneCanvas.setAttribute('aria-hidden', 'true');
      zoneCanvas.setAttribute('preserveAspectRatio', 'none');
      for (const markerData of zoneDataList) {
        const zone = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        zone.classList.add('wtf-quest-zone');
        zone.dataset.floor = markerData.level === null || markerData.level === undefined
          ? ''
          : String(markerData.level);
        zone.dataset.questUid = String(markerData.questId || '');
        zone.dataset.markerUid = String(markerData.markerUid || '');
        zone.__wtfQuestPoints = markerData.points;
        const color = liveQuestMarkerColor(markerData);
        zone.setAttribute('fill', color);
        zone.setAttribute('stroke', color);
        zoneCanvas.appendChild(zone);
      }
      overlay.appendChild(zoneCanvas);
    }

    for (const markerData of markerDataList.filter((candidate) => candidate.kind !== 'zone')) {
      const marker = document.createElement('div');
      marker.className = 'wtf-quest-marker';
      marker.dataset.left = String(markerData.left);
      marker.dataset.top = String(markerData.top);
      marker.dataset.floor = markerData.level === null || markerData.level === undefined
        ? ''
        : String(markerData.level);
      marker.dataset.questUid = String(markerData.questId || '');
      marker.dataset.markerUid = String(markerData.markerUid || '');
      marker.dataset.spreadX = '0';
      marker.dataset.spreadY = '0';
      marker.title = [
        formatQuestName(markerData.quest),
        markerData.objective
      ].filter(Boolean).join(' \u00b7 ');
      marker.setAttribute('role', 'button');
      marker.setAttribute('aria-label', marker.title);
      marker.tabIndex = 0;
      const stopMarkerEvent = (event) => event.stopPropagation();
      marker.addEventListener('pointerdown', stopMarkerEvent);
      marker.addEventListener('mousedown', stopMarkerEvent);
      marker.addEventListener('dblclick', stopMarkerEvent);
      marker.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (markerData.builtInStep) openBuiltInStepPopup(markerData, marker);
        else openNativeQuestMarkerDetails(markerData);
      });
      marker.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        if (markerData.builtInStep) openBuiltInStepPopup(markerData, marker);
        else openNativeQuestMarkerDetails(markerData);
      });

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('wtf-quest-marker-icon');
      svg.setAttribute('viewBox', '0 0 507.885 507.885');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      // Built-in walkthrough steps keep the site's quest ring and put the step
      // number where the site draws its exclamation mark.
      path.setAttribute('d', markerData.step ? tarkovMarketQuestRingPath : tarkovMarketQuestIconPath);
      path.setAttribute('fill', liveQuestMarkerColor(markerData));
      path.setAttribute('stroke', '#000');
      path.setAttribute('stroke-width', '20');
      svg.appendChild(path);
      if (markerData.step) {
        marker.dataset.step = String(markerData.step);
        const number = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        number.classList.add('wtf-quest-step-number');
        number.setAttribute('x', '253.943');
        number.setAttribute('y', '253.943');
        number.setAttribute('text-anchor', 'middle');
        number.setAttribute('dominant-baseline', 'central');
        number.setAttribute('font-size', markerData.step >= 10 ? '230' : '290');
        number.setAttribute('fill', liveQuestMarkerColor(markerData));
        number.setAttribute('stroke', '#000');
        number.setAttribute('stroke-width', '20');
        number.setAttribute('paint-order', 'stroke');
        number.textContent = String(markerData.step);
        svg.appendChild(number);
        // Pins, live data and identity updates rebuild the layer: an open step
        // popup moves to the rebuilt ring of its step instead of closing.
        if (builtInStepPopupState.popup && builtInStepPopupState.markerData?.builtInStep === markerData.builtInStep) {
          builtInStepPopupState.marker = marker;
          builtInStepPopupState.markerData = markerData;
        }
      }
      marker.appendChild(svg);
      overlay.appendChild(marker);
    }
    wtfOverlayState.builtInRingsShown = Boolean(overlay.querySelector('.wtf-quest-marker[data-step]'));
    updateQuestMarkerFloorOpacity();
    scheduleOverlayPositionUpdate();
  };

  // 2026-10 UI: the map is drawn on canvases. .map-wrap/.map-scene only exist
  // in the site's builder mode, so normal maps
  // expose the view only through the matrix the site passes to setTransform on
  // the doc canvas before every redraw (map pixels -> canvas pixels).
  const nativeDocMapCanvas = (mapContainer) => [...mapContainer.querySelectorAll('canvas.doc-map-canvas')]
    .find((canvas) => canvas.style.display !== 'none') || null;

  const sameMatrix = (left, right) => Boolean(left && right)
    && left.a === right.a && left.b === right.b && left.c === right.c
    && left.d === right.d && left.e === right.e && left.f === right.f;

  const bindNativeViewCanvas = (canvas) => {
    if (canvas.__wtfNativeView) return canvas.__wtfNativeView;
    const context = canvas.getContext?.('2d');
    if (!context) return null;
    const view = { matrix: null };
    const record = (matrix) => {
      if (!matrix) return;
      const next = { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, e: matrix.e, f: matrix.f };
      if (![next.a, next.b, next.c, next.d, next.e, next.f].every(Number.isFinite)) return;
      if (sameMatrix(next, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })) return;
      if (Math.abs((next.a * next.d) - (next.b * next.c)) < 1e-12) return;
      if (sameMatrix(next, view.matrix)) return;
      view.matrix = next;
      scheduleOverlayPositionUpdate();
    };
    // The site leaves its view transform on the context after drawing.
    if (typeof context.getTransform === 'function') record(context.getTransform());
    const originalSetTransform = context.setTransform;
    context.setTransform = function (...args) {
      const result = originalSetTransform.apply(this, args);
      // Record what the canvas really uses; on Terminal that includes the extra tilt.
      // An identity request is the site clearing the canvas, not a view.
      const requested = this.__wtfRequestedTransform;
      if (requested && sameMatrix(requested, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })) return result;
      record(typeof this.getTransform === 'function'
        ? this.getTransform()
        : (args.length >= 6
          ? { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] }
          : args[0]));
      return result;
    };
    canvas.__wtfNativeView = view;
    return view;
  };

  const currentOverlayMapSlug = () => {
    const routeMatch = String(location.pathname || '').match(/\/maps\/([^/?#]+)/i);
    const fromRoute = routeMatch ? decodeURIComponent(routeMatch[1]).toLowerCase() : '';
    if (tarkovMarketMapDefinitions[fromRoute]) return fromRoute;
    return [wtfOverlayState.quest.map, wtfOverlayState.pings.map, wtfOverlayState.route.map, wtfOverlayState.squad.map]
      .map((slug) => String(slug || '').toLowerCase())
      .find((slug) => tarkovMarketMapDefinitions[slug]) || '';
  };

  const resolveOverlayHost = () => {
    const mapContainer = document.querySelector('.map-cont');
    if (!mapContainer) return null;
    const mapWrap = mapContainer.querySelector('.map-wrap');
    if (mapWrap) return { mapContainer, mapWrap, canvas: null };
    const canvas = nativeDocMapCanvas(mapContainer);
    return canvas ? { mapContainer, mapWrap: null, canvas } : null;
  };

  const legacyOverlayGeometry = (mapContainer, mapWrap) => {
    const computed = getComputedStyle(mapWrap);
    const matrix = parseMapTransform(computed.transform);
    const originParts = computed.transformOrigin.split(/\s+/);
    const wrapTransform = {
      matrix,
      originX: Number.parseFloat(originParts[0]) || 0,
      originY: Number.parseFloat(originParts[1]) || 0,
      layout: getLayoutOffset(mapWrap, mapContainer)
    };
    const sceneTransform = mapSceneTransformInfo(mapWrap);
    const width = sceneTransform?.width
      || mapWrap.offsetWidth || Number.parseFloat(computed.width) || 0;
    const height = sceneTransform?.height
      || mapWrap.offsetHeight || Number.parseFloat(computed.height) || 0;
    return {
      zoom: Math.hypot(matrix.a, matrix.b),
      rotation: 0,
      toContainer: (left, top) => {
        let point = {
          x: (Number(left) / 100) * width,
          y: (Number(top) / 100) * height
        };
        if (sceneTransform) point = transformPoint(point.x, point.y, sceneTransform);
        return transformPoint(point.x, point.y, wrapTransform);
      },
      fromClient: (clientX, clientY) => {
        const containerRect = mapContainer.getBoundingClientRect();
        let point = inverseTransformPoint(
          clientX - containerRect.left,
          clientY - containerRect.top,
          wrapTransform
        );
        if (!point) return null;
        if (sceneTransform) point = inverseTransformPoint(point.x, point.y, sceneTransform);
        if (!point || !(width > 0) || !(height > 0)) return null;
        return { left: (point.x / width) * 100, top: (point.y / height) * 100 };
      }
    };
  };

  const nativeOverlayGeometry = (mapContainer, canvas) => {
    const matrix = bindNativeViewCanvas(canvas)?.matrix;
    const definition = tarkovMarketMapDefinitions[currentOverlayMapSlug()];
    if (!matrix || !definition) return null;
    const ratio = canvas.clientWidth > 0 ? canvas.width / canvas.clientWidth : 1;
    const a = matrix.a / ratio;
    const b = matrix.b / ratio;
    const c = matrix.c / ratio;
    const d = matrix.d / ratio;
    const determinant = (a * d) - (b * c);
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) return null;
    const containerRect = mapContainer.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const offsetX = canvasRect.left - containerRect.left;
    const offsetY = canvasRect.top - containerRect.top;
    const e = matrix.e / ratio;
    const f = matrix.f / ratio;
    return {
      zoom: Math.hypot(a, b),
      rotation: Math.atan2(b, a) * 180 / Math.PI,
      toContainer: (left, top) => {
        const mapX = (Number(left) / 100) * definition.width;
        const mapY = (Number(top) / 100) * definition.height;
        return {
          x: offsetX + (a * mapX) + (c * mapY) + e,
          y: offsetY + (b * mapX) + (d * mapY) + f
        };
      },
      fromClient: (clientX, clientY) => {
        const x = clientX - canvasRect.left - e;
        const y = clientY - canvasRect.top - f;
        const mapX = ((d * x) - (c * y)) / determinant;
        const mapY = ((-b * x) + (a * y)) / determinant;
        return {
          left: (mapX / definition.width) * 100,
          top: (mapY / definition.height) * 100
        };
      }
    };
  };

  const resolveOverlayGeometry = (host = wtfOverlayState) => {
    const mapContainer = host?.mapContainer;
    if (!mapContainer?.isConnected) return null;
    if (host.mapWrap?.isConnected) return legacyOverlayGeometry(mapContainer, host.mapWrap);
    if (host.mapCanvas?.isConnected) return nativeOverlayGeometry(mapContainer, host.mapCanvas);
    if (host.canvas?.isConnected) return nativeOverlayGeometry(mapContainer, host.canvas);
    return null;
  };

  const ensureQuestLayer = () => {
    const host = resolveOverlayHost();
    if (!host) return false;
    const { mapContainer } = host;
    if (!wtfOverlayState.questLayer?.isConnected || wtfOverlayState.questLayer.parentElement !== mapContainer) {
      wtfOverlayState.questLayer?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'wtf-quest-layer';
      overlay.setAttribute('aria-hidden', 'true');
      mapContainer.appendChild(overlay);
      wtfOverlayState.questLayer = overlay;
      renderQuestMarkers();
    }
    observeMapTransform(host);
    return true;
  };

  // Built-in step rings (The Ticket) mark spots where the site often has its own
  // icon (a lock, a key, a lever). A ring on top of the icon hides it and takes
  // its clicks, so each ring stands just beside any site icon (and beside the
  // rings already placed), at the smallest screen offset that clears them. The
  // offset is in screen pixels, so it holds at every zoom and rotation.
  const builtInRingGap = 2;
  const layoutBuiltInStepRings = (screenPoint) => {
    const layer = wtfOverlayState.questLayer;
    if (!layer) return;
    const rings = [...layer.querySelectorAll('.wtf-quest-marker[data-step]')]
      .sort((a, b) => Number(a.dataset.step) - Number(b.dataset.step));
    if (!rings.length) return;
    // Measure every ring before updateOverlayPositions writes positions: one
    // layout per frame instead of one forced layout per ring.
    for (const ring of rings) {
      const size = Math.round(ring.getBoundingClientRect().width * 100) / 100;
      if (size > 0 && ring.dataset.ringSize !== String(size)) ring.dataset.ringSize = String(size);
    }
    const icons = nativeIconFrame.icons;
    const placed = [];
    for (const ring of rings) {
      const base = screenPoint(ring.dataset.left, ring.dataset.top);
      const radius = Math.max(8, (Number(ring.dataset.ringSize) || 30) / 2);
      const reach = radius * 6 + 64;
      const obstacles = icons.concat(placed)
        .filter((item) => Math.abs(item.x - base.x) < reach && Math.abs(item.y - base.y) < reach);
      const clearAt = (x, y) => obstacles.every((item) => Math.hypot(item.x - x, item.y - y) >= item.r + radius + builtInRingGap);
      let spot = { x: base.x, y: base.y };
      if (!clearAt(base.x, base.y)) {
        // Prefer moving straight away from the nearest thing underneath; a ring
        // sitting exactly on an icon moves up and to the right.
        const nearest = obstacles
          .map((item) => ({ item, distance: Math.hypot(item.x - base.x, item.y - base.y) }))
          .sort((a, b) => a.distance - b.distance)[0];
        const preferred = nearest && nearest.distance > 0.5
          ? Math.atan2(base.y - nearest.item.y, base.x - nearest.item.x)
          : -Math.PI / 4;
        // Stay close to the spot: at most about two ring sizes away. Where the
        // site's icons are packed tighter than that (far zoomed out), take the
        // nearby spot that overlaps least.
        const overlapAt = (x, y) => obstacles.reduce((sum, item) => sum
          + Math.max(0, item.r + radius + builtInRingGap - Math.hypot(item.x - x, item.y - y)), 0);
        const limit = Math.max(20, radius * 3);
        let least = { x: base.x, y: base.y, overlap: overlapAt(base.x, base.y) };
        search:
        for (let distance = 2; distance <= limit; distance += 2) {
          for (let step = 0; step < 24; step += 1) {
            const turn = Math.ceil(step / 2) * (step % 2 ? 1 : -1) * (Math.PI / 12);
            const x = base.x + Math.cos(preferred + turn) * distance;
            const y = base.y + Math.sin(preferred + turn) * distance;
            const overlap = overlapAt(x, y);
            if (overlap <= 0) {
              least = { x, y, overlap };
              break search;
            }
            if (overlap < least.overlap - 0.5) least = { x, y, overlap };
          }
        }
        spot = { x: least.x, y: least.y };
      }
      ring.dataset.spreadX = String(Math.round((spot.x - base.x) * 100) / 100);
      ring.dataset.spreadY = String(Math.round((spot.y - base.y) * 100) / 100);
      placed.push({ x: spot.x, y: spot.y, r: radius });
    }
  };

  const updateOverlayPositions = () => {
    wtfOverlayState.updateFrame = 0;
    const mapContainer = wtfOverlayState.mapContainer;
    const geometry = resolveOverlayGeometry();
    if (!geometry) return;

    const currentZoom = geometry.zoom;
    const mapSlug = String(wtfOverlayState.quest.map || '').toLowerCase();
    const baseZoom = tarkovMarketMapDefinitions[mapSlug]?.zoom || 1;
    const nativeQuestMarkerScale = currentZoom >= baseZoom
      ? 1
      : Math.max(0.5, Math.sqrt(currentZoom / baseZoom));
    const screenPoint = geometry.toContainer;
    layoutBuiltInStepRings(screenPoint);

    const zoneCanvas = wtfOverlayState.questLayer?.querySelector('.wtf-quest-zone-canvas');
    if (zoneCanvas) {
      const canvasWidth = Math.max(1, mapContainer.clientWidth || mapContainer.offsetWidth || 1);
      const canvasHeight = Math.max(1, mapContainer.clientHeight || mapContainer.offsetHeight || 1);
      zoneCanvas.setAttribute('viewBox', `0 0 ${canvasWidth} ${canvasHeight}`);
      for (const zone of zoneCanvas.querySelectorAll('.wtf-quest-zone')) {
        const points = Array.isArray(zone.__wtfQuestPoints) ? zone.__wtfQuestPoints : [];
        zone.setAttribute('points', points.map((point) => {
          const screen = screenPoint(point.left, point.top);
          return `${screen.x},${screen.y}`;
        }).join(' '));
      }
    }

    for (const marker of document.querySelectorAll('.wtf-quest-marker, .wtf-squad-marker, .wtf-ping-marker, .wtf-route-node')) {
      if (marker.parentElement !== wtfOverlayState.questLayer
          && marker.parentElement !== wtfOverlayState.squadLayer
          && marker.parentElement !== wtfOverlayState.pingLayer
          && marker.parentElement !== wtfOverlayState.routeLayer) continue;
      const screen = screenPoint(marker.dataset.left, marker.dataset.top);
      const spreadX = Number(marker.dataset.spreadX) || 0;
      const spreadY = Number(marker.dataset.spreadY) || 0;
      marker.style.left = (screen.x + spreadX) + 'px';
      marker.style.top = (screen.y + spreadY) + 'px';
      if (marker.classList.contains('wtf-quest-marker')) {
        const scale = String(state.iconScale * nativeQuestMarkerScale);
        if (marker.style.getPropertyValue('--wtf-quest-marker-scale') !== scale) {
          marker.style.setProperty('--wtf-quest-marker-scale', scale);
          // A step ring changed size: lay the rings out again with the new size.
          if (marker.dataset.step) scheduleOverlayPositionUpdate();
        }
      } else if (marker.classList.contains('wtf-squad-marker')) {
        // Headings are map-space angles; follow the native view rotation.
        const direction = `${(Number(marker.dataset.direction) || 0) + geometry.rotation}deg`;
        if (marker.style.getPropertyValue('--wtf-squad-direction') !== direction) {
          marker.style.setProperty('--wtf-squad-direction', direction);
        }
      }
    }
    updateRouteLines();
    updateBuiltInStepPopupPosition();
    updateCompassTilt();
  };

  const scheduleOverlayPositionUpdate = () => {
    if (wtfOverlayState.updateFrame) return;
    wtfOverlayState.updateFrame = requestAnimationFrame(updateOverlayPositions);
  };
  // Re-place the step rings after the site redraws its icons (called for every
  // icon the site draws, so it only reads a flag kept by renderQuestMarkers).
  nativeIconFrame.onDrawn = () => {
    if (wtfOverlayState.builtInRingsShown) scheduleOverlayPositionUpdate();
  };

  const mapPercentFromClientPoint = (host, clientX, clientY) => {
    const point = resolveOverlayGeometry(host)?.fromClient(clientX, clientY);
    if (!point) return null;
    const { left, top } = point;
    if (!Number.isFinite(left) || !Number.isFinite(top) || left < 0 || left > 100 || top < 0 || top > 100) return null;
    return { left, top };
  };

  const nearestOverlayMarker = (selector, clientX, clientY, radius = 24) => {
    let nearest = null;
    let nearestDistanceSquared = Number.POSITIVE_INFINITY;
    for (const marker of document.querySelectorAll(selector)) {
      const rect = marker.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const deltaX = clientX - (rect.left + rect.width / 2);
      const deltaY = clientY - (rect.top + rect.height / 2);
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      const hitRadius = radius + Math.max(rect.width, rect.height) / 2;
      if (distanceSquared <= hitRadius * hitRadius && distanceSquared < nearestDistanceSquared) {
        nearest = marker;
        nearestDistanceSquared = distanceSquared;
      }
    }
    return nearest;
  };

  // The canvas UI numbers floors itself (Lab: Level 2 = 2, Main = 1, Basement = -1)
  // and passes that list, in radio order, to its popup layer as layersAsNums.
  const nativeLayerNumbers = () => {
    const key = location.pathname;
    if (wtfOverlayState.layerNumbersKey === key) return wtfOverlayState.layerNumbers;
    let found = null;
    const root = document.querySelector('#__nuxt')?.__vue_app__?._container?._vnode;
    const visit = (vnode, depth) => {
      if (found || !vnode || depth > 400) return;
      const component = vnode.component;
      if (component) {
        const numbers = component.props?.layersAsNums;
        if (Array.isArray(numbers) && numbers.length && numbers.every(Number.isFinite)) {
          found = [...numbers];
          return;
        }
        visit(component.subTree, depth + 1);
        return;
      }
      if (Array.isArray(vnode.children)) {
        for (const child of vnode.children) if (child && typeof child === 'object') visit(child, depth + 1);
      }
      if (vnode.suspense) visit(vnode.suspense.activeBranch, depth + 1);
    };
    try {
      visit(root, 0);
    } catch {
      found = null;
    }
    if (found) {
      wtfOverlayState.layerNumbersKey = key;
      wtfOverlayState.layerNumbers = found;
    }
    return found;
  };

  const selectedPingFloor = () => {
    const inputs = [...document.querySelectorAll('input[name="layers"]')];
    const selected = inputs.find(input => input.checked || input.getAttribute('aria-checked') === 'true');
    if (!selected || inputs.length < 2) return null;
    const numbers = nativeLayerNumbers();
    const index = inputs.indexOf(selected);
    if (numbers && numbers.length === inputs.length && Number.isFinite(numbers[index])) return numbers[index];
    if (selected.value === 'Level 2') return 2;
    if (selected.value === 'Ground') return 1;
    return readFloorLevel(selected);
  };

  const updatePingFloorOpacity = () => {
    const selectedFloor = selectedPingFloor();
    for (const marker of document.querySelectorAll('.wtf-ping-marker')) {
      const markerFloor = Number(marker.dataset.floor);
      marker.classList.toggle('wtf-other-floor', selectedFloor !== null
        && Number.isFinite(markerFloor) && marker.dataset.floor !== '' && markerFloor !== selectedFloor);
    }
  };

  const renderPingMarkers = () => {
    const overlay = wtfOverlayState.pingLayer;
    if (!overlay) return;
    overlay.replaceChildren();
    overlay.hidden = !wtfOverlayState.pingsVisible;
    for (const ping of wtfOverlayState.pings.pings || []) {
      const marker = document.createElement('div');
      marker.className = 'wtf-ping-marker';
      marker.dataset.id = String(ping.id || '');
      marker.dataset.left = String(ping.left);
      marker.dataset.top = String(ping.top);
      marker.dataset.floor = ping.floor === null || ping.floor === undefined ? '' : String(ping.floor);
      marker.dataset.owned = ping.creatorId ? 'false' : 'true';
      const participantSlot = applyParticipantColor(marker, ping);
      marker.title = `${participantSlot}P · ${String(ping.creatorName || pingCopy('Ping', '핑'))}`;
      marker.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'wtf-ping-name';
      label.textContent = String(ping.creatorName || pingCopy('Ping', '핑'));
      marker.appendChild(label);
      overlay.appendChild(marker);
    }
    updatePingFloorOpacity();
    ensurePingControl();
    ensureClearPingsButton();
    scheduleOverlayPositionUpdate();
  };

  // Panels, popups and our own floating panels never receive pings or nodes.
  const overlayPlacementBlockedSelector = '.panel_top, .panel_left, .panel_right, button, input, label, a, '
    + '.map-popup, .popup-layer > *, .map-guide, .map-credits, .mobile-map-ui > *, '
    + '#wtf-quest-requirements-panel, #wtf-portrait-panel-shell > *';

  // The canvas UI also reacts to the click that follows a handled pointerdown
  // (marker popups, Alt level switching), so swallow that one click.
  const swallowFollowingClick = (mapContainer) => {
    mapContainer.__wtfSwallowClickUntil = performance.now() + 600;
    if (mapContainer.__wtfSwallowClickHandler) return;
    mapContainer.__wtfSwallowClickHandler = (event) => {
      if (performance.now() > (mapContainer.__wtfSwallowClickUntil || 0)) return;
      mapContainer.__wtfSwallowClickUntil = 0;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    mapContainer.addEventListener('click', mapContainer.__wtfSwallowClickHandler, true);
  };

  const installPingPlacement = (host) => {
    const { mapContainer } = host;
    const viewKey = host.mapWrap || host.canvas;
    if (mapContainer.__wtfPingMapWrap === viewKey) return;
    if (mapContainer.__wtfPingPointerHandler) {
      mapContainer.removeEventListener('pointerdown', mapContainer.__wtfPingPointerHandler, true);
    }
    const handler = (event) => {
      if (!event.altKey || event.button !== 0
          || event.target.closest(`${overlayPlacementBlockedSelector}, .wtf-quest-marker`)) return;
      const screen = screenPointOf(event);
      const nearbyPing = nearestOverlayMarker('.wtf-ping-marker[data-owned="true"]', screen.clientX, screen.clientY);
      if (nearbyPing?.dataset.id) {
        event.preventDefault();
        event.stopImmediatePropagation();
        swallowFollowingClick(mapContainer);
        window.chrome?.webview?.postMessage(JSON.stringify({
          action: 'map-ping-delete', id: nearbyPing.dataset.id
        }));
        return;
      }
      const point = mapPercentFromClientPoint(wtfOverlayState, screenPointOf(event).clientX, screenPointOf(event).clientY);
      if (!point) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      swallowFollowingClick(mapContainer);
      window.chrome?.webview?.postMessage(JSON.stringify({
        action: 'map-ping-add',
        left: point.left,
        top: point.top,
        floor: selectedPingFloor()
      }));
    };
    mapContainer.__wtfPingMapWrap = viewKey;
    mapContainer.__wtfPingPointerHandler = handler;
    mapContainer.addEventListener('pointerdown', handler, true);
  };

  const ensurePingLayer = () => {
    const host = resolveOverlayHost();
    if (!host) return false;
    const { mapContainer } = host;
    if (!wtfOverlayState.pingLayer?.isConnected || wtfOverlayState.pingLayer.parentElement !== mapContainer) {
      wtfOverlayState.pingLayer?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'wtf-ping-layer';
      overlay.setAttribute('aria-hidden', 'true');
      mapContainer.appendChild(overlay);
      wtfOverlayState.pingLayer = overlay;
      renderPingMarkers();
    }
    observeMapTransform(host);
    installPingPlacement(host);
    return true;
  };

  const updateRouteFloorOpacity = () => {
    const selectedFloor = selectedPingFloor();
    const floorById = new Map();
    for (const marker of document.querySelectorAll('.wtf-route-node')) {
      const markerFloor = Number(marker.dataset.floor);
      const hasFloor = marker.dataset.floor !== '' && Number.isFinite(markerFloor);
      floorById.set(marker.dataset.id, hasFloor ? markerFloor : null);
      marker.classList.toggle('wtf-other-floor', selectedFloor !== null && hasFloor && markerFloor !== selectedFloor);
    }
    for (const line of document.querySelectorAll('.wtf-route-line')) {
      const floors = [floorById.get(line.dataset.from), floorById.get(line.dataset.to)];
      line.classList.toggle('wtf-other-floor', selectedFloor !== null
        && floors.some(floor => floor !== null && floor !== undefined && floor !== selectedFloor));
    }
  };

  const updateRouteLines = () => {
    const layer = wtfOverlayState.routeLayer;
    if (!layer?.isConnected) return;
    const markerById = new Map(
      [...layer.querySelectorAll('.wtf-route-node')].map(marker => [marker.dataset.id, marker])
    );
    for (const line of layer.querySelectorAll('.wtf-route-line')) {
      const from = markerById.get(line.dataset.from);
      const to = markerById.get(line.dataset.to);
      if (!from || !to) continue;
      line.setAttribute('x1', Number.parseFloat(from.style.left) || 0);
      line.setAttribute('y1', Number.parseFloat(from.style.top) || 0);
      line.setAttribute('x2', Number.parseFloat(to.style.left) || 0);
      line.setAttribute('y2', Number.parseFloat(to.style.top) || 0);
    }
    updateRouteFloorOpacity();
  };

  const renderRouteNodes = () => {
    const layer = wtfOverlayState.routeLayer;
    if (!layer) return;
    layer.replaceChildren();
    layer.hidden = !wtfOverlayState.routeVisible;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('wtf-route-lines');
    svg.setAttribute('aria-hidden', 'true');
    layer.appendChild(svg);
    const nodes = wtfOverlayState.route.nodes || [];
    const nodesByParticipant = new Map();
    for (const node of nodes) {
      const key = node.creatorId
        ? `player-${String(node.creatorId).toLowerCase()}`
        : `local-slot-${resolveParticipantSlot(node)}`;
      if (!nodesByParticipant.has(key)) nodesByParticipant.set(key, []);
      nodesByParticipant.get(key).push(node);
    }
    for (const participantNodes of nodesByParticipant.values()) {
      participantNodes.sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0));
      for (let index = 1; index < participantNodes.length; index += 1) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('wtf-route-line');
        line.dataset.from = String(participantNodes[index - 1].id || '');
        line.dataset.to = String(participantNodes[index].id || '');
        applyParticipantColor(line, participantNodes[index]);
        svg.appendChild(line);
      }
    }
    for (const node of nodes) {
      const marker = document.createElement('div');
      marker.className = 'wtf-route-node';
      marker.dataset.id = String(node.id || '');
      marker.dataset.left = String(node.left);
      marker.dataset.top = String(node.top);
      marker.dataset.floor = node.floor === null || node.floor === undefined ? '' : String(node.floor);
      marker.dataset.owned = node.creatorId ? 'false' : 'true';
      const participantSlot = applyParticipantColor(marker, node);
      marker.title = `${participantSlot}P · ${String(node.creatorName || pingCopy('Route', '경로'))}`;
      if (!node.creatorId) {
        marker.addEventListener('contextmenu', event => {
          event.preventDefault();
          event.stopPropagation();
          window.chrome?.webview?.postMessage(JSON.stringify({
            action: 'map-route-node-delete', id: marker.dataset.id
          }));
        });
      }
      layer.appendChild(marker);
    }
    ensureRouteControl();
    ensureClearRouteButton();
    scheduleOverlayPositionUpdate();
  };

  const installRoutePlacement = (host) => {
    const { mapContainer } = host;
    const viewKey = host.mapWrap || host.canvas;
    if (mapContainer.__wtfRouteMapWrap === viewKey) return;
    if (mapContainer.__wtfRoutePointerHandler) {
      mapContainer.removeEventListener('pointerdown', mapContainer.__wtfRoutePointerHandler, true);
      mapContainer.removeEventListener('auxclick', mapContainer.__wtfRouteAuxHandler, true);
    }
    const isInteractiveUi = target => target.closest(`${overlayPlacementBlockedSelector}, .wtf-ping-marker`);
    const handler = event => {
      if (event.button !== 1 || isInteractiveUi(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      // Only a click on the node itself (7 px dot + 4 px) removes it, so nodes can
      // be placed on icons that sit close to an earlier node.
      const screen = screenPointOf(event);
      const nearbyNode = nearestOverlayMarker('.wtf-route-node[data-owned="true"]', screen.clientX, screen.clientY, 4);
      if (nearbyNode?.dataset.id) {
        window.chrome?.webview?.postMessage(JSON.stringify({
          action: 'map-route-node-delete', id: nearbyNode.dataset.id
        }));
        return;
      }
      const maxNodes = Number(wtfOverlayState.route.maxNodes) || 40;
      if ((Number(wtfOverlayState.route.localNodeCount) || 0) >= maxNodes) {
        window.alert(pingCopy(
          `A route can contain up to ${maxNodes} nodes.`,
          `경로 노드는 최대 ${maxNodes}개까지 배치할 수 있습니다.`
        ));
        return;
      }
      const point = mapPercentFromClientPoint(wtfOverlayState, screenPointOf(event).clientX, screenPointOf(event).clientY);
      if (!point) return;
      window.chrome?.webview?.postMessage(JSON.stringify({
        action: 'map-route-node-add',
        left: point.left,
        top: point.top,
        floor: selectedPingFloor()
      }));
    };
    const auxHandler = event => {
      if (event.button === 1 && !isInteractiveUi(event.target)) event.preventDefault();
    };
    mapContainer.__wtfRouteMapWrap = viewKey;
    mapContainer.__wtfRoutePointerHandler = handler;
    mapContainer.__wtfRouteAuxHandler = auxHandler;
    mapContainer.addEventListener('pointerdown', handler, true);
    mapContainer.addEventListener('auxclick', auxHandler, true);
  };

  const ensureRouteLayer = () => {
    const host = resolveOverlayHost();
    if (!host) return false;
    const { mapContainer } = host;
    if (!wtfOverlayState.routeLayer?.isConnected || wtfOverlayState.routeLayer.parentElement !== mapContainer) {
      wtfOverlayState.routeLayer?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'wtf-route-layer';
      overlay.setAttribute('aria-label', pingCopy('Route nodes', '경로 노드'));
      mapContainer.appendChild(overlay);
      wtfOverlayState.routeLayer = overlay;
      renderRouteNodes();
    }
    observeMapTransform(host);
    installRoutePlacement(host);
    return true;
  };

  const readFloorLevel = (input) => {
    if (!input) return null;
    const text = [
      input.getAttribute('aria-label'),
      input.value,
      input.closest('label')?.textContent,
      input.parentElement?.textContent
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

    const numberedDeckMatch = text.match(/\(\s*(-?\d{1,2})\s*\)/);
    if (numberedDeckMatch) return Number(numberedDeckMatch[1]);
    if (/\b(?:basement|bunker|underground)\b/i.test(text)) return 0;
    if (/\b(?:main|ground)\b/i.test(text)) return 1;
    const levelMatch = text.match(/\blevel\s*(-?\d{1,2})\b/i);
    if (levelMatch) return Number(levelMatch[1]);
    const shortMatch = text.match(/\b(-?\d{1,2})\s*(?:f|층)\b/i);
    return shortMatch ? Number(shortMatch[1]) : null;
  };

  const installFloorEvents = () => {
    if (wtfOverlayState.floorEventsInstalled) return;
    wtfOverlayState.floorEventsInstalled = true;
    document.addEventListener('change', (event) => {
      if (event.target instanceof Element && event.target.matches('.no-wrap input[name="layers"]')) {
        requestAnimationFrame(updateQuestMarkerFloorOpacity);
        requestAnimationFrame(updatePingFloorOpacity);
        requestAnimationFrame(updateRouteFloorOpacity);
      }
    });
    document.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('.no-wrap input[name="layers"], .no-wrap label')) {
        requestAnimationFrame(updateQuestMarkerFloorOpacity);
        requestAnimationFrame(updatePingFloorOpacity);
      }
    });
  };

  const observeMapTransform = ({ mapContainer, mapWrap, canvas }) => {
    const mapScene = mapWrap?.querySelector('.map-scene') || null;
    if (wtfOverlayState.mapContainer === mapContainer
        && wtfOverlayState.mapWrap === mapWrap
        && wtfOverlayState.mapScene === mapScene
        && wtfOverlayState.mapCanvas === canvas
        && wtfOverlayState.resizeObserver !== null) return;
    wtfOverlayState.mapObserver?.disconnect();
    wtfOverlayState.resizeObserver?.disconnect();
    wtfOverlayState.mapObserver = null;
    wtfOverlayState.resizeObserver = null;
    wtfOverlayState.mapContainer = mapContainer;
    wtfOverlayState.mapWrap = mapWrap;
    wtfOverlayState.mapScene = mapScene;
    wtfOverlayState.mapCanvas = canvas;
    const observedTransforms = [];
    if (mapWrap) {
      // A stage wrapper may pan (left/top) around the map wrap; watch every ancestor.
      for (let element = mapWrap; element && element !== mapContainer; element = element.parentElement) {
        observedTransforms.push(element);
      }
      wtfOverlayState.mapObserver = new MutationObserver(scheduleOverlayPositionUpdate);
      for (const element of observedTransforms) {
        wtfOverlayState.mapObserver.observe(element, {
          attributes: true,
          attributeFilter: ['style', 'class']
        });
      }
      if (mapScene) {
        wtfOverlayState.mapObserver.observe(mapScene, {
          attributes: true,
          attributeFilter: ['style', 'class']
        });
        observedTransforms.push(mapScene);
      }
    } else if (canvas) {
      bindNativeViewCanvas(canvas);
    }
    if (window.ResizeObserver) {
      wtfOverlayState.resizeObserver = new ResizeObserver(scheduleOverlayPositionUpdate);
      wtfOverlayState.resizeObserver.observe(mapContainer);
      for (const element of observedTransforms) wtfOverlayState.resizeObserver.observe(element);
      if (canvas) wtfOverlayState.resizeObserver.observe(canvas);
    } else {
      wtfOverlayState.resizeObserver = false;
    }
    scheduleOverlayPositionUpdate();
  };

  const renderSquadMarkers = () => {
    const overlay = wtfOverlayState.squadLayer;
    if (!overlay) return;
    overlay.replaceChildren();

    for (const member of wtfOverlayState.squad.members || []) {
      const marker = document.createElement('div');
      marker.className = 'wtf-squad-marker';
      marker.dataset.left = String(member.left);
      marker.dataset.top = String(member.top);
      marker.dataset.elevation = String(member.elevation ?? '');
      marker.dataset.direction = String(Number(member.direction) || 0);
      marker.title = member.name || 'Squad member';
      marker.setAttribute('aria-hidden', 'true');
      marker.style.setProperty('--wtf-squad-direction', `${Number(member.direction) || 0}deg`);

      const direction = document.createElement('span');
      direction.className = 'wtf-squad-direction';
      const circle = document.createElement('span');
      circle.className = 'wtf-squad-circle';
      const arrow = document.createElement('span');
      arrow.className = 'wtf-squad-arrow';
      direction.append(circle, arrow);

      const label = document.createElement('span');
      label.className = 'wtf-squad-name';
      label.textContent = String(member.name || 'Squad');
      marker.append(direction, label);
      overlay.appendChild(marker);
    }
    scheduleOverlayPositionUpdate();
  };

  const ensureSquadLayer = () => {
    const host = resolveOverlayHost();
    if (!host) return false;
    const { mapContainer } = host;
    if (!wtfOverlayState.squadLayer?.isConnected || wtfOverlayState.squadLayer.parentElement !== mapContainer) {
      wtfOverlayState.squadLayer?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'wtf-squad-layer';
      overlay.setAttribute('aria-hidden', 'true');
      mapContainer.appendChild(overlay);
      wtfOverlayState.squadLayer = overlay;
      renderSquadMarkers();
    }
    observeMapTransform(host);
    return true;
  };

  const hideCommercialAndPaidUi = () => {
    const hide = (element) => {
      if (!(element instanceof Element)) return;
      if (element.getAttribute('data-wtf-commercial-hidden') === 'true') return;
      element.setAttribute('data-wtf-commercial-hidden', 'true');
      element.setAttribute('aria-hidden', 'true');
      if ('inert' in element) element.inert = true;
    };

    document.querySelectorAll([
      '.content.maps .head-pilot',
      '.content.maps .alert-box',
      paidUiSelector,
      removedToolbarSelector
    ].join(',')).forEach(hide);

    for (const button of document.querySelectorAll('.panel_top button')) {
      const label = `${button.getAttribute('aria-label') || ''} ${button.textContent || ''}`;
      if (/\bOCR\b/i.test(label)) hide(button.closest('.hint-root') || button);
    }

    document.querySelectorAll('a[href]').forEach((link) => {
      const href = String(link.getAttribute('href') || '').toLowerCase();
      if (href.includes('patreon.com') || href.includes('boosty.to')) {
        hide(link.closest('li, .d-flex, .mb-5') || link);
      }
    });

    document.querySelectorAll('a, button, [role="button"], label, span, .sub').forEach((element) => {
      if (element.closest('[data-wtf-commercial-hidden="true"]')) return;
      const text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 220) return;

      if (/in the free version|upgrade to pro|available (?:with|in) (?:the )?pro|pro version only/i.test(text)) {
        hide(element.closest('a, button, [role="button"], li') || element);
        return;
      }

      if (/^(?:use your progress|내 진행도 사용|Исп\. ваш прогресс)\s*[✔✘✕×x]?$/i.test(text)) {
        hide(element);
        // The next row is now the FREE Story/Kappa/All filter, not a Pro
        // progress control. Never hide arbitrary siblings across UI updates.
        return;
      }

      if (/^(?:pro|premium|subscribe|upgrade|unlock pro)$/i.test(text)) {
        const interactive = element.closest('a, button, [role="button"], label, li');
        const compactParent = element.parentElement
          && String(element.parentElement.textContent || '').replace(/\s+/g, ' ').trim().length <= text.length + 48
          ? element.parentElement
          : null;
        hide(interactive || compactParent || element);
      }
    });
  };

  const hydrateWtfEnhancementDom = () => {
    wtfOverlayState.hydrateFrame = 0;
    installWtfOverlayStyles();
    hideCommercialAndPaidUi();
    addNativeQuestCheckboxes();
    syncQuestRequirementsPanel();
    ensureQuestLayer();
    ensureNativeQuestPopupCloseButton();
    ensureSquadLayer();
    ensurePingControl();
    ensureClearPingsButton();
    ensurePingLayer();
    ensureRouteControl();
    ensureClearRouteButton();
    ensureRouteLayer();
    updatePingFloorOpacity();
    updateRouteFloorOpacity();
    scheduleResponsivePanelLayout();
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
      characterData: true,
      childList: true,
      subtree: true
    });
    window.addEventListener('resize', scheduleOverlayPositionUpdate, { passive: true });
    window.addEventListener('resize', applyQuestRequirementsPanelLayout, { passive: true });
    window.addEventListener('resize', scheduleResponsivePanelLayout, { passive: true });
    window.addEventListener('resize', scheduleNativeQuestPopupLayout, { passive: true });
    scheduleWtfEnhancementHydration();
  };

  window.__wtfQuestOverlay = {
    configure(snapshot = {}) {
      wtfOverlayState.quest = {
        map: String(snapshot.map || ''),
        markers: []
      };
      wtfOverlayState.liveQuestStore = null;
      wtfOverlayState.liveQuestSource = 'not-loaded';
      wtfOverlayState.liveQuestError = '';
      clearTimeout(wtfOverlayState.liveQuestRetryTimer);
      wtfOverlayState.liveQuestLoadPromise = null;
      installWtfOverlayStyles();
      ensureQuestLayer();
      renderQuestMarkers();
      startWtfEnhancementObserver();
      loadLiveQuestMarkers();
    },
    setPinnedQuests(questNames = []) {
      wtfOverlayState.questPins.clear();
      for (const questName of Array.isArray(questNames) ? questNames : []) {
        const name = resolveCanonicalQuestName(questName);
        const key = normalizeQuestName(name);
        if (key) wtfOverlayState.questPins.set(key, name);
      }
      addNativeQuestCheckboxes();
      syncQuestRequirementsPanel();
      renderQuestMarkers();
      if (wtfOverlayState.questPins.size) forceNativeQuestFilterOff();
      loadLiveQuestMarkers();
    },
    debugSnapshot() {
      return {
        map: wtfOverlayState.quest.map,
        source: wtfOverlayState.liveQuestSource,
        error: wtfOverlayState.liveQuestError,
        availableMarkers: wtfOverlayState.quest.markers.length,
        pinnedQuests: wtfOverlayState.questPins.size,
        pinnedQuestUids: getPinnedQuestUids().size,
        renderedMarkers: document.querySelectorAll('.wtf-quest-marker').length
      };
    }
  };

  window.__wtfSquadOverlay = {
    configure(snapshot = {}) {
      wtfOverlayState.squad = {
        map: String(snapshot.map || ''),
        members: Array.isArray(snapshot.members) ? snapshot.members : []
      };
      installWtfOverlayStyles();
      ensureSquadLayer();
      renderSquadMarkers();
      startWtfEnhancementObserver();
    }
  };

  window.__wtfPingOverlay = {
    configure(snapshot = {}) {
      wtfOverlayState.pings = {
        map: String(snapshot.map || ''),
        pings: Array.isArray(snapshot.pings) ? snapshot.pings : []
      };
      wtfOverlayState.pingsVisible = snapshot.visible !== false;
      installWtfOverlayStyles();
      ensurePingLayer();
      renderPingMarkers();
      ensurePingControl();
      ensureClearPingsButton();
      startWtfEnhancementObserver();
    }
  };

  window.__wtfRouteOverlay = {
    configure(snapshot = {}) {
      wtfOverlayState.route = {
        map: String(snapshot.map || ''),
        nodes: Array.isArray(snapshot.nodes) ? snapshot.nodes.slice(0, 200) : [],
        maxNodes: Math.min(40, Math.max(1, Number(snapshot.maxNodes) || 40)),
        localNodeCount: Math.max(0, Number(snapshot.localNodeCount) || 0)
      };
      wtfOverlayState.routeVisible = snapshot.visible !== false;
      installWtfOverlayStyles();
      ensureRouteLayer();
      renderRouteNodes();
      ensureRouteControl();
      ensureClearRouteButton();
      installFloorEvents();
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
