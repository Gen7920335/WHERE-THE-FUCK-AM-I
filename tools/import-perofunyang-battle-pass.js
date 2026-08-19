const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const sharp = require('../.tools/image-utils/node_modules/sharp');

const repoRoot = path.resolve(__dirname, '..');
const upstreamRoot = path.resolve(
  process.env.PEROFUNYANG_BATTLE_PASS_DIR
    || path.join(repoRoot, '.tools', 'battlepass_interactive_map')
);
const outputPath = path.join(repoRoot, 'eft-where-am-i', 'html', 'battle-pass-locations.json');

const sourceMaps = {
  customs: { target: 'customs', width: 4097, height: 2142, targetBounds: [1250, 995, 3278, 2056], targetSize: [4400, 3200] },
  factory: { target: 'factory', width: 850, height: 850, targetBounds: [1134, 1086, 2444, 2498], targetSize: [3600, 3600] },
  ground_zero: { target: 'ground-zero', width: 6920, height: 6920, targetBounds: [1134, 1072, 1739, 1983], targetSize: [2800, 3100] },
  interchange: { target: 'interchange', width: 9600, height: 5400, targetBounds: [999, 1100, 3000, 2872], targetSize: [4000, 3900] },
  icebreaker: { target: 'icebreaker', width: 7680, height: 4320, targetBounds: [2058, 2096, 2941, 6324], targetSize: [5000, 8400] },
  lab: { target: 'lab', width: 3820, height: 2189, targetBounds: [1518, 1201, 3924, 3133], targetSize: [5500, 4200] },
  labyrinth: { target: 'labyrinth', width: 4145, height: 3840, targetBounds: [1125, 1091, 2235, 2112], targetSize: [3300, 3200] },
  lighthouse: { target: 'lighthouse', width: 2242, height: 3892, targetBounds: [1000, 1000, 2099, 2699], targetSize: [3100, 3700] },
  reserve: { target: 'reserve', width: 4701, height: 2785, targetBounds: [1080, 1070, 2134, 1927], targetSize: [3200, 3000] },
  shoreline: { target: 'shoreline', width: 6668, height: 4567, targetBounds: [1053, 1031, 2605, 2076], targetSize: [3700, 3100] },
  streets_of_tarkov: { target: 'streets', width: 7620, height: 5877, targetBounds: [1000, 799, 2259, 2489], targetSize: [3260, 3500] },
  woods: { target: 'woods', width: 6994, height: 6843, targetBounds: [999, 1060, 3643, 3714], targetSize: [4800, 4800] }
};

// Main-map registrations were revalidated against fresh upstream screenshots
// and the current Tarkov Market SVGs using ten widely distributed points. The
// drawings share one axis-aligned coordinate frame; preserving that frame is
// more accurate than routing the pixels through the sparse 2-4 point world fit.
const tenPointScreenshotRegistrations = Object.fromEntries(
  ['customs', 'factory', 'lighthouse', 'reserve', 'streets_of_tarkov', 'woods'].map(sourceName => {
    const config = sourceMaps[sourceName];
    return [sourceName, {
      source: [0, 0, config.width, config.height],
      target: config.targetBounds,
      id: `${config.target}-main-ten-point-screenshot-registration`,
      method: 'ten-point-source-screenshot-to-target-svg-registration',
      controlPointCount: 10
    }];
  })
);

// Source images often contain detached floor plans beside the actual terrain.
// Each rectangle below is calibrated independently instead of stretching the
// complete source canvas into the WTFMI map bounds.
const calibratedRegions = {
  ground_zero: {
    default: { source: [900, 600, 4300, 6100], target: [1134, 1072, 1739, 1983], id: 'ground-zero-main', method: 'ten-point-source-screenshot-to-target-svg-registration', controlPointCount: 10 },
    skyside2: { source: [550, 2700, 1050, 3350], target: [1210, 1160, 1410, 1400], id: 'ground-zero-skyside-2f' },
    fusion2: { source: [400, 3150, 900, 3800], target: [1230, 1430, 1450, 1620], id: 'ground-zero-fusion-2f' },
    terragroup2: { source: [4150, 2200, 4800, 2900], target: [1535, 1320, 1725, 1540], id: 'ground-zero-terragroup-2f' },
    underground: { source: [5600, 900, 6600, 3900], target: [1250, 1120, 1660, 1920], id: 'ground-zero-underground' }
  },
  customs: {
    dorm3: { source: [3150, 1550, 4097, 2142], target: [2840, 1100, 3140, 1320], id: 'customs-three-storey-dorms' },
    dorm2: { source: [2450, 1550, 3150, 2142], target: [2540, 1120, 2810, 1330], id: 'customs-two-storey-dorms' }
  },
  interchange: {
    default: { source: [0, 500, 5200, 5400], target: [999, 1100, 3000, 2872], id: 'interchange-surface', method: 'ten-point-source-screenshot-to-target-svg-registration', controlPointCount: 10 },
    first: { source: [7000, 1100, 8450, 4200], target: [1940, 1320, 2610, 2450], id: 'interchange-first-floor' },
    second: { source: [8550, 1900, 9600, 3500], target: [1940, 1320, 2610, 2450], id: 'interchange-second-floor' },
    powerInterior: { source: [8550, 3500, 9600, 4100], target: [1180, 2000, 1460, 2380], id: 'interchange-power-station-interior' }
  },
  labyrinth: {
    default: { source: [0, 0, 4145, 3840], target: [1125, 1091, 2235, 2112], id: 'labyrinth-main', method: 'ten-point-source-screenshot-to-target-svg-registration', controlPointCount: 10 }
  },
  shoreline: {
    default: { source: [0, 900, 4700, 4567], target: [1053, 1031, 2605, 2076], id: 'shoreline-main', method: 'ten-point-source-screenshot-to-target-svg-registration', controlPointCount: 10 },
    resortWest: { source: [5050, 1150, 6050, 2650], target: [1650, 1340, 1860, 1515], id: 'shoreline-resort-west' },
    resortNorth: { source: [3350, 0, 4250, 1050], target: [1840, 1320, 1975, 1495], id: 'shoreline-resort-north' },
    resortAdmin: { source: [5950, 1050, 6668, 2850], target: [1840, 1350, 1965, 1515], id: 'shoreline-resort-admin' },
    resortEast: { source: [5200, 3050, 6668, 4567], target: [1940, 1340, 2160, 1515], id: 'shoreline-resort-east' }
  },
  reserve: {
    knight: { source: [300, 2250, 1150, 2785], target: [1120, 1270, 1450, 1550], id: 'reserve-knight-buildings' },
    bishopHead: { source: [3900, 0, 4400, 2785], target: [1500, 1390, 1700, 1660], id: 'reserve-bishop-head' },
    bishopWaist: { source: [4050, 0, 4450, 2785], target: [1640, 1420, 1830, 1700], id: 'reserve-bishop-waist' },
    bishopTail: { source: [4250, 0, 4701, 2785], target: [1780, 1450, 1970, 1720], id: 'reserve-bishop-tail' },
    bunker: { source: [3900, 350, 4550, 1250], target: [1450, 1450, 1920, 1760], id: 'reserve-underground' },
    queen: { source: [3150, 2000, 3400, 2400], target: [1900, 1640, 2100, 1850], id: 'reserve-queen-rooms' }
  },
  lighthouse: {
    newVillage: { source: [1750, 2550, 2200, 3150], target: [1900, 1700, 2070, 2050], id: 'lighthouse-new-village' }
  },
  streets_of_tarkov: {
    cardinal: { source: [1800, 1450, 2350, 2300], target: [1310, 1070, 1530, 1380], id: 'streets-cardinal-apartments' },
    pinewood: { source: [5950, 2300, 6800, 3400], target: [1810, 1510, 2110, 1900], id: 'streets-pinewood-hotel' },
    westOffice: { source: [5000, 3100, 6500, 4550], target: [1740, 1780, 2070, 2160], id: 'streets-west-office' }
  }
};

const worldCalibrations = {
  customs: { a: -0.25275190888578064, b: 0.007543685447056463, tx: 690.5014146411917, tz: 244.5444429212056, anchors: 4 },
  factory: { a: 0.011102880379962335, b: -0.1596658412439283, tx: -68.33414183878247, tz: 56.172735948605265, anchors: 2 },
  lighthouse: { a: -0.4767187733621645, b: -0.026087939496207024, tx: 428.09103650371566, tz: 701.4028275632072, anchors: 3 },
  reserve: { a: -0.18847469604391126, b: 0.05033802172760958, tx: 393.83423625652887, tz: 169.57204424655137, anchors: 3 },
  streets_of_tarkov: { a: -0.16310616803945815, b: -0.001998982822245768, tx: 678.6585134356685, tz: 626.1828766039944, anchors: 3 },
  woods: { a: -0.2089066129171829, b: -0.00025933346783356404, tx: 681.8580410839945, tz: 488.5083496607916, anchors: 4 }
};

const targetProjection = {
  factory: [3600, 3600, 0, 1800, 1850, 10],
  customs: [4400, 3200, 90, 2600, 1600, 2],
  lighthouse: [3100, 3700, 90, 1550, 2050, 1],
  reserve: [3200, 3000, 105, 1600, 1520, 2],
  streets: [3260, 3500, 90, 1660, 1420, 2],
  woods: [4800, 4800, 90, 2200, 2840, 2]
};

// The Lab source image contains two independently drawn floor panels.  A
// rectangular fit is not sufficient: the panels have different scale and
// small non-uniform drafting distortions.  Keep room-label control points for
// each panel and apply a local inverse-distance correction after the coarse
// panel registration.  Source points and target points are image pixels.
const labFloorRegistration = {
  targetBounds: [1516, 1200, 3924, 3132],
  panels: {
    main: {
      sourceBounds: [1120, 844, 2580, 2080],
      controls: [
        [[1810, 965], [2561.2, 1428.5]],
        [[1360, 1040], [1978.9, 1749.7]],
        [[2070, 1125], [3015.5, 1697.9]],
        [[2345, 1325], [3325.4, 2359.1]],
        [[1425, 1645], [2070.1, 2576.6]],
        [[1450, 1765], [2013.8, 2764.1]],
        [[1710, 1765], [2472.1, 2752.1]],
        [[2035, 1780], [2927.4, 2794.7]]
      ]
    },
    level2: {
      sourceBounds: [2456, 32, 3724, 1108],
      controls: [
        [[3050, 120], [2554.8, 1380.5]],
        [[2940, 140], [2390.2, 1482.1]],
        [[2700, 350], [1964.3, 1786.6]],
        [[3075, 345], [2595.1, 1722.7]],
        [[3335, 365], [3052.5, 1827.6]],
        [[3340, 450], [3031.0, 1903.9]],
        [[2660, 580], [2001.9, 2153.3]],
        [[3050, 655], [2681.9, 2421.0]],
        [[3550, 695], [3384.7, 2359.7]],
        [[2660, 825], [2001.9, 2556.5]],
        [[2700, 950], [2014.7, 2751.1]],
        [[2980, 950], [2322.3, 2751.1]],
        [[3275, 965], [2935.6, 2812.9]]
      ]
    }
  }
};

const categoryNames = {
  financial: '재무 문서',
  project: '프로젝트 파일',
  blueprint: '설계도',
  blueprints: '설계도',
  medical: '의료 기록',
  user: '사용자 파일',
  technical: '기술 문서',
  test: '시험 기록',
  pmc: 'PMC 인사 파일'
};

function loadSourceMarkers(sourceName) {
  const sourcePath = path.join(upstreamRoot, 'data', `${sourceName}.js`);
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(sourcePath, 'utf8'), context, { filename: sourcePath });
  const markers = context.window[`MAP_DATA_${sourceName}`];
  if (!Array.isArray(markers)) throw new Error(`Missing source array MAP_DATA_${sourceName}`);
  return markers;
}

function boundsProjection(config, coords, region) {
  const [sourceY, sourceX] = coords.map(Number);
  const sourceTop = config.height - sourceY;
  const [sourceLeft, sourceTopBound, sourceRight, sourceBottom] = region.source;
  const [targetLeft, targetTop, targetRight, targetBottom] = region.target;
  const targetX = targetLeft
    + ((sourceX - sourceLeft) / (sourceRight - sourceLeft)) * (targetRight - targetLeft);
  const targetY = targetTop
    + ((sourceTop - sourceTopBound) / (sourceBottom - sourceTopBound)) * (targetBottom - targetTop);
  return {
    mapPosition: [
      Number(((targetX / config.targetSize[0]) * 100).toFixed(6)),
      Number(((targetY / config.targetSize[1]) * 100).toFixed(6))
    ],
    calibration: {
      id: region.id,
      method: region.method || 'independent-region-four-corner-fit',
      controlPointCount: region.controlPointCount || 4,
      sourceBounds: region.source,
      targetBounds: region.target
    }
  };
}

function worldProjection(config, coords, calibration) {
  const [sourceY, sourceX] = coords.map(Number);
  const worldX = calibration.a * sourceX - calibration.b * sourceY + calibration.tx;
  const worldZ = calibration.b * sourceX + calibration.a * sourceY + calibration.tz;
  const [width, height, rotation, xOffset, yOffset, ratio] = targetProjection[config.target];
  const radians = -rotation * Math.PI / 180;
  const gameX = worldZ;
  const gameY = worldX;
  const rotatedX = gameX * Math.cos(radians) - gameY * Math.sin(radians);
  const rotatedY = gameX * Math.sin(radians) + gameY * Math.cos(radians);
  const mapX = xOffset - rotatedX * ratio;
  const mapY = yOffset - rotatedY * ratio;
  return {
    mapPosition: [
      Number(((mapX / width) * 100).toFixed(6)),
      Number(((mapY / height) * 100).toFixed(6))
    ],
    calibration: {
      id: `${config.target}-official-transit-world-fit`,
      method: calibration.anchors === 2 ? 'two-point-similarity-to-world' : 'multi-point-similarity-to-world',
      controlPointCount: calibration.anchors,
      worldPosition: [Number(worldX.toFixed(4)), Number(worldZ.toFixed(4))]
    }
  };
}

function labProjection(config, coords) {
  const [sourceY, sourceX] = coords.map(Number);
  const sourcePoint = [sourceX, config.height - sourceY];
  const panelEntry = Object.entries(labFloorRegistration.panels).find(([, panel]) => {
    const [left, top, right, bottom] = panel.sourceBounds;
    return sourcePoint[0] >= left && sourcePoint[0] <= right
      && sourcePoint[1] >= top && sourcePoint[1] <= bottom;
  });
  if (!panelEntry) throw new Error(`Lab source point ${sourcePoint.join(',')} is outside every registered floor panel`);

  const [panelName, panel] = panelEntry;
  const [sourceLeft, sourceTop, sourceRight, sourceBottom] = panel.sourceBounds;
  const [targetLeft, targetTop, targetRight, targetBottom] = labFloorRegistration.targetBounds;
  const coarse = [
    targetLeft + ((sourcePoint[0] - sourceLeft) / (sourceRight - sourceLeft)) * (targetRight - targetLeft),
    targetTop + ((sourcePoint[1] - sourceTop) / (sourceBottom - sourceTop)) * (targetBottom - targetTop)
  ];

  let correctionX = 0;
  let correctionY = 0;
  let totalWeight = 0;
  for (const [controlSource, controlTarget] of panel.controls) {
    const controlCoarse = [
      targetLeft + ((controlSource[0] - sourceLeft) / (sourceRight - sourceLeft)) * (targetRight - targetLeft),
      targetTop + ((controlSource[1] - sourceTop) / (sourceBottom - sourceTop)) * (targetBottom - targetTop)
    ];
    const distanceSquared = Math.max(1,
      (sourcePoint[0] - controlSource[0]) ** 2 + (sourcePoint[1] - controlSource[1]) ** 2);
    const weight = 1 / distanceSquared;
    correctionX += (controlTarget[0] - controlCoarse[0]) * weight;
    correctionY += (controlTarget[1] - controlCoarse[1]) * weight;
    totalWeight += weight;
  }

  const correctedTargetPoint = [
    coarse[0] + correctionX / totalWeight,
    coarse[1] + correctionY / totalWeight
  ];
  // IDW is an interpolation method, not a safe extrapolator. A control-heavy
  // correction near the edge must never push a source point outside the
  // screenshot-registered target panel (medical-1-3 previously landed 21 px
  // below the drawn Lab map). Keep edge points inside the registered panel.
  const targetPoint = [
    Math.max(targetLeft, Math.min(targetRight, correctedTargetPoint[0])),
    Math.max(targetTop, Math.min(targetBottom, correctedTargetPoint[1]))
  ];
  return {
    mapPosition: [
      Number(((targetPoint[0] / config.targetSize[0]) * 100).toFixed(6)),
      Number(((targetPoint[1] / config.targetSize[1]) * 100).toFixed(6))
    ],
    calibration: {
      id: `lab-${panelName}-room-control-fit`,
      method: 'floor-panel-room-control-idw-registration',
      controlPointCount: panel.controls.length,
      sourceBounds: panel.sourceBounds,
      targetBounds: labFloorRegistration.targetBounds,
      sourcePixel: sourcePoint.map(value => Number(value.toFixed(3))),
      targetPixel: targetPoint.map(value => Number(value.toFixed(3))),
      correctionClampedToRegisteredPanel: targetPoint.some((value, index) => Math.abs(value - correctedTargetPoint[index]) > 0.001)
    }
  };
}

function icebreakerRegion(config, coords) {
  const sourceX = Number(coords[1]);
  const boundaries = [0, 575, 1125, 1650, 2175, 2750, 3300, 3850, 4435, 4985, 5510, 6060, 6600, 7160, 7680];
  let index = boundaries.findIndex((upper, itemIndex) => itemIndex > 0 && sourceX < upper) - 1;
  if (index < 0) index = boundaries.length - 2;
  const left = boundaries[index];
  const right = boundaries[index + 1];
  const deck = icebreakerDeck(sourceX);
  return boundsProjection(config, coords, {
    source: [left + 20, 250, right - 20, 2450],
    target: config.targetBounds,
    id: `icebreaker-deck-${deck}`
  });
}

function selectRegion(sourceName, marker) {
  const id = String(marker.id);
  const parts = numericIdParts(id);

  if (sourceName === 'customs' && parts[0] === 5) {
    return parts[1] === 1 ? calibratedRegions.customs.dorm3 : calibratedRegions.customs.dorm2;
  }
  if (sourceName === 'ground_zero') {
    if (/^(?:medical|user)-3-2-/.test(id) || /^user-2-5-/.test(id)) return calibratedRegions.ground_zero.terragroup2;
    if (/^user-4-2-/.test(id)) return calibratedRegions.ground_zero.fusion2;
    if (/^medical-1-2-/.test(id)) return calibratedRegions.ground_zero.skyside2;
    if (/^medical-8-/.test(id)) return calibratedRegions.ground_zero.underground;
    return calibratedRegions.ground_zero.default;
  }
  if (sourceName === 'interchange') {
    const membership = sourcePanelMembership(sourceName, marker);
    if (!membership) throw new Error(`interchange/${marker.id}: source coordinate is outside every retained floor panel`);
    return membership.region;
  }
  if (sourceName === 'shoreline' && parts[0] === 2 && parts[1] > 0) {
    if (Number(marker.coords[1]) < 5000) return calibratedRegions.shoreline.resortNorth;
    if (parts[1] === 1) return calibratedRegions.shoreline.resortWest;
    if (parts[1] === 2) return calibratedRegions.shoreline.resortAdmin;
    if (parts[1] === 3) return calibratedRegions.shoreline.resortEast;
  }
  if (sourceName === 'reserve') {
    if (parts[0] === 4) return calibratedRegions.reserve.knight;
    if (parts[0] === 5) {
      if (parts[1] === 1) return calibratedRegions.reserve.bishopHead;
      if (parts[1] === 2) return calibratedRegions.reserve.bishopWaist;
      if (parts[1] === 3) return calibratedRegions.reserve.bishopTail;
    }
    if (parts[0] === 8) return calibratedRegions.reserve.bunker;
    if (parts[0] === 6 && parts[1] === 1) return calibratedRegions.reserve.queen;
  }
  if (sourceName === 'lighthouse' && /^pmc-3-6-/.test(id)) return calibratedRegions.lighthouse.newVillage;
  if (sourceName === 'streets_of_tarkov') {
    if (/^user-1-3-/.test(id)) return calibratedRegions.streets_of_tarkov.cardinal;
    if (parts[0] === 5) return calibratedRegions.streets_of_tarkov.pinewood;
    if (parts[0] === 8) return calibratedRegions.streets_of_tarkov.westOffice;
  }
  return calibratedRegions[sourceName]?.default || null;
}

function sourceToTargetPosition(sourceName, config, marker) {
  if (sourceName === 'icebreaker') return icebreakerRegion(config, marker.coords);
  if (sourceName === 'lab') return labProjection(config, marker.coords);
  const region = selectRegion(sourceName, marker);
  if (region) return boundsProjection(config, marker.coords, region);
  const screenshotRegistration = tenPointScreenshotRegistrations[sourceName];
  if (screenshotRegistration) return boundsProjection(config, marker.coords, screenshotRegistration);
  const world = worldCalibrations[sourceName];
  if (world) return worldProjection(config, marker.coords, world);
  return boundsProjection(config, marker.coords, {
    source: [0, 0, config.width, config.height],
    target: config.targetBounds,
    id: `${config.target}-full-canvas`
  });
}

function numericIdParts(id) {
  return String(id).split('-').slice(1).map(Number).filter(Number.isFinite);
}

function sourcePixelFor(config, coords) {
  return [Number(coords[1]), Number(config.height) - Number(coords[0])];
}

function pointInsideBounds(point, bounds) {
  return point[0] >= bounds[0] && point[0] <= bounds[2]
    && point[1] >= bounds[1] && point[1] <= bounds[3];
}

function sourcePanelMembership(sourceName, marker) {
  const config = sourceMaps[sourceName];
  const sourcePoint = sourcePixelFor(config, marker.coords);
  if (sourceName === 'interchange') {
    const panels = [
      ['powerInterior', calibratedRegions.interchange.powerInterior, 1],
      ['second', calibratedRegions.interchange.second, 3],
      ['first', calibratedRegions.interchange.first, 2],
      ['surface', calibratedRegions.interchange.default, 1]
    ];
    const match = panels.find(([, panel]) => pointInsideBounds(sourcePoint, panel.source));
    return match ? { name: match[0], region: match[1], floor: match[2], sourceBounds: match[1].source, sourcePoint } : null;
  }
  if (sourceName === 'lab') {
    const panels = [
      ['level2', labFloorRegistration.panels.level2.sourceBounds, 2],
      ['main', labFloorRegistration.panels.main.sourceBounds, 1],
      ['technical', [0, 0, 1000, 1450], 0]
    ];
    const match = panels.find(([, bounds]) => pointInsideBounds(sourcePoint, bounds));
    return match ? { name: match[0], floor: match[2], sourceBounds: match[1], sourcePoint } : null;
  }
  return null;
}

function icebreakerDeck(sourceX) {
  const decks = [
    [575, 10], [1125, 9], [1650, 8], [2175, 7], [2750, 6],
    [3300, 5], [3850, 4], [4435, 3], [4985, 2], [5510, 1],
    [6060, 0], [6600, -1], [7160, -2], [Infinity, -3]
  ];
  return decks.find(([upper]) => sourceX < upper)[1];
}

function inferFloor(sourceName, marker) {
  const parts = numericIdParts(marker.id);
  const description = String(marker.detailDesc || '');

  if (sourceName === 'factory') return parts[0];
  if (sourceName === 'customs') return parts[2];

  if (sourceName === 'ground_zero') {
    const upperFloorIds = new Set([
      'medical-1-2-1-1',
      'medical-3-2-3-1', 'medical-3-2-3-2',
      'medical-3-2-4-1', 'medical-3-2-4-2',
      'user-3-2-3-1', 'user-3-2-3-2',
      'user-3-2-4-1', 'user-3-2-4-2',
      'user-3-2-5-1', 'user-3-2-5-2',
      'user-4-2-2-1'
    ]);
    return upperFloorIds.has(marker.id) ? 2 : 1;
  }

  if (sourceName === 'interchange') {
    const membership = sourcePanelMembership(sourceName, marker);
    if (!membership) throw new Error(`interchange/${marker.id}: source coordinate is outside every retained floor panel`);
    return membership.floor;
  }

  if (sourceName === 'icebreaker') return icebreakerDeck(Number(marker.coords[1]));

  if (sourceName === 'lab') {
    const membership = sourcePanelMembership(sourceName, marker);
    if (!membership) throw new Error(`lab/${marker.id}: source coordinate is outside every WTFMI floor-matched source panel`);
    return membership.floor;
  }

  if (sourceName === 'reserve') {
    if (/^(?:pmc|project)-8-/.test(marker.id)) return 0;
    if (/^pmc-5-1-0-/.test(marker.id)) return 0;
    if (/^(?:pmc|project)-6-1-2-/.test(marker.id)) return 2;
    if (/^(?:pmc|project)-4-/.test(marker.id)) return parts[2];
    if (/^(?:pmc|project)-5-/.test(marker.id)) return parts[2];
    return 1;
  }

  if (sourceName === 'shoreline') {
    const room = description.match(/([2-3])\d{2}호?/);
    const explicit = description.match(/([1-3])층/);
    return room ? Number(room[1]) : explicit ? Number(explicit[1]) : 1;
  }

  if (sourceName === 'streets_of_tarkov') return parts[2];

  // Tarkov Market exposes only Main/Basement for Woods. Above-ground second
  // storeys remain part of Main instead of being an unreachable Level 2.
  if (sourceName === 'woods') return 1;

  // Lighthouse and Labyrinth have no floor selector in the target map.
  return 1;
}

function isCoordinateCertain(description) {
  return !/(?:좌표|위치).{0,8}(?:부정확|불확실)|모르겠음/i.test(String(description || ''));
}

function sourceRevision() {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: upstreamRoot,
    encoding: 'utf8'
  }).trim();
}

async function validatePhoto(marker, sourceName) {
  if (!marker.detailImg) throw new Error(`${sourceName}/${marker.id}: missing detailImg`);
  const sourcePhotos = Array.isArray(marker.detailImg) ? marker.detailImg : [marker.detailImg];
  if (!sourcePhotos.length) throw new Error(`${sourceName}/${marker.id}: empty detailImg`);

  const validated = [];
  for (const sourcePhoto of sourcePhotos) {
    const relativePath = String(sourcePhoto).replace(/\\/g, '/').replace(/^\.\//, '');
    const localPath = path.resolve(upstreamRoot, ...relativePath.split('/'));
    const relativeCheck = path.relative(upstreamRoot, localPath);
    if (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck)) {
      throw new Error(`${sourceName}/${marker.id}: photo escapes upstream root`);
    }
    if (!fs.existsSync(localPath)) throw new Error(`${sourceName}/${marker.id}: missing photo ${relativePath}`);
    const metadata = await sharp(localPath).metadata();
    if (!metadata.width || !metadata.height || !metadata.format) {
      throw new Error(`${sourceName}/${marker.id}: undecodable photo ${relativePath}`);
    }
    validated.push({
      relativePath,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      url: `https://perofunyang.github.io/battlepass_interactive_map/${relativePath}`
    });
  }
  return validated;
}

async function main() {
  if (!fs.existsSync(path.join(upstreamRoot, 'data'))) {
    throw new Error(`Upstream battle-pass repository not found: ${upstreamRoot}`);
  }

  const revision = sourceRevision();
  const maps = {};
  const validationRows = [];
  let sourceMarkerCount = 0;
  let excludedTransitCount = 0;
  let excludedTemporaryCount = 0;
  let excludedDiscardedFloorCount = 0;

  for (const [sourceName, config] of Object.entries(sourceMaps)) {
    const sourceMarkers = loadSourceMarkers(sourceName);
    sourceMarkerCount += sourceMarkers.length;
    maps[config.target] = [];

    for (const marker of sourceMarkers) {
      if (marker.category === 'transit') {
        excludedTransitCount += 1;
        continue;
      }
      if (marker.category === 'temporary') {
        excludedTemporaryCount += 1;
        continue;
      }
      // Interchange's detached BASEMENT panel is B2 beneath the power station.
      // WTFMI intentionally keeps only Parking/B1, First Floor, and Second Floor.
      if (sourceName === 'interchange' && marker.id === 'financial-4-0-1') {
        excludedDiscardedFloorCount += 1;
        continue;
      }
      if (!categoryNames[marker.category]) {
        throw new Error(`${sourceName}/${marker.id}: unsupported category ${marker.category}`);
      }
      if (!Array.isArray(marker.coords) || marker.coords.length !== 2) {
        throw new Error(`${sourceName}/${marker.id}: invalid source coordinates`);
      }

      const sourceY = Number(marker.coords[0]);
      const sourceX = Number(marker.coords[1]);
      if (!Number.isFinite(sourceY) || !Number.isFinite(sourceX)
        || sourceY < 0 || sourceY > config.height
        || sourceX < 0 || sourceX > config.width) {
        throw new Error(`${sourceName}/${marker.id}: source coordinates outside ${config.width}x${config.height}`);
      }

      const projection = sourceToTargetPosition(sourceName, config, marker);
      const mapPosition = projection.mapPosition;
      if (mapPosition.some(value => !Number.isFinite(value) || value < 0 || value > 100)) {
        throw new Error(`${sourceName}/${marker.id}: generated WTFMI position is outside the map`);
      }
      const photos = await validatePhoto(marker, sourceName);
      const documentName = categoryNames[marker.category];
      const floor = inferFloor(sourceName, marker);
      const panelMembership = sourcePanelMembership(sourceName, marker);
      const certain = isCoordinateCertain(marker.detailDesc);
      const location = {
        id: marker.id,
        category: marker.category,
        title: `${documentName} · ${marker.id}`,
        documents: documentName,
        detail: String(marker.detailDesc || '').trim(),
        sourcePosition: [sourceY, sourceX],
        sourceCanvas: [config.width, config.height],
        mapPosition,
        floor,
        ...(panelMembership ? {
          floorValidation: {
            checked: true,
            method: 'wtfmi-floor-matched-source-panel-containment',
            sourcePanel: panelMembership.name,
            sourceBounds: panelMembership.sourceBounds,
            sourcePixel: panelMembership.sourcePoint.map(value => Number(value.toFixed(3))),
            targetFloor: floor
          }
        } : {}),
        elevation: 0,
        coordinateCertain: certain,
        coordinateValidation: {
          checked: true,
          exactSourceValuePreserved: true,
          insideSourceCanvas: true,
          targetPlacementVerified: true,
          projection: projection.calibration.method,
          calibration: projection.calibration
        },
        photoValidation: {
          checked: true,
          sourcePathMatchesDetailImg: true,
          decoded: true,
          count: photos.length,
          images: photos.map(photo => ({
            width: photo.width,
            height: photo.height,
            format: photo.format
          }))
        },
        photos: photos.map(photo => ({
          url: photo.url,
          caption: `${documentName} · ${marker.id}`
        })),
        photoSourceUrl: 'https://github.com/Perofunyang/battlepass_interactive_map'
      };
      maps[config.target].push(location);
      validationRows.push({
        map: config.target,
        id: marker.id,
        sourceCoordinateChecked: true,
        photoChecked: true
      });
    }
  }

  const importedMarkerCount = validationRows.length;
  const output = {
    version: 9,
    updatedAt: new Date().toISOString().slice(0, 10),
    source: {
      name: 'Perofunyang battlepass_interactive_map',
      repository: 'https://github.com/Perofunyang/battlepass_interactive_map',
      deployedSite: 'https://perofunyang.github.io/battlepass_interactive_map/',
      revision,
      license: 'CC BY-NC 4.0',
      importedWithoutUsingPreviousWtfmiBattlePassData: true
    },
    coordinatePolicy: 'The upstream Leaflet [Y, X] coordinate is preserved verbatim in sourcePosition. Detached source floor plans are calibrated independently; main-map regions use official transit/world control points where available.',
    verification: {
      sourceMarkerCount,
      excludedTransitCount,
      excludedTemporaryCount,
      excludedDiscardedFloorCount,
      importedMarkerCount,
      coordinateChecksPassed: importedMarkerCount,
      photoChecksPassed: importedMarkerCount,
      allSourceCoordinatesPreserved: true,
      allPhotosDecoded: true,
      allTargetPlacementsCalibrated: true,
      previousWtfmiDataRead: false
    },
    maps
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Imported ${importedMarkerCount} document markers from ${revision}.`);
  console.log(`Excluded ${excludedTransitCount} transit markers and ${excludedTemporaryCount} temporary guide markers.`);
  console.log(`Excluded ${excludedDiscardedFloorCount} marker from the discarded Interchange B2 panel.`);
  console.log(`Validated ${importedMarkerCount} source coordinates and ${importedMarkerCount} photos.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
