import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const repoRoot = resolve(import.meta.dirname, "..");
const mapJs = await readFile(resolve(repoRoot, "eft-where-am-i/html/map.js"), "utf8");
const markerSnapshot = JSON.parse(await readFile(resolve(repoRoot, "eft-where-am-i/html/map-markers.json"), "utf8"));
const questSnapshot = JSON.parse(await readFile(resolve(repoRoot, "eft-where-am-i/html/quest-locations.json"), "utf8"));
const battlePass = JSON.parse(await readFile(resolve(repoRoot, "eft-where-am-i/html/battle-pass-locations.json"), "utf8"));

const mapsMatch = mapJs.match(/const MAPS = ([\s\S]*?);\s+const FLOOR_ALIASES/);
if (!mapsMatch) throw new Error("Could not parse MAPS from map.js");
const maps = vm.runInNewContext(`(${mapsMatch[1]})`);
const mapKeyById = new Map(Object.entries(maps).map(([key, map]) => [map.tdevId, key]));
const sourcePoints = new Map(Object.keys(maps).map(key => [key, []]));
const collections = ["spawns", "bosses", "extracts", "transits", "locks", "hazards", "containers", "looseLoot", "switches", "stationaryWeapons", "btrStops"];

for (const map of markerSnapshot.maps || []) {
  const mapKey = mapKeyById.get(map.id);
  if (!mapKey) continue;
  for (const collection of collections) {
    for (const marker of map[collection] || []) {
      sourcePoints.get(mapKey).push({
        position: marker.position,
        source: `${collection}:${marker.name || marker.id || "unnamed"}`
      });
    }
  }
}
for (const task of questSnapshot.tasks || []) {
  for (const objective of task.objectives || []) {
    for (const location of objective.locations || []) {
      const mapKey = mapKeyById.get(location.map);
      if (mapKey) {
        sourcePoints.get(mapKey).push({
          position: [location.x, location.y, location.z],
          source: `quest:${task.name || task.id}:${objective.description || objective.id}`
        });
      }
    }
  }
}

function project(map, x, z) {
  const [a, b, c] = map.anchors;
  const abX = b.world[0] - a.world[0], abZ = b.world[1] - a.world[1];
  const acX = c.world[0] - a.world[0], acZ = c.world[1] - a.world[1];
  const pointX = x - a.world[0], pointZ = z - a.world[1];
  const determinant = abX * acZ - abZ * acX;
  const across = (pointX * acZ - pointZ * acX) / determinant;
  const down = (abX * pointZ - abZ * pointX) / determinant;
  return {
    left: a.map[0] + across * (b.map[0] - a.map[0]) + down * (c.map[0] - a.map[0]),
    top: a.map[1] + across * (b.map[1] - a.map[1]) + down * (c.map[1] - a.map[1])
  };
}

let total = 0;
let exact = 0;
let nearFive = 0;
let nearFifteen = 0;
let reportedPoiCenters = 0;
const weak = [];
const duplicatePositions = [];

for (const [mapKey, locations] of Object.entries(battlePass.maps || {})) {
  if (!maps[mapKey]) throw new Error(`Unsupported Battle Pass map: ${mapKey}`);
  const seen = new Map();
  for (const location of locations) {
    total++;
    const [x, y, z] = location.position;
    const projected = project(maps[mapKey], x, z);
    if (projected.left < 0 || projected.left > 100 || projected.top < 0 || projected.top > 100) {
      throw new Error(`${mapKey}/${location.title}: outside calibrated map bounds`);
    }
    const key = location.position.map(value => Number(value).toFixed(2)).join(",");
    if (seen.has(key)) duplicatePositions.push(`${mapKey}: ${seen.get(key)} / ${location.title}`);
    else seen.set(key, location.title);

    let nearest = Number.POSITIVE_INFINITY;
    let nearestSource = null;
    for (const point of sourcePoints.get(mapKey)) {
      const distance = Math.hypot(x - Number(point.position[0]), z - Number(point.position[2]));
      if (distance < nearest) {
        nearest = distance;
        nearestSource = point;
      }
    }
    if (nearest < 0.05) exact++;
    if (nearest <= 5) nearFive++;
    if (nearest <= 15) nearFifteen++;
    const threshold = 15;
    const isReportedPoiCenter = location.coordinateBasis === "reported-poi-center";
    if (isReportedPoiCenter) {
      reportedPoiCenters++;
      if (!location.coordinateNote || location.coordinateNote.length < 20) {
        throw new Error(`${mapKey}/${location.title}: reported POI center requires an explanatory coordinateNote`);
      }
    }
    if (nearest > threshold && !isReportedPoiCenter) {
      weak.push({
        mapKey,
        title: location.title,
        confidence: location.confidence,
        nearest: Number(nearest.toFixed(1)),
        nearestPosition: nearestSource?.position,
        nearestSource: nearestSource?.source
      });
    }
  }
}

if (duplicatePositions.length) throw new Error(`Duplicate Battle Pass coordinates:\n${duplicatePositions.join("\n")}`);
if (weak.length) throw new Error(`Battle Pass coordinates without nearby public coordinate evidence:\n${weak.map(value => `${value.mapKey}/${value.title}: ${value.nearest}m from ${value.nearestSource} @ ${JSON.stringify(value.nearestPosition)}`).join("\n")}`);
if (nearFifteen / total < 0.9) throw new Error(`Only ${nearFifteen}/${total} Battle Pass coordinates are within 15m of public coordinate evidence`);

console.log(`Audited ${total} Battle Pass coordinates: ${exact} exact public points, ${nearFive} within 5m, ${nearFifteen} within 15m, ${reportedPoiCenters} explicitly labeled POI-center estimates; no duplicates or out-of-bounds points`);
