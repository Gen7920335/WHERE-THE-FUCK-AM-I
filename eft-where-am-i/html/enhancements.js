(() => {
  if (window.__wtfEnhancementsInstalled) return;
  window.__wtfEnhancementsInstalled = true;

  const state = {
    language: 'en',
    uiScale: 1,
    fontScale: 1,
    iconScale: 1,
    popupOpacity: 1,
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

  const applyDomScale = () => {
    const root = document.documentElement;
    if (!root) return;
    root.style.fontSize = `${state.fontScale * 100}%`;
    root.style.setProperty('--wtf-ui-scale', String(state.uiScale));
    root.style.setProperty('--wtf-font-scale', String(state.fontScale));
    root.style.setProperty('--wtf-icon-scale', String(state.iconScale));
    root.style.setProperty('--wtf-popup-opacity', String(state.popupOpacity));

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
        [data-wtf-commercial-hidden="true"] {
          display: none !important;
          pointer-events: none !important;
          visibility: hidden !important;
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
    state.language = String(settings.language || 'en').toLowerCase();
    state.uiScale = clamp(settings.uiScale, 0.65, 2, 1);
    state.fontScale = clamp(settings.fontScale, 0.5, 1.5, 1);
    state.iconScale = clamp(settings.iconScale, 0.5, 6.5, 1);
    state.popupOpacity = clamp(settings.popupOpacity, 0.3, 1, 1);
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
    battlePass: { map: '', markers: [] },
    battlePassVisible: false,
    battlePassLayer: null,
    battlePassPopup: null,
    battlePassPopupMarker: null,
    battlePassPhotoIndex: 0,
    floorEventsInstalled: false,
    squad: { map: '', members: [] },
    squadLayer: null,
    mapWrap: null,
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
    questTranslations: new Map(),
    updateFrame: 0,
    hydrateFrame: 0
  };

  window.__wtfSetQuestTranslations = (translations = {}) => {
    wtfOverlayState.questTranslations = new Map(Object.entries(translations || {}));
    renderQuestRequirementsPanel();
  };

  const isKoreanQuestMode = () => state.language === 'ko' || state.language.startsWith('ko-');

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

  const translateEliminationTargetKo = (value) => {
    let target = String(value || '').trim();
    const locationMatch = target.match(/^(.+?)\s+(?:on|in)\s+(.+?)(?=\s+while\s+|$)/i);
    if (locationMatch) {
      const remainder = target.slice(locationMatch[0].length).trim();
      target = `${locationMatch[2]}에서 ${locationMatch[1]}${remainder ? ` ${remainder}` : ''}`;
    }
    target = target
      .replace(/\s+while using\s+(.+)$/i, ' — $1 사용 중')
      .replace(/\s+while wearing\s+(.+)$/i, ' — $1 착용 중')
      .replace(/\s+without wearing\s+(.+)$/i, ' — $1 미착용')
      .replace(/\s+with (?:a )?headshots?$/i, ' — 헤드샷으로')
      .replace(/\s+from (?:a )?distance of (?:more than|over)\s+(.+)$/i, ' — $1 초과 거리에서')
      .replace(/\s+during (?:the )?night(?:time)?$/i, ' — 야간에');
    return target;
  };

  const fallbackQuestStepKo = (source, section) => {
    let text = String(source || '').replace(/\s+/g, ' ').trim().replace(/[.;]$/, '');
    if (!text) return text;

    const optional = /^\[?optional\]?[:\s-]*/i.test(text);
    text = text.replace(/^\[?optional\]?[:\s-]*/i, '');
    const finish = (value) => optional ? `${value} (선택)` : value;
    let match;

    if (section === 'requirements') {
      if ((match = text.match(/^After (?:taking|accepting):?\s*(.+)$/i))) return `${match[1]} 수락 후`;
      if ((match = text.match(/^After completing:?\s*(.+)$/i))) return `${match[1]} 완료 후`;
      if ((match = text.match(/^If failed:?\s*(.+)$/i))) return `${match[1]} 실패 시`;
      if ((match = text.match(/^(?:Completed|Complete):?\s*(.+)$/i))) return `${match[1]} 완료 필요`;
      if ((match = text.match(/^One of:?\s*(.+)$/i))) return `다음 중 하나 필요: ${match[1]}`;
      if ((match = text.match(/^Player level\s+(.+)$/i))) return `플레이어 레벨 ${match[1]} 필요`;
      if ((match = text.match(/^Loyalty level\s+(.+)\s+with\s+(.+)$/i))) return `${match[2]} 우호도 레벨 ${match[1]} 필요`;
    }

    if ((match = text.match(/^Find and hand over\s+(.+?)\s+in raid$/i))) return finish(`레이드에서 ${match[1]} 찾아 건네주기`);
    if ((match = text.match(/^Find and hand over\s+(.+)$/i))) return finish(`${match[1]} 찾아 건네주기`);
    if ((match = text.match(/^Hand over the found in raid item:?\s*(.+)$/i))) return finish(`레이드에서 발견한 ${match[1]} 건네주기`);
    if ((match = text.match(/^Hand over\s+(.+)$/i))) return finish(`${match[1]} 건네주기`);
    if ((match = text.match(/^Find\s+(.+?)\s+in raid$/i))) return finish(`레이드에서 ${match[1]} 찾기`);
    if ((match = text.match(/^Find\s+(.+)$/i))) return finish(`${match[1]} 찾기`);
    if ((match = text.match(/^(?:Obtain|Acquire|Get)\s+(.+)$/i))) return finish(`${match[1]} 획득하기`);
    if ((match = text.match(/^Survive and extract from\s+(.+)$/i))) return finish(`${match[1]}에서 생존하여 탈출하기`);
    if ((match = text.match(/^(?:Extract|Evacuate) from\s+(.+)$/i))) return finish(`${match[1]}에서 탈출하기`);
    if ((match = text.match(/^Use the transit from\s+(.+?)\s+to\s+(.+)$/i))) return finish(`${match[1]}에서 ${match[2]}로 가는 환승 이용하기`);
    if ((match = text.match(/^Locate and mark\s+(.+?)\s+with\s+(.+?)(?:\s+(?:on|in)\s+(.+))?$/i))) {
      return finish(`${match[3] ? `${match[3]}에서 ` : ''}${match[1]} 찾아 ${match[2]}로 표식하기`);
    }
    if ((match = text.match(/^Mark\s+(.+?)\s+with\s+(.+)$/i))) return finish(`${match[1]}에 ${match[2]}로 표식하기`);
    if ((match = text.match(/^Locate\s+(.+?)\s+(?:on|in)\s+(.+)$/i))) return finish(`${match[2]}에서 ${match[1]} 위치 확인하기`);
    if ((match = text.match(/^(?:Locate|Discover)\s+(.+)$/i))) return finish(`${match[1]} 위치 확인하기`);
    if ((match = text.match(/^Visit\s+(.+)$/i))) return finish(`${match[1]} 방문하기`);
    if ((match = text.match(/^(?:Eliminate|Kill)\s+(.+)$/i))) return finish(`${translateEliminationTargetKo(match[1])} 처치하기`);
    if ((match = text.match(/^Plant\s+(.+?)\s+(?:at|in|on)\s+(.+)$/i))) return finish(`${match[2]}에 ${match[1]} 설치하기`);
    if ((match = text.match(/^Stash\s+(.+?)\s+(?:at|in|on)\s+(.+)$/i))) return finish(`${match[2]}에 ${match[1]} 숨겨두기`);
    if ((match = text.match(/^Place\s+(.+?)\s+(?:at|in|on)\s+(.+)$/i))) return finish(`${match[2]}에 ${match[1]} 놓기`);
    if ((match = text.match(/^(?:Retrieve|Recover)\s+(.+)$/i))) return finish(`${match[1]} 회수하기`);
    if ((match = text.match(/^(?:Deliver|Turn in)\s+(.+)$/i))) return finish(`${match[1]} 전달하기`);
    if ((match = text.match(/^Reach\s+(.+)$/i))) return finish(`${match[1]} 달성하기`);
    if ((match = text.match(/^Complete\s+(.+)$/i))) return finish(`${match[1]} 완료하기`);
    if ((match = text.match(/^Talk to\s+(.+)$/i))) return finish(`${match[1]}에게 말 걸기`);
    if ((match = text.match(/^Activate\s+(.+)$/i))) return finish(`${match[1]} 작동시키기`);
    if ((match = text.match(/^Unlock\s+(.+)$/i))) return finish(`${match[1]} 잠금 해제하기`);
    if ((match = text.match(/^Use\s+(.+)$/i))) return finish(`${match[1]} 사용하기`);
    return finish(text);
  };

  const translateQuestStep = (text, section) => {
    const source = String(text || '').replace(/\s+/g, ' ').trim();
    if (!isKoreanQuestMode() || !source) return source;
    const official = wtfOverlayState.questTranslations.get(source);
    return official || fallbackQuestStepKo(source, section);
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
      #wtf-battle-pass-control {
        cursor: pointer;
        user-select: none;
      }
      .map-popup {
        opacity: var(--wtf-popup-opacity, 1) !important;
      }
      .wtf-battle-pass-icon-wrap {
        align-items: center;
        display: inline-flex !important;
        height: 20px;
        justify-content: center;
        width: 20px;
      }
      .wtf-battle-pass-icon-wrap .wtf-blue-cross {
        height: 13px;
        width: 13px;
      }
      .wtf-battle-pass-icon-wrap .wtf-blue-cross::before {
        height: 13px;
        left: 5px;
        width: 3px;
      }
      .wtf-battle-pass-icon-wrap .wtf-blue-cross::after {
        height: 3px;
        top: 5px;
        width: 13px;
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
        cursor: pointer;
        height: 14px;
        left: 0;
        pointer-events: auto !important;
        position: absolute;
        top: 0;
        transform: translate(-50%, -50%) scale(var(--wtf-icon-scale, 1));
        transform-origin: center;
        user-select: none;
        width: 14px;
      }
      .wtf-battle-pass-marker.wtf-other-floor {
        opacity: 0.35;
      }
      .wtf-battle-pass-marker:focus-visible {
        outline: 2px solid #e5b35c;
        outline-offset: 4px;
      }
      .wtf-battle-pass-popup.map-popup {
        box-sizing: border-box;
        margin: 0;
        pointer-events: auto;
        position: absolute;
        transform: translateX(calc(-50% - 10px)) translateY(calc(-100% - 24px));
        transform-origin: calc(50% + 10px) calc(100% + 24px);
        z-index: 30;
      }
      .wtf-battle-pass-popup[hidden] {
        display: none !important;
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
      .map-popup:not(.wtf-battle-pass-popup) .large.pointer.text-right {
        display: none !important;
      }
      .wtf-battle-pass-title {
        padding-right: 4px;
      }
      .wtf-battle-pass-details {
        white-space: normal;
      }
      .wtf-battle-pass-photo-frame {
        background: #111;
        margin-top: 10px;
        min-height: 180px;
        overflow: hidden;
        position: relative;
      }
      .wtf-battle-pass-photo {
        display: block;
        height: auto;
        max-height: min(52vh, 520px);
        object-fit: contain;
        width: 100%;
      }
      .wtf-battle-pass-photo-nav {
        display: flex;
        inset: 0;
        justify-content: space-between;
        pointer-events: none;
        position: absolute;
      }
      .wtf-battle-pass-photo-nav button {
        background: linear-gradient(90deg, rgba(0, 0, 0, .72), transparent) !important;
        border: 0 !important;
        color: #e5b35c !important;
        cursor: pointer;
        font-size: 28px !important;
        min-width: 42px !important;
        opacity: .75;
        padding: 0 8px !important;
        pointer-events: auto;
      }
      .wtf-battle-pass-photo-nav button:last-child {
        background: linear-gradient(270deg, rgba(0, 0, 0, .72), transparent) !important;
      }
      .wtf-battle-pass-photo-nav button:hover {
        opacity: 1;
      }
      .wtf-battle-pass-photo-meta {
        align-items: center;
        display: flex;
        gap: 8px;
        justify-content: space-between;
        padding-top: 6px;
      }
      .wtf-battle-pass-photo-source {
        color: #a49d90 !important;
        font-size: 11px;
        text-decoration: none;
      }
      .wtf-battle-pass-photo-source:hover {
        color: #e5b35c !important;
      }
      .wtf-battle-pass-photo-empty {
        align-items: center;
        color: #a49d90;
        display: flex;
        justify-content: center;
        min-height: 180px;
        padding: 20px;
        text-align: center;
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
    const leftPanelRect = document.querySelector('.panel_left')?.getBoundingClientRect();
    const rightPanelRect = document.querySelector('.panel_right')?.getBoundingClientRect();
    const leftBoundary = leftPanelRect?.width > 0 ? leftPanelRect.right + 10 : 10;
    const rightBoundary = rightPanelRect?.width > 0 ? rightPanelRect.left - 10 : window.innerWidth - 10;
    const centerWidth = Math.max(260, rightBoundary - leftBoundary);
    const width = Math.min(layout.width, mode === 'bottom' ? centerWidth : Math.max(260, window.innerWidth - 20));
    const dockTop = rightPanelRect?.height > 0 ? Math.max(10, rightPanelRect.top) : 72;
    const height = Math.min(layout.height, Math.max(120, window.innerHeight - dockTop - 10));

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
      panel.style.bottom = '10px';
      panel.style.transform = 'translateX(-50%)';
    } else if (mode === 'floating') {
      const x = Math.min(Math.max(0, layout.x), Math.max(0, window.innerWidth - width));
      const y = Math.min(Math.max(0, layout.y), Math.max(0, window.innerHeight - (layout.collapsed ? 34 : height)));
      layout.x = x;
      layout.y = y;
      panel.style.left = `${x}px`;
      panel.style.top = `${y}px`;
    } else {
      panel.style.right = rightPanelRect?.width > 0
        ? `${Math.max(10, window.innerWidth - rightPanelRect.left + 10)}px`
        : '10px';
      panel.style.top = `${dockTop}px`;
    }

    panel.querySelector('[data-dock="right"]')?.classList.toggle('wtf-active', mode === 'right');
    panel.querySelector('[data-dock="bottom"]')?.classList.toggle('wtf-active', mode === 'bottom');
    const collapseButton = panel.querySelector('[data-action="collapse"]');
    if (collapseButton) {
      collapseButton.textContent = layout.collapsed ? '+' : '−';
      collapseButton.title = layout.collapsed ? questPanelCopy('expand') : questPanelCopy('collapse');
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
      iframe.src = `/progression/quests?quest=${encodeURIComponent(quest.id)}`;
    });

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const frameDocument = iframe.contentDocument;
      const objectivesRoot = frameDocument?.querySelector('.quest .objectives');
      if (objectivesRoot) {
        const headings = [...objectivesRoot.querySelectorAll('.title')];
        const getList = (label) => {
          const heading = headings.find((element) => element.textContent.trim() === label);
          const list = heading?.nextElementSibling?.matches('ul')
            ? heading.nextElementSibling
            : heading?.parentElement?.querySelector('ul.list');
          return [...(list?.querySelectorAll(':scope > li') || [])]
            .map(normalizeQuestStepText)
            .filter(Boolean);
        };
        return {
          requirements: getList('Requirements'),
          objectives: getList('Objectives')
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

  const appendQuestRequirementsSection = (card, label, items, emptyText, sectionKind) => {
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
        row.textContent = translateQuestStep(item, sectionKind);
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
      name.textContent = quest.name;
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
          questPanelCopy('noPrerequisites'),
          'requirements');
        appendQuestRequirementsSection(
          card,
          questPanelCopy('objectives'),
          details.objectives || [],
          questPanelCopy('noObjectives'),
          'objectives');
      }
      body.appendChild(card);
    }
    applyQuestRequirementsPanelLayout();
  };

  const syncQuestRequirementsPanel = () => {
    const quests = [...document.querySelectorAll('div.items.scroll div.no-wrap.d-flex.selected[data-quest-uid]')]
      .map((row) => ({
        id: row.dataset.questUid || '',
        name: getQuestNameElement(row)?.textContent?.trim() || 'Quest'
      }))
      .filter((quest) => quest.id);
    const key = quests.map((quest) => `${quest.id}:${quest.name}`).join('|');
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

    setTimeout(() => {
      syncNativeQuestCheckbox(row, checkbox);
      syncQuestRequirementsPanel();
    }, 120);
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

  const ensureTerminalBattlePassControl = (lootItems) => {
    let control = document.getElementById('wtf-battle-pass-control');
    if (!control || control.parentElement !== lootItems || control.tagName !== 'DIV') {
      control?.remove();
      control = document.createElement('div');
      control.id = 'wtf-battle-pass-control';
      control.className = 'terminal-filter-row';
      control.tabIndex = 0;
      control.setAttribute('role', 'checkbox');
      control.title = 'Toggle Battle Pass document spawns';

      const toggle = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setBattlePassVisible(!wtfOverlayState.battlePassVisible, true);
      };
      control.addEventListener('click', toggle);
      control.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') toggle(event);
      });

      const main = document.createElement('span');
      main.className = 'terminal-filter-main';
      const iconWrap = document.createElement('span');
      iconWrap.className = 'terminal-filter-icon wtf-battle-pass-icon-wrap';
      const icon = document.createElement('span');
      icon.className = 'wtf-blue-cross';
      icon.setAttribute('aria-hidden', 'true');
      iconWrap.appendChild(icon);
      const name = document.createElement('span');
      name.className = 'terminal-filter-name';
      name.textContent = 'Battle Pass';
      main.append(iconWrap, name);

      const count = document.createElement('span');
      count.className = 'terminal-filter-count';
      count.dataset.wtfBattlePassCount = '';
      control.append(main, count);
      lootItems.appendChild(control);
    }

    const count = control.querySelector('[data-wtf-battle-pass-count]');
    const countText = String(wtfOverlayState.battlePass.markers?.length || 0);
    if (count && count.textContent !== countText) count.textContent = countText;
    if (control !== lootItems.lastElementChild) lootItems.appendChild(control);
    control.classList.toggle('selected', wtfOverlayState.battlePassVisible);
    control.classList.toggle('active', wtfOverlayState.battlePassVisible);
    control.classList.toggle('inactive', !wtfOverlayState.battlePassVisible);
    control.setAttribute('aria-checked', wtfOverlayState.battlePassVisible ? 'true' : 'false');
  };

  const ensureBattlePassControl = () => {
    const leftPanel = document.querySelector('.panel_left');
    if (!leftPanel) return;

    const terminalLootItems = leftPanel.querySelector('.terminal-filter-section[data-section="loot"] .terminal-filter-items');
    if (terminalLootItems) {
      ensureTerminalBattlePassControl(terminalLootItems);
      return;
    }

    const lootTitle = [...leftPanel.querySelectorAll('.two-columns > .mb-5 > div:first-child > .bold')]
      .find((element) => element.textContent.trim().toLowerCase() === 'loot');
    const lootItems = lootTitle?.parentElement?.nextElementSibling;
    if (!lootItems?.classList.contains('items')) return;

    const scopeAttributes = [...((lootItems.firstElementChild || lootTitle).attributes || [])]
      .filter((attribute) => attribute.name.startsWith('data-v-'))
      .map((attribute) => attribute.name);
    const applyScope = (element) => {
      for (const attribute of scopeAttributes) element.setAttribute(attribute, '');
      return element;
    };

    let control = document.getElementById('wtf-battle-pass-control');
    if (!control || control.parentElement !== lootItems || control.tagName !== 'DIV') {
      control?.remove();
      control = applyScope(document.createElement('div'));
      control.id = 'wtf-battle-pass-control';
      control.className = 'd-flex h-space-between mb-5 no-wrap inactive';
      control.tabIndex = 0;
      control.setAttribute('role', 'checkbox');
      control.title = 'Toggle Battle Pass document spawns';

      const toggle = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setBattlePassVisible(!wtfOverlayState.battlePassVisible, true);
      };
      control.addEventListener('click', toggle);
      control.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') toggle(event);
      });

      const label = applyScope(document.createElement('span'));
      label.className = 'd-flex';
      const iconWrap = applyScope(document.createElement('div'));
      iconWrap.className = 'fs-0 wtf-battle-pass-icon-wrap';
      const icon = document.createElement('span');
      icon.className = 'wtf-blue-cross';
      icon.setAttribute('aria-hidden', 'true');
      iconWrap.appendChild(icon);
      label.append(iconWrap, document.createTextNode(' Battle Pass'));

      const count = applyScope(document.createElement('span'));
      count.className = 'sub alt';
      count.dataset.wtfBattlePassCount = '';
      count.textContent = String(wtfOverlayState.battlePass.markers?.length || 0);

      control.append(label, document.createTextNode('\u00a0 '), count);
      lootItems.appendChild(control);
    } else {
      const count = control.querySelector('[data-wtf-battle-pass-count]');
      const countText = String(wtfOverlayState.battlePass.markers?.length || 0);
      if (count && count.textContent !== countText) count.textContent = countText;
      if (control !== lootItems.lastElementChild) lootItems.appendChild(control);
    }
    control.classList.toggle('active', wtfOverlayState.battlePassVisible);
    control.classList.toggle('inactive', !wtfOverlayState.battlePassVisible);
    control.setAttribute('aria-checked', wtfOverlayState.battlePassVisible ? 'true' : 'false');
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

  const applyNativePopupScope = (element) => {
    element.setAttribute('data-v-6c75efb4', '');
    return element;
  };

  const closeBattlePassPopup = () => {
    if (wtfOverlayState.battlePassPopup) {
      wtfOverlayState.battlePassPopup.hidden = true;
      wtfOverlayState.battlePassPopup.replaceChildren();
    }
    wtfOverlayState.battlePassPopupMarker = null;
    wtfOverlayState.battlePassPhotoIndex = 0;
  };

  const updateBattlePassPopupPosition = () => {
    const popup = wtfOverlayState.battlePassPopup;
    const marker = wtfOverlayState.battlePassPopupMarker;
    if (!popup?.isConnected || popup.hidden || !marker?.isConnected) return;
    popup.style.left = marker.style.left;
    popup.style.top = marker.style.top;
  };

  const createBattlePassPhotoView = (markerData) => {
    const photos = Array.isArray(markerData.photos) ? markerData.photos : [];
    const frame = applyNativePopupScope(document.createElement('div'));
    frame.className = 'wtf-battle-pass-photo-frame';

    if (!photos.length) {
      const empty = applyNativePopupScope(document.createElement('div'));
      empty.className = 'wtf-battle-pass-photo-empty';
      empty.textContent = state.language === 'ko'
        ? '이 지점에 직접 연결된 검증 사진이 아직 없습니다.'
        : 'No verified photo is linked to this spawn yet.';
      frame.appendChild(empty);
      return frame;
    }

    const photoIndex = Math.min(Math.max(0, wtfOverlayState.battlePassPhotoIndex), photos.length - 1);
    wtfOverlayState.battlePassPhotoIndex = photoIndex;
    const photoData = photos[photoIndex] || {};
    const image = applyNativePopupScope(document.createElement('img'));
    image.className = 'wtf-battle-pass-photo';
    image.src = String(photoData.url || '');
    image.alt = String(photoData.caption || markerData.title || 'Battle Pass spawn');
    image.addEventListener('error', () => {
      image.hidden = true;
      const error = applyNativePopupScope(document.createElement('div'));
      error.className = 'wtf-battle-pass-photo-empty';
      error.textContent = state.language === 'ko'
        ? '사진을 불러오지 못했습니다.'
        : 'The photo could not be loaded.';
      frame.appendChild(error);
    }, { once: true });
    frame.appendChild(image);

    if (photos.length > 1) {
      const nav = applyNativePopupScope(document.createElement('div'));
      nav.className = 'wtf-battle-pass-photo-nav';
      const previous = applyNativePopupScope(document.createElement('button'));
      previous.type = 'button';
      previous.textContent = '‹';
      previous.title = state.language === 'ko' ? '이전 사진' : 'Previous photo';
      previous.addEventListener('click', (event) => {
        event.stopPropagation();
        wtfOverlayState.battlePassPhotoIndex = (photoIndex - 1 + photos.length) % photos.length;
        renderBattlePassPopup(markerData);
      });
      const next = applyNativePopupScope(document.createElement('button'));
      next.type = 'button';
      next.textContent = '›';
      next.title = state.language === 'ko' ? '다음 사진' : 'Next photo';
      next.addEventListener('click', (event) => {
        event.stopPropagation();
        wtfOverlayState.battlePassPhotoIndex = (photoIndex + 1) % photos.length;
        renderBattlePassPopup(markerData);
      });
      nav.append(previous, next);
      frame.appendChild(nav);
    }
    return frame;
  };

  const renderBattlePassPopup = (markerData) => {
    const popup = wtfOverlayState.battlePassPopup;
    if (!popup) return;
    popup.replaceChildren();

    const inner = applyNativePopupScope(document.createElement('div'));
    inner.className = 'inner';
    const header = applyNativePopupScope(document.createElement('div'));
    header.className = 'd-flex h-space-between v-start';
    const titleWrap = applyNativePopupScope(document.createElement('div'));
    titleWrap.className = 'w-100';
    const title = applyNativePopupScope(document.createElement('div'));
    title.className = 'title wtf-battle-pass-title';
    title.textContent = String(markerData.title || 'Battle Pass document');
    titleWrap.appendChild(title);

    const close = applyNativePopupScope(document.createElement('button'));
    close.type = 'button';
    close.className = 'wtf-popup-close';
    close.textContent = '×';
    close.title = state.language === 'ko' ? '닫기' : 'Close';
    close.setAttribute('aria-label', close.title);
    close.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeBattlePassPopup();
    });
    header.append(titleWrap, close);

    const details = applyNativePopupScope(document.createElement('div'));
    details.className = 'wtf-battle-pass-details';
    details.textContent = String(markerData.details || '');
    inner.append(header, details, createBattlePassPhotoView(markerData));

    const photos = Array.isArray(markerData.photos) ? markerData.photos : [];
    const meta = applyNativePopupScope(document.createElement('div'));
    meta.className = 'wtf-battle-pass-photo-meta';
    const counter = applyNativePopupScope(document.createElement('span'));
    counter.className = 'sub alt';
    counter.textContent = photos.length
      ? `${wtfOverlayState.battlePassPhotoIndex + 1} / ${photos.length}`
      : '0 / 0';
    const source = applyNativePopupScope(document.createElement('a'));
    source.className = 'wtf-battle-pass-photo-source';
    source.href = String(markerData.photoSourceUrl || 'https://github.com/Perofunyang/battlepass_interactive_map');
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = state.language === 'ko' ? '사진 출처' : 'Photo source';
    meta.append(counter, source);
    inner.appendChild(meta);
    popup.appendChild(inner);
    popup.hidden = false;
    updateBattlePassPopupPosition();
  };

  const ensureBattlePassPopup = () => {
    const mapContainer = document.querySelector('.map-cont');
    if (!mapContainer) return null;
    let popup = wtfOverlayState.battlePassPopup;
    if (!popup?.isConnected || popup.parentElement !== mapContainer) {
      popup?.remove();
      popup = applyNativePopupScope(document.createElement('div'));
      popup.className = 'map-popup wtf-battle-pass-popup';
      popup.hidden = true;
      popup.setAttribute('role', 'dialog');
      popup.addEventListener('pointerdown', (event) => event.stopPropagation());
      popup.addEventListener('mousedown', (event) => event.stopPropagation());
      popup.addEventListener('click', (event) => event.stopPropagation());
      mapContainer.appendChild(popup);
      wtfOverlayState.battlePassPopup = popup;
    }
    return popup;
  };

  const openBattlePassPopup = (markerData, marker) => {
    ensureBattlePassPopup();
    wtfOverlayState.battlePassPopupMarker = marker;
    wtfOverlayState.battlePassPhotoIndex = 0;
    renderBattlePassPopup(markerData);
  };

  const ensureNativeQuestPopupCloseButton = () => {
    for (const popup of document.querySelectorAll('.map-popup:not(.wtf-battle-pass-popup)')) {
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

    for (const marker of document.querySelectorAll('.wtf-battle-pass-marker, .wtf-squad-marker')) {
      if (marker.parentElement !== overlay && marker.parentElement !== wtfOverlayState.squadLayer) continue;
      const localX = (Number(marker.dataset.left) / 100) * width;
      const localY = (Number(marker.dataset.top) / 100) * height;
      const relativeX = localX - originX;
      const relativeY = localY - originY;
      marker.style.left = (layout.left + originX + (matrix.a * relativeX) + (matrix.c * relativeY) + matrix.e) + 'px';
      marker.style.top = (layout.top + originY + (matrix.b * relativeX) + (matrix.d * relativeY) + matrix.f) + 'px';
    }
    updateBattlePassPopupPosition();
  };

  const scheduleBattlePassPositionUpdate = () => {
    if (wtfOverlayState.updateFrame) return;
    wtfOverlayState.updateFrame = requestAnimationFrame(updateBattlePassPositions);
  };

  const readFloorLevel = (input) => {
    if (!input) return null;
    const text = [
      input.getAttribute('aria-label'),
      input.value,
      input.closest('label')?.textContent,
      input.parentElement?.textContent
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

    if (/\b(?:basement|bunker|underground)\b/i.test(text)) return 0;
    if (/\b(?:main|ground)\b/i.test(text)) return 1;
    const levelMatch = text.match(/\blevel\s*([1-5])\b/i);
    if (levelMatch) return Number(levelMatch[1]);
    const shortMatch = text.match(/\b([1-5])\s*(?:f|층)\b/i);
    return shortMatch ? Number(shortMatch[1]) : null;
  };

  const updateBattlePassFloorOpacity = () => {
    const floorInputs = Array.from(document.querySelectorAll('.no-wrap input[name="layers"]'));
    const selectedInput = floorInputs.find((input) => input.checked || input.getAttribute('aria-checked') === 'true');
    const selectedFloor = floorInputs.length > 1 ? readFloorLevel(selectedInput) : null;

    for (const marker of document.querySelectorAll('.wtf-battle-pass-marker')) {
      const markerFloor = Number(marker.dataset.floor);
      const isOtherFloor = selectedFloor !== null
        && Number.isFinite(markerFloor)
        && markerFloor !== selectedFloor;
      marker.classList.toggle('wtf-other-floor', isOtherFloor);
    }
  };

  const installFloorEvents = () => {
    if (wtfOverlayState.floorEventsInstalled) return;
    wtfOverlayState.floorEventsInstalled = true;
    document.addEventListener('change', (event) => {
      if (event.target instanceof Element && event.target.matches('.no-wrap input[name="layers"]')) {
        requestAnimationFrame(updateBattlePassFloorOpacity);
      }
    });
    document.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('.no-wrap input[name="layers"], .no-wrap label')) {
        requestAnimationFrame(updateBattlePassFloorOpacity);
      }
    });
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
    closeBattlePassPopup();
    overlay.replaceChildren();
    overlay.hidden = !wtfOverlayState.battlePassVisible;

    for (const markerData of wtfOverlayState.battlePass.markers || []) {
      const marker = document.createElement('div');
      marker.className = 'wtf-battle-pass-marker';
      marker.dataset.left = String(markerData.left);
      marker.dataset.top = String(markerData.top);
      marker.dataset.elevation = String(markerData.elevation ?? '');
      marker.dataset.floor = String(markerData.floor ?? '');
      marker.title = [markerData.title, markerData.details].filter(Boolean).join(' · ');
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
        openBattlePassPopup(markerData, marker);
      });
      marker.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        openBattlePassPopup(markerData, marker);
      });

      const cross = document.createElement('span');
      cross.className = 'wtf-blue-cross';
      cross.setAttribute('aria-hidden', 'true');
      marker.appendChild(cross);
      overlay.appendChild(marker);
    }
    updateBattlePassFloorOpacity();
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
    scheduleBattlePassPositionUpdate();
  };

  const ensureSquadLayer = () => {
    const mapContainer = document.querySelector('.map-cont');
    const mapWrap = mapContainer?.querySelector('.map-wrap');
    if (!mapContainer || !mapWrap) return false;
    if (!wtfOverlayState.squadLayer?.isConnected || wtfOverlayState.squadLayer.parentElement !== mapContainer) {
      wtfOverlayState.squadLayer?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'wtf-squad-layer';
      overlay.setAttribute('aria-hidden', 'true');
      mapContainer.appendChild(overlay);
      wtfOverlayState.squadLayer = overlay;
      renderSquadMarkers();
    }
    observeMapTransform(mapContainer, mapWrap);
    return true;
  };

  const setBattlePassVisible = (visible, notifyHost) => {
    wtfOverlayState.battlePassVisible = Boolean(visible);
    if (wtfOverlayState.battlePassLayer) {
      wtfOverlayState.battlePassLayer.hidden = !wtfOverlayState.battlePassVisible;
    }
    if (!wtfOverlayState.battlePassVisible) closeBattlePassPopup();
    const control = document.getElementById('wtf-battle-pass-control');
    if (control) {
      control.classList.toggle('active', wtfOverlayState.battlePassVisible);
      control.classList.toggle('inactive', !wtfOverlayState.battlePassVisible);
      control.classList.toggle('selected', wtfOverlayState.battlePassVisible);
      control.setAttribute('aria-checked', wtfOverlayState.battlePassVisible ? 'true' : 'false');
    }
    if (notifyHost) {
      window.chrome?.webview?.postMessage(JSON.stringify({
        action: 'battle-pass-toggle',
        checked: wtfOverlayState.battlePassVisible
      }));
    }
  };

  const hideCommercialAndPaidUi = () => {
    const hide = (element) => {
      if (!(element instanceof Element)) return;
      element.setAttribute('data-wtf-commercial-hidden', 'true');
      element.setAttribute('aria-hidden', 'true');
      if ('inert' in element) element.inert = true;
    };

    document.querySelectorAll([
      '.content.maps .head-pilot',
      '.content.maps .alert-box',
      '.panel_right > .user-layers-panel',
      '.panel_right > .squad-panel',
      '[class*="paywall" i]',
      '[class*="pro-only" i]',
      '[data-premium="true"]',
      '[data-pro-only="true"]'
    ].join(',')).forEach(hide);

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

      if (/^use your progress\s*[✘✕×x]?$/i.test(text)) {
        hide(element);
        hide(element.nextElementSibling);
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
    ensureBattlePassControl();
    ensureBattlePassLayer();
    ensureBattlePassPopup();
    ensureNativeQuestPopupCloseButton();
    ensureSquadLayer();
    updateBattlePassFloorOpacity();
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
    window.addEventListener('resize', applyQuestRequirementsPanelLayout, { passive: true });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && wtfOverlayState.battlePassPopup && !wtfOverlayState.battlePassPopup.hidden) {
        closeBattlePassPopup();
      }
    });
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
      installFloorEvents();
      ensureBattlePassControl();
      ensureBattlePassLayer();
      ensureBattlePassPopup();
      renderBattlePassMarkers();
      setBattlePassVisible(visible, false);
      startWtfEnhancementObserver();
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
