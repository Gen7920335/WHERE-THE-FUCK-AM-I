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
    quest: { map: '', markers: [] },
    questPins: new Map(),
    liveQuestStore: null,
    liveQuestLoadPromise: null,
    liveQuestRetryTimer: 0,
    liveQuestSource: 'not-loaded',
    liveQuestError: '',
    questLayer: null,
    questPopup: null,
    questPopupMarker: null,
    nativeQuestFilterGuardId: 0,
    floorEventsInstalled: false,
    squad: { map: '', members: [] },
    squadLayer: null,
    pings: { map: '', pings: [] },
    pingsVisible: true,
    pingLayer: null,
    route: { map: '', nodes: [], maxNodes: 20, localNodeCount: 0 },
    routeVisible: true,
    routeLayer: null,
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
    normalizedQuestTranslations: new Map(),
    questNameTranslations: new Map(),
    reverseQuestNameTranslations: new Map(),
    questIdentityCache: new Map(),
    itemNameTranslations: new Map(),
    locationTranslations: new Map(),
    localizedTextOriginals: new WeakMap(),
    updateFrame: 0,
    hydrateFrame: 0
  };

  const tarkovMarketQuestIconPath = 'm253.943,502.885c-66.495,0-129.01-25.895-176.029-72.913C30.895,382.953,5,320.438,5,253.943S30.895,124.933,77.914,77.914,187.448,5,253.943,5s129.01,25.895,176.029,72.914c47.019,47.019,72.913,109.534,72.913,176.029s-25.895,129.01-72.913,176.029c-47.02,47.019-109.534,72.913-176.029,72.913Zm0-437.885c-104.184,0-188.943,84.759-188.943,188.943s84.759,188.942,188.943,188.942,188.942-84.759,188.942-188.942-84.759-188.943-188.942-188.943Zm40,289.2h-80v70h80v-70Zm0-269.75h-80v250.265h80V84.449Z';

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
    icebreaker: { width: 5000, height: 8400, zoom: 0.24, rotate: 90, xOffset: 2500, yOffset: 4200, ratio: 25 }
  };

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

  window.__wtfSetKoreanLocalization = (catalog = {}) => {
    wtfOverlayState.questTranslations = new Map(Object.entries(catalog.questSteps || {}));
    wtfOverlayState.normalizedQuestTranslations = buildNormalizedTranslationMap(catalog.questSteps || {});
    wtfOverlayState.questNameTranslations = new Map(Object.entries(catalog.questNames || {}));
    wtfOverlayState.reverseQuestNameTranslations = buildReverseQuestNameMap(catalog.questNames || {});
    wtfOverlayState.itemNameTranslations = new Map(Object.entries(catalog.itemNames || {}));
    wtfOverlayState.locationTranslations = new Map(Object.entries(catalog.locations || {}));
    migrateQuestPinsToCanonicalNames();
    localizeNativeGameNames();
    addNativeQuestCheckboxes();
    syncQuestRequirementsPanel();
    renderQuestRequirementsPanel();
    renderQuestMarkers();
  };

  window.__wtfSetQuestTranslations = (translations = {}) => {
    window.__wtfSetKoreanLocalization({ questSteps: translations });
  };

  const isKoreanQuestMode = () => state.language === 'ko' || state.language.startsWith('ko-');

  const normalizeQuestTranslationKey = (value) => String(value || '')
    .normalize('NFKC')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/×/g, 'x')
    .replace(/^\s*(?:[•·▪▫\-–—]|\d+[.)]|\d+\s*\/\s*\d+|\[[ x✓✔]\])\s*/i, '')
    .replace(/\(\s*x\s*(\d+)\s*\)/gi, '(x$1)')
    .replace(/\s+/g, ' ')
    .replace(/[.;]+$/, '')
    .trim()
    .toLowerCase();

  function buildNormalizedTranslationMap(translations) {
    const result = new Map();
    const collisions = new Set();
    for (const [english, korean] of Object.entries(translations || {})) {
      const key = normalizeQuestTranslationKey(english);
      if (!key || collisions.has(key)) continue;
      if (result.has(key) && result.get(key) !== korean) {
        result.delete(key);
        collisions.add(key);
      } else {
        result.set(key, korean);
      }
    }
    return result;
  }

  const bilingualGameName = (english, translations) => {
    const source = String(english || '').replace(/\s+/g, ' ').trim();
    if (!isKoreanQuestMode() || !source) return source;
    const korean = String(translations.get(source) || '').replace(/\s+/g, ' ').trim();
    if (!korean || korean.localeCompare(source, undefined, { sensitivity: 'accent' }) === 0) return source;
    return `${korean}(${source})`;
  };

  const formatQuestName = (english) => bilingualGameName(english, wtfOverlayState.questNameTranslations);
  const formatItemName = (english) => bilingualGameName(english, wtfOverlayState.itemNameTranslations);

  const questDetailUiKo = new Map(Object.entries({
    Requirements: '선행 조건',
    Prerequisites: '선행 조건',
    Objectives: '목표',
    'Current objectives': '현재 목표',
    Rewards: '보상',
    Experience: '경험치',
    Reputation: '우호도',
    Unlocks: '해금',
    'Previous quest': '이전 퀘스트',
    'Next quest': '다음 퀘스트',
    Trader: '상인',
    Map: '지도',
    Status: '상태',
    Level: '레벨',
    Optional: '선택',
    Completed: '완료',
    Failed: '실패',
    'Required for Kappa': 'Kappa 필수'
  }));

  const translateLocationNames = (value) => {
    let output = String(value || '');
    if (!isKoreanQuestMode()) return output;
    const pairs = [...wtfOverlayState.locationTranslations.entries()]
      .sort((left, right) => right[0].length - left[0].length);
    for (const [english, korean] of pairs) {
      if (output.trim() === english) return korean;
      output = output.replace(new RegExp(`\\b${english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), korean);
    }
    return output;
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
    const shorten = (value) => String(value || '')
      .replace(/살아서 탈출하기$/g, '생존 후 탈출')
      .replace(/생존하여 탈출하기$/g, '생존 후 탈출')
      .replace(/건네주기$/g, '전달')
      .replace(/전달하기$/g, '전달')
      .replace(/획득하기$/g, '획득')
      .replace(/찾아 건네주기$/g, '획득 후 전달')
      .replace(/찾기$/g, '획득')
      .replace(/처치하기$/g, '처치')
      .replace(/방문하기$/g, '이동')
      .replace(/위치 확인하기$/g, '이동')
      .replace(/설치하기$/g, '설치')
      .replace(/표식하기$/g, '표시')
      .replace(/숨겨두기$/g, '은닉')
      .replace(/놓기$/g, '배치')
      .replace(/회수하기$/g, '회수')
      .replace(/달성하기$/g, '달성')
      .replace(/완료하기$/g, '완료')
      .replace(/작동시키기$/g, '작동')
      .replace(/잠금 해제하기$/g, '잠금 해제')
      .replace(/사용하기$/g, '사용');
    const finish = (value) => optional ? `${shorten(value)} (선택)` : shorten(value);
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
    const official = wtfOverlayState.questTranslations.get(source)
      || wtfOverlayState.normalizedQuestTranslations.get(normalizeQuestTranslationKey(source));
    return official || translateLocationNames(fallbackQuestStepKo(source, section));
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
      .wtf-quest-marker:focus-visible {
        outline: 2px solid #e5b35c;
        outline-offset: 4px;
      }
      .wtf-quest-popup.map-popup {
        box-sizing: border-box;
        margin: 0;
        pointer-events: auto;
        position: absolute;
        transform: translateX(calc(-50% - 10px)) translateY(calc(-100% - 24px));
        transform-origin: calc(50% + 10px) calc(100% + 24px);
        z-index: 31;
      }
      .wtf-quest-popup[hidden] {
        display: none !important;
      }
      .wtf-quest-popup-objective {
        color: #d7d0c4;
        margin-top: 7px;
        white-space: normal;
      }
      .wtf-quest-popup-meta {
        color: #a49d90;
        font-size: 11px;
        margin-top: 6px;
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
      .map-popup:not(.wtf-quest-popup) .large.pointer.text-right {
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
        stroke-width: 1.5;
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
          requirements: getList(['Requirements', 'Prerequisites', '요구 사항', '선행 조건']),
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
    let identityChanged = false;
    for (const row of document.querySelectorAll('div.items.scroll div.no-wrap.d-flex[data-quest-uid]')) {
      const name = getCanonicalQuestName(row);
      const key = normalizeQuestName(name);
      const id = row.dataset.questUid || '';
      if (key && id) {
        const previous = wtfOverlayState.questIdentityCache.get(key);
        if (previous?.id !== id || previous?.name !== name) identityChanged = true;
        wtfOverlayState.questIdentityCache.set(key, { id, name });
      }
    }
    const quests = [...wtfOverlayState.questIdentityCache.entries()]
      .filter(([key]) => wtfOverlayState.questPins.has(key))
      .map(([, quest]) => quest);
    const key = quests.map((quest) => `${quest.id}:${quest.name}`).join('|');
    if (identityChanged) renderQuestMarkers();
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

  const getCanonicalQuestName = (row) => {
    const nameElement = getQuestNameElement(row);
    if (!nameElement) return '';
    if (!row.dataset.wtfQuestNameOriginal) {
      row.dataset.wtfQuestNameOriginal = nameElement.textContent?.replace(/\s+/g, ' ').trim() || '';
    }
    const canonical = resolveCanonicalQuestName(row.dataset.wtfQuestNameOriginal);
    if (canonical && canonical !== row.dataset.wtfQuestNameOriginal) {
      row.dataset.wtfQuestNameOriginal = canonical;
    }
    return canonical;
  };

  const localizeNativeQuestNames = () => {
    for (const row of document.querySelectorAll('div.items.scroll div.no-wrap.d-flex[data-quest-uid]')) {
      const nameElement = getQuestNameElement(row);
      if (!nameElement) continue;
      const original = getCanonicalQuestName(row);
      const display = formatQuestName(original);
      if (nameElement.textContent !== display) nameElement.textContent = display;
    }
  };

  const localizeNativeItemNames = () => {
    for (const element of document.querySelectorAll('a[href*="/item/"], [data-item-uid] a, [data-item-id] a')) {
      if (element.children.length) continue;
      if (!element.dataset.wtfItemNameOriginal) {
        element.dataset.wtfItemNameOriginal = element.textContent?.replace(/\s+/g, ' ').trim() || '';
      }
      const original = element.dataset.wtfItemNameOriginal;
      if (!original || !wtfOverlayState.itemNameTranslations.has(original)) continue;
      const display = formatItemName(original);
      if (element.textContent !== display) element.textContent = display;
    }
  };

  const localizeNativeLocationNames = () => {
    const selectors = [
      '.maps-list span',
      '.map-list span',
      '[data-map] span',
      '[data-location] span',
      'select option',
      '.locations span',
      '.location span'
    ].join(',');
    for (const element of document.querySelectorAll(selectors)) {
      if (element.children.length) continue;
      if (!element.dataset.wtfLocationOriginal) {
        element.dataset.wtfLocationOriginal = element.textContent?.replace(/\s+/g, ' ').trim() || '';
      }
      const original = element.dataset.wtfLocationOriginal;
      const display = isKoreanQuestMode() ? translateLocationNames(original) : original;
      if (display && element.textContent !== display) element.textContent = display;
    }
  };

  const localizeExactCatalogNames = () => {
    for (const element of document.querySelectorAll('body *:not(script):not(style):not(svg):not(path)')) {
      if (!(element instanceof HTMLElement) || element.childElementCount) continue;
      if (!element.dataset.wtfGameNameOriginal) {
        const candidate = element.textContent?.replace(/\s+/g, ' ').trim() || '';
        if (!wtfOverlayState.questNameTranslations.has(candidate)
          && !wtfOverlayState.itemNameTranslations.has(candidate)) continue;
        element.dataset.wtfGameNameOriginal = candidate;
      }
      const original = element.dataset.wtfGameNameOriginal;
      const display = wtfOverlayState.questNameTranslations.has(original)
        ? formatQuestName(original)
        : formatItemName(original);
      if (display && element.textContent !== display) element.textContent = display;
    }
  };

  const localizeNativeQuestDetailText = () => {
    if (!document.body) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    for (const textNode of textNodes) {
      const parent = textNode.parentElement;
      if (!parent || parent.closest('script, style, textarea, input, #wtf-quest-requirements-panel, .wtf-quest-popup')) continue;

      const savedOriginal = wtfOverlayState.localizedTextOriginals.get(textNode);
      if (!isKoreanQuestMode()) {
        if (savedOriginal !== undefined && textNode.nodeValue !== savedOriginal) textNode.nodeValue = savedOriginal;
        continue;
      }

      const raw = savedOriginal ?? String(textNode.nodeValue || '');
      const normalized = raw.replace(/\s+/g, ' ').trim();
      if (!normalized) continue;
      const prefixMatch = normalized.match(/^((?:[•·▪▫\-–—]|\d+[.)]|\d+\s*\/\s*\d+)\s+)/);
      const prefix = prefixMatch?.[1] || '';
      const source = prefix ? normalized.slice(prefix.length).trim() : normalized;
      let translated = '';
      if (wtfOverlayState.questTranslations.has(source)
        || wtfOverlayState.normalizedQuestTranslations.has(normalizeQuestTranslationKey(source))) {
        translated = translateQuestStep(source, 'objectives');
      } else if (wtfOverlayState.questNameTranslations.has(source)) {
        translated = formatQuestName(source);
      } else if (wtfOverlayState.itemNameTranslations.has(source)) {
        translated = formatItemName(source);
      } else if (wtfOverlayState.locationTranslations.has(source)) {
        translated = wtfOverlayState.locationTranslations.get(source) || '';
      } else if (questDetailUiKo.has(source)) {
        translated = questDetailUiKo.get(source) || '';
      }
      if (!translated) continue;

      if (savedOriginal === undefined) wtfOverlayState.localizedTextOriginals.set(textNode, raw);
      const leading = raw.match(/^\s*/)?.[0] || '';
      const trailing = raw.match(/\s*$/)?.[0] || '';
      const display = `${leading}${prefix}${translated}${trailing}`;
      if (textNode.nodeValue !== display) textNode.nodeValue = display;
    }
  };

  function localizeNativeGameNames() {
    localizeNativeQuestNames();
    localizeNativeItemNames();
    localizeNativeLocationNames();
    localizeExactCatalogNames();
    localizeNativeQuestDetailText();
  }

  const normalizeQuestName = (value) => String(value || '')
    .normalize('NFKC')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const buildReverseQuestNameMap = (translations) => {
    const reverse = new Map();
    for (const [english, localized] of Object.entries(translations || {})) {
      const key = normalizeQuestName(localized);
      if (!key) continue;
      const candidates = reverse.get(key) || [];
      if (!candidates.includes(english)) candidates.push(english);
      reverse.set(key, candidates);
    }
    return reverse;
  };

  const resolveCanonicalQuestName = (value) => {
    const source = String(value || '').replace(/\s+/g, ' ').trim();
    if (!source) return '';
    if (wtfOverlayState.questNameTranslations.has(source)) return source;

    const bilingualMatch = source.match(/\(([^()]*)\)\s*$/);
    const englishSuffix = bilingualMatch?.[1]?.trim() || '';
    if (englishSuffix && wtfOverlayState.questNameTranslations.has(englishSuffix)) return englishSuffix;

    const candidates = wtfOverlayState.reverseQuestNameTranslations.get(normalizeQuestName(source)) || [];
    if (candidates.length) return candidates[0];
    return source;
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

  const projectLiveQuestMarker = (mapSlug, x, y) => {
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
    if (!Number.isFinite(left) || !Number.isFinite(top)
      || left < 0 || left > 100 || top < 0 || top > 100) return null;
    return { left, top };
  };

  const questDisplayNameFromLiveData = (quest) => String(
    quest?.name || quest?.name_en || quest?.shortName || quest?.uid || ''
  ).replace(/\s+/g, ' ').trim();

  const liveQuestMarkerColor = (markerData) => {
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
      const point = projectLiveQuestMarker(mapSlug, marker.geometry.x, marker.geometry.y);
      if (!point) continue;
      const quest = questsByUid.get(String(marker.questUid));
      const questName = questDisplayNameFromLiveData(quest);
      markers.push({
        markerUid: String(marker.uid || ''),
        questId: String(marker.questUid),
        quest: questName,
        objective: String(marker.name || marker.desc || ''),
        questStepUids: Array.isArray(marker.questStepUids) ? [...marker.questStepUids] : [],
        left: point.left,
        top: point.top,
        level: marker.level === null || marker.level === undefined ? null : Number(marker.level),
        storyline: quest?.type === 'Storyline',
        requiredForKappa: Boolean(quest?.requiredForKappa)
      });
    }
    return { map: mapSlug, markers, questCount: quests.length };
  };

  const discoverTarkovMarketQuestStore = async () => {
    if (window.__wtfQuestLiveSource) {
      const source = typeof window.__wtfQuestLiveSource === 'function'
        ? await window.__wtfQuestLiveSource()
        : window.__wtfQuestLiveSource;
      return { source, label: 'test-live-store' };
    }
    const moduleUrls = [...document.querySelectorAll('script[type="module"][src]')]
      .map((script) => script.src)
      .filter((url) => {
        try {
          const parsed = new URL(url, location.href);
          return parsed.origin === location.origin && parsed.pathname.includes('/_nuxt');
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
    syncNativeQuestCheckbox(row, checkbox);
    syncQuestRequirementsPanel();
    renderQuestMarkers();
    window.chrome?.webview?.postMessage(JSON.stringify({
      action: 'quest-toggled',
      questName,
      isSelected: desired
    }));
  };

  const addNativeQuestCheckboxes = () => {
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

    if (leftPanel.classList.contains('terminal-side-panel')) {
      let group = leftPanel.querySelector('.wtf-ping-filter-group');
      if (!group) {
        group = document.createElement('section');
        group.className = 'mb-5 terminal-filter-section wtf-ping-filter-group';
        group.dataset.section = 'visibility';
        const heading = document.createElement('button');
        heading.type = 'button';
        heading.className = 'terminal-section-heading';
        heading.setAttribute('aria-expanded', 'true');
        heading.innerHTML = `<span class="bold">${pingCopy('Visibility', '가시성')}</span><span aria-hidden="true">-/+</span>`;
        items = document.createElement('div');
        items.className = 'items scroll terminal-filter-items';
        heading.addEventListener('click', () => {
          const collapsed = group.classList.toggle('collapsed');
          heading.setAttribute('aria-expanded', String(!collapsed));
        });
        group.append(heading, items);
        leftPanel.querySelector('.terminal-layer-list')?.appendChild(group);
      } else {
        items = group.querySelector('.terminal-filter-items');
      }
    } else {
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
      control.className = leftPanel.classList.contains('terminal-side-panel')
        ? 'terminal-filter-row no-wrap d-flex inactive'
        : 'd-flex h-space-between mb-5 no-wrap inactive';
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
    const countText = `${wtfOverlayState.route.localNodeCount || 0}/${wtfOverlayState.route.maxNodes || 20}`;
    if (count && count.textContent !== countText) count.textContent = countText;
    setRouteVisible(wtfOverlayState.routeVisible, false);
  };

  const ensureClearPingsButton = () => {
    const topPanel = document.querySelector('.panel_top');
    if (!topPanel) return;
    let button = document.getElementById('wtf-clear-pings-button');
    if (!button || button.parentElement !== topPanel) {
      button?.remove();
      button = document.createElement('button');
      button.id = 'wtf-clear-pings-button';
      button.type = 'button';
      const nativeButton = topPanel.querySelector('button');
      if (nativeButton) {
        button.className = nativeButton.className;
        for (const attribute of nativeButton.attributes) {
          if (attribute.name.startsWith('data-v-')) button.setAttribute(attribute.name, '');
        }
      }
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (!(wtfOverlayState.pings.pings?.length > 0)) return;
        const confirmed = window.confirm(pingCopy(
          'Delete every ping on this map?',
          '이 지도에 찍힌 핑을 전부 삭제할까요?'
        ));
        if (confirmed) window.chrome?.webview?.postMessage(JSON.stringify({ action: 'map-pings-clear' }));
      });
      const status = topPanel.querySelector('.terminal-status');
      if (status) status.before(button);
      else topPanel.appendChild(button);
    }
    const buttonText = pingCopy('Delete all pings', '핑 전부 삭제');
    if (button.textContent !== buttonText) button.textContent = buttonText;
    button.disabled = !(wtfOverlayState.pings.pings?.length > 0);
  };

  const ensureClearRouteButton = () => {
    const topPanel = document.querySelector('.panel_top');
    if (!topPanel) return;
    let button = document.getElementById('wtf-clear-route-button');
    if (!button || button.parentElement !== topPanel) {
      button?.remove();
      button = document.createElement('button');
      button.id = 'wtf-clear-route-button';
      button.type = 'button';
      const nativeButton = topPanel.querySelector('button');
      if (nativeButton) {
        button.className = nativeButton.className;
        for (const attribute of nativeButton.attributes) {
          if (attribute.name.startsWith('data-v-')) button.setAttribute(attribute.name, '');
        }
      }
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (!(wtfOverlayState.route.nodes?.length > 0)) return;
        const confirmed = window.confirm(pingCopy(
          'Delete every route node on this map?',
          '이 지도의 경로 노드를 전부 삭제할까요?'
        ));
        if (confirmed) {
          window.chrome?.webview?.postMessage(JSON.stringify({ action: 'map-route-nodes-clear' }));
        }
      });
      const pingButton = document.getElementById('wtf-clear-pings-button');
      const status = topPanel.querySelector('.terminal-status');
      if (pingButton?.parentElement === topPanel) pingButton.after(button);
      else if (status) status.before(button);
      else topPanel.appendChild(button);
    }
    const buttonText = pingCopy('Delete all route nodes', '경로 전부 삭제');
    if (button.textContent !== buttonText) button.textContent = buttonText;
    button.disabled = !(wtfOverlayState.route.nodes?.length > 0);
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

  const applyNativePopupScope = (element) => {
    element.setAttribute('data-v-6c75efb4', '');
    return element;
  };

  const closeQuestPopup = () => {
    if (wtfOverlayState.questPopup) {
      wtfOverlayState.questPopup.hidden = true;
      wtfOverlayState.questPopup.replaceChildren();
    }
    wtfOverlayState.questPopupMarker = null;
  };

  const updateQuestPopupPosition = () => {
    const popup = wtfOverlayState.questPopup;
    const marker = wtfOverlayState.questPopupMarker;
    if (!popup?.isConnected || popup.hidden || !marker?.isConnected) return;
    popup.style.left = marker.style.left;
    popup.style.top = marker.style.top;
  };

  const renderQuestPopup = (markerData) => {
    const popup = wtfOverlayState.questPopup;
    if (!popup) return;
    popup.replaceChildren();

    const inner = applyNativePopupScope(document.createElement('div'));
    inner.className = 'inner';
    const header = applyNativePopupScope(document.createElement('div'));
    header.className = 'd-flex h-space-between v-start';
    const title = applyNativePopupScope(document.createElement('div'));
    title.className = 'title w-100';
    title.textContent = formatQuestName(String(markerData.quest || 'Quest'));
    const close = applyNativePopupScope(document.createElement('button'));
    close.type = 'button';
    close.className = 'wtf-popup-close';
    close.textContent = '\u00d7';
    close.title = state.language === 'ko' ? '\uB2EB\uAE30' : 'Close';
    close.setAttribute('aria-label', close.title);
    close.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeQuestPopup();
    });
    header.append(title, close);

    const objective = applyNativePopupScope(document.createElement('div'));
    objective.className = 'wtf-quest-popup-objective';
    objective.textContent = translateQuestStep(String(markerData.objective || ''), 'objectives');
    const meta = applyNativePopupScope(document.createElement('div'));
    meta.className = 'wtf-quest-popup-meta';
    const labels = [
      markerData.category === 'item'
        ? (state.language === 'ko' ? '\uD018\uC2A4\uD2B8 \uC544\uC774\uD15C \uC704\uCE58' : 'Quest item location')
        : (state.language === 'ko' ? '\uD018\uC2A4\uD2B8 \uBAA9\uD45C' : 'Quest objective'),
      markerData.optional ? (state.language === 'ko' ? '\uC120\uD0DD \uBAA9\uD45C' : 'Optional') : ''
    ].filter(Boolean);
    meta.textContent = labels.join(' \u00b7 ');
    inner.append(header, objective, meta);
    popup.appendChild(inner);
    popup.hidden = false;
    updateQuestPopupPosition();
  };

  const ensureQuestPopup = () => {
    const mapContainer = document.querySelector('.map-cont');
    if (!mapContainer) return null;
    let popup = wtfOverlayState.questPopup;
    if (!popup?.isConnected || popup.parentElement !== mapContainer) {
      popup?.remove();
      popup = applyNativePopupScope(document.createElement('div'));
      popup.className = 'map-popup wtf-quest-popup';
      popup.hidden = true;
      popup.setAttribute('role', 'dialog');
      popup.addEventListener('pointerdown', (event) => event.stopPropagation());
      popup.addEventListener('mousedown', (event) => event.stopPropagation());
      popup.addEventListener('click', (event) => event.stopPropagation());
      mapContainer.appendChild(popup);
      wtfOverlayState.questPopup = popup;
    }
    return popup;
  };

  const openQuestPopup = (markerData, marker) => {
    ensureQuestPopup();
    wtfOverlayState.questPopupMarker = marker;
    renderQuestPopup(markerData);
  };

  const ensureNativeQuestPopupCloseButton = () => {
    for (const popup of document.querySelectorAll('.map-popup:not(.wtf-quest-popup)')) {
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

  const findNativeQuestVisibilityRow = () => {
    const iconRow = document.querySelector(
      '.panel_left path[d^="m253.943,502.885"]'
    )?.closest('.items > div');
    if (iconRow) return iconRow;

    const normalize = (value) => String(value || '')
      .replace(/\s+/g, '')
      .toLowerCase();
    const isQuestLabel = (value) => {
      const normalized = normalize(value).replace(/\d+$/, '');
      return normalized.includes('quest') || normalized.includes('퀘스트');
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
      if (guardId !== wtfOverlayState.nativeQuestFilterGuardId) {
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
      else stop();
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

  const updateQuestMarkerFloorOpacity = () => {
    const selectedFloor = selectedPingFloor();
    for (const marker of document.querySelectorAll('.wtf-quest-marker')) {
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

    for (const markerData of markerDataList) {
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
        translateQuestStep(markerData.objective, 'objectives')
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
        openNativeQuestMarkerDetails(markerData);
      });
      marker.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        openNativeQuestMarkerDetails(markerData);
      });

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('wtf-quest-marker-icon');
      svg.setAttribute('viewBox', '0 0 507.885 507.885');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', tarkovMarketQuestIconPath);
      path.setAttribute('fill', liveQuestMarkerColor(markerData));
      path.setAttribute('stroke', '#000');
      path.setAttribute('stroke-width', '20');
      svg.appendChild(path);
      marker.appendChild(svg);
      overlay.appendChild(marker);
    }
    updateQuestMarkerFloorOpacity();
    scheduleOverlayPositionUpdate();
  };

  const ensureQuestLayer = () => {
    const mapContainer = document.querySelector('.map-cont');
    const mapWrap = mapContainer?.querySelector('.map-wrap');
    if (!mapContainer || !mapWrap) return false;
    if (!wtfOverlayState.questLayer?.isConnected || wtfOverlayState.questLayer.parentElement !== mapContainer) {
      wtfOverlayState.questLayer?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'wtf-quest-layer';
      overlay.setAttribute('aria-hidden', 'true');
      mapContainer.appendChild(overlay);
      wtfOverlayState.questLayer = overlay;
      renderQuestMarkers();
    }
    observeMapTransform(mapContainer, mapWrap);
    return true;
  };

  const updateOverlayPositions = () => {
    wtfOverlayState.updateFrame = 0;
    const mapWrap = wtfOverlayState.mapWrap;
    const mapContainer = mapWrap?.closest('.map-cont');
    if (!mapWrap?.isConnected || !mapContainer) return;

    const computed = getComputedStyle(mapWrap);
    const matrix = parseMapTransform(computed.transform);

    const originParts = computed.transformOrigin.split(/\s+/);
    const originX = Number.parseFloat(originParts[0]) || 0;
    const originY = Number.parseFloat(originParts[1]) || 0;
    const layout = getLayoutOffset(mapWrap, mapContainer);
    const width = mapWrap.offsetWidth || Number.parseFloat(computed.width) || 0;
    const height = mapWrap.offsetHeight || Number.parseFloat(computed.height) || 0;
    const currentZoom = Math.hypot(matrix.a, matrix.b);
    const mapSlug = String(wtfOverlayState.quest.map || '').toLowerCase();
    const baseZoom = tarkovMarketMapDefinitions[mapSlug]?.zoom || 1;
    const nativeQuestMarkerScale = currentZoom >= baseZoom
      ? 1
      : Math.max(0.5, Math.sqrt(currentZoom / baseZoom));

    for (const marker of document.querySelectorAll('.wtf-quest-marker, .wtf-squad-marker, .wtf-ping-marker, .wtf-route-node')) {
      if (marker.parentElement !== wtfOverlayState.questLayer
          && marker.parentElement !== wtfOverlayState.squadLayer
          && marker.parentElement !== wtfOverlayState.pingLayer
          && marker.parentElement !== wtfOverlayState.routeLayer) continue;
      const localX = (Number(marker.dataset.left) / 100) * width;
      const localY = (Number(marker.dataset.top) / 100) * height;
      const relativeX = localX - originX;
      const relativeY = localY - originY;
      const spreadX = Number(marker.dataset.spreadX) || 0;
      const spreadY = Number(marker.dataset.spreadY) || 0;
      marker.style.left = (layout.left + originX + (matrix.a * relativeX) + (matrix.c * relativeY) + matrix.e + spreadX) + 'px';
      marker.style.top = (layout.top + originY + (matrix.b * relativeX) + (matrix.d * relativeY) + matrix.f + spreadY) + 'px';
      if (marker.classList.contains('wtf-quest-marker')) {
        marker.style.setProperty(
          '--wtf-quest-marker-scale',
          String(state.iconScale * nativeQuestMarkerScale)
        );
      }
    }
    updateRouteLines();
    updateQuestPopupPosition();
  };

  const scheduleOverlayPositionUpdate = () => {
    if (wtfOverlayState.updateFrame) return;
    wtfOverlayState.updateFrame = requestAnimationFrame(updateOverlayPositions);
  };

  const mapPercentFromClientPoint = (mapContainer, mapWrap, clientX, clientY) => {
    const computed = getComputedStyle(mapWrap);
    const matrix = parseMapTransform(computed.transform);
    const determinant = (matrix.a * matrix.d) - (matrix.b * matrix.c);
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-8) return null;
    const originParts = computed.transformOrigin.split(/\s+/);
    const originX = Number.parseFloat(originParts[0]) || 0;
    const originY = Number.parseFloat(originParts[1]) || 0;
    const layout = getLayoutOffset(mapWrap, mapContainer);
    const containerRect = mapContainer.getBoundingClientRect();
    const mappedX = (clientX - containerRect.left) - layout.left - originX - matrix.e;
    const mappedY = (clientY - containerRect.top) - layout.top - originY - matrix.f;
    const relativeX = ((matrix.d * mappedX) - (matrix.c * mappedY)) / determinant;
    const relativeY = ((-matrix.b * mappedX) + (matrix.a * mappedY)) / determinant;
    const width = mapWrap.offsetWidth || Number.parseFloat(computed.width) || 0;
    const height = mapWrap.offsetHeight || Number.parseFloat(computed.height) || 0;
    if (!(width > 0) || !(height > 0)) return null;
    const left = ((relativeX + originX) / width) * 100;
    const top = ((relativeY + originY) / height) * 100;
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

  const selectedPingFloor = () => {
    const inputs = [...document.querySelectorAll('input[name="layers"]')];
    const selected = inputs.find(input => input.checked || input.getAttribute('aria-checked') === 'true');
    if (!selected || inputs.length < 2) return null;
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

  const installPingPlacement = (mapContainer, mapWrap) => {
    if (mapContainer.__wtfPingMapWrap === mapWrap) return;
    if (mapContainer.__wtfPingPointerHandler) {
      mapContainer.removeEventListener('pointerdown', mapContainer.__wtfPingPointerHandler, true);
    }
    const handler = (event) => {
      if (!event.altKey || event.button !== 0
          || event.target.closest('.panel_top, .panel_left, .panel_right, button, input, label, a, .map-popup, .wtf-quest-marker')) return;
      const nearbyPing = nearestOverlayMarker('.wtf-ping-marker[data-owned="true"]', event.clientX, event.clientY);
      if (nearbyPing?.dataset.id) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.chrome?.webview?.postMessage(JSON.stringify({
          action: 'map-ping-delete', id: nearbyPing.dataset.id
        }));
        return;
      }
      const point = mapPercentFromClientPoint(mapContainer, mapWrap, event.clientX, event.clientY);
      if (!point) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.chrome?.webview?.postMessage(JSON.stringify({
        action: 'map-ping-add',
        left: point.left,
        top: point.top,
        floor: selectedPingFloor()
      }));
    };
    mapContainer.__wtfPingMapWrap = mapWrap;
    mapContainer.__wtfPingPointerHandler = handler;
    mapContainer.addEventListener('pointerdown', handler, true);
  };

  const ensurePingLayer = () => {
    const mapContainer = document.querySelector('.map-cont');
    const mapWrap = mapContainer?.querySelector('.map-wrap');
    if (!mapContainer || !mapWrap) return false;
    if (!wtfOverlayState.pingLayer?.isConnected || wtfOverlayState.pingLayer.parentElement !== mapContainer) {
      wtfOverlayState.pingLayer?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'wtf-ping-layer';
      overlay.setAttribute('aria-hidden', 'true');
      mapContainer.appendChild(overlay);
      wtfOverlayState.pingLayer = overlay;
      renderPingMarkers();
    }
    installPingPlacement(mapContainer, mapWrap);
    observeMapTransform(mapContainer, mapWrap);
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

  const installRoutePlacement = (mapContainer, mapWrap) => {
    if (mapContainer.__wtfRouteMapWrap === mapWrap) return;
    if (mapContainer.__wtfRoutePointerHandler) {
      mapContainer.removeEventListener('pointerdown', mapContainer.__wtfRoutePointerHandler, true);
      mapContainer.removeEventListener('auxclick', mapContainer.__wtfRouteAuxHandler, true);
    }
    const isInteractiveUi = target => target.closest(
      '.panel_top, .panel_left, .panel_right, button, input, label, a, .map-popup, '
      + '.wtf-ping-marker'
    );
    const handler = event => {
      if (event.button !== 1 || isInteractiveUi(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const nearbyNode = nearestOverlayMarker('.wtf-route-node[data-owned="true"]', event.clientX, event.clientY);
      if (nearbyNode?.dataset.id) {
        window.chrome?.webview?.postMessage(JSON.stringify({
          action: 'map-route-node-delete', id: nearbyNode.dataset.id
        }));
        return;
      }
      const maxNodes = Number(wtfOverlayState.route.maxNodes) || 20;
      if ((Number(wtfOverlayState.route.localNodeCount) || 0) >= maxNodes) {
        window.alert(pingCopy(
          `A route can contain up to ${maxNodes} nodes.`,
          `경로 노드는 최대 ${maxNodes}개까지 배치할 수 있습니다.`
        ));
        return;
      }
      const point = mapPercentFromClientPoint(mapContainer, mapWrap, event.clientX, event.clientY);
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
    mapContainer.__wtfRouteMapWrap = mapWrap;
    mapContainer.__wtfRoutePointerHandler = handler;
    mapContainer.__wtfRouteAuxHandler = auxHandler;
    mapContainer.addEventListener('pointerdown', handler, true);
    mapContainer.addEventListener('auxclick', auxHandler, true);
  };

  const ensureRouteLayer = () => {
    const mapContainer = document.querySelector('.map-cont');
    const mapWrap = mapContainer?.querySelector('.map-wrap');
    if (!mapContainer || !mapWrap) return false;
    if (!wtfOverlayState.routeLayer?.isConnected || wtfOverlayState.routeLayer.parentElement !== mapContainer) {
      wtfOverlayState.routeLayer?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'wtf-route-layer';
      overlay.setAttribute('aria-label', pingCopy('Route nodes', '경로 노드'));
      mapContainer.appendChild(overlay);
      wtfOverlayState.routeLayer = overlay;
      renderRouteNodes();
    }
    installRoutePlacement(mapContainer, mapWrap);
    observeMapTransform(mapContainer, mapWrap);
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

  const observeMapTransform = (mapContainer, mapWrap) => {
    if (wtfOverlayState.mapWrap === mapWrap && wtfOverlayState.mapObserver) return;
    wtfOverlayState.mapObserver?.disconnect();
    wtfOverlayState.resizeObserver?.disconnect();
    wtfOverlayState.mapWrap = mapWrap;
    wtfOverlayState.mapObserver = new MutationObserver(scheduleOverlayPositionUpdate);
    wtfOverlayState.mapObserver.observe(mapWrap, {
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    if (window.ResizeObserver) {
      wtfOverlayState.resizeObserver = new ResizeObserver(scheduleOverlayPositionUpdate);
      wtfOverlayState.resizeObserver.observe(mapContainer);
      wtfOverlayState.resizeObserver.observe(mapWrap);
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
    localizeNativeGameNames();
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
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && wtfOverlayState.questPopup && !wtfOverlayState.questPopup.hidden) {
        closeQuestPopup();
      }
    });
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
        nodes: Array.isArray(snapshot.nodes) ? snapshot.nodes.slice(0, 100) : [],
        maxNodes: Math.min(20, Math.max(1, Number(snapshot.maxNodes) || 20)),
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
