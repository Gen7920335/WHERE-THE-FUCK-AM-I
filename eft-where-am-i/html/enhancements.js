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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyDomScale, { once: true });
  } else {
    applyDomScale();
  }
})();
