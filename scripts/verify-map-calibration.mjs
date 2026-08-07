import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const repoRoot = resolve(import.meta.dirname, "..");
const mapScript = await readFile(resolve(repoRoot, "eft-where-am-i/html/map.js"), "utf8");
const mapsSource = mapScript.match(/const MAPS = (\{[\s\S]*?\n  \});\n  const FLOOR_ALIASES/)?.[1];
if (!mapsSource) throw new Error("Could not find MAPS in map.js");
const maps = vm.runInNewContext(`(${mapsSource})`);

function project(map, x, z) {
  const [a, b, c] = map.anchors;
  const abX = b.world[0] - a.world[0];
  const abZ = b.world[1] - a.world[1];
  const acX = c.world[0] - a.world[0];
  const acZ = c.world[1] - a.world[1];
  const pointX = x - a.world[0];
  const pointZ = z - a.world[1];
  const determinant = abX * acZ - abZ * acX;
  if (Math.abs(determinant) < 1e-9) throw new Error("Degenerate anchor triangle");
  const alongTop = (pointX * acZ - pointZ * acX) / determinant;
  const alongLeft = (abX * pointZ - abZ * pointX) / determinant;
  return [
    a.map[0] + alongTop * (b.map[0] - a.map[0]) + alongLeft * (c.map[0] - a.map[0]),
    a.map[1] + alongTop * (b.map[1] - a.map[1]) + alongLeft * (c.map[1] - a.map[1])
  ];
}

let sourceMaps = null;
try {
  sourceMaps = JSON.parse(await readFile(resolve(repoRoot, ".tools/reference/tarkov-dev/src/data/maps.json"), "utf8"));
} catch {
  // The reference checkout is intentionally ignored and is not present in clean CI jobs.
}
const sourceNames = { streets: "streets-of-tarkov", "ground-zero": "ground-zero", lab: "the-lab", labyrinth: "the-labyrinth" };
let maxError = 0;

for (const [key, map] of Object.entries(maps)) {
  if (map.anchors.length !== 3) throw new Error(`${key}: expected exactly three anchors`);
  for (const anchor of map.anchors) {
    const projected = project(map, anchor.world[0], anchor.world[1]);
    const error = Math.hypot(projected[0] - anchor.map[0], projected[1] - anchor.map[1]);
    maxError = Math.max(maxError, error);
  }
  if (sourceMaps) {
    const sourceLocation = sourceMaps.find(entry => entry.normalizedName === (sourceNames[key] || key));
    const sourceMap = sourceLocation?.maps?.find(entry => entry.projection === "interactive");
    const expectedBounds = sourceMap?.svgBounds || sourceMap?.bounds;
    if (JSON.stringify(map.bounds) !== JSON.stringify(expectedBounds)) {
      throw new Error(`${key}: bounds differ from current tarkov.dev SVG bounds`);
    }
  }
}

if (maxError > 1e-9) throw new Error(`Anchor projection error ${maxError}% exceeds tolerance`);
const markerSnapshot = JSON.parse(await readFile(resolve(repoRoot, "eft-where-am-i/html/map-markers.json"), "utf8"));
const markerCollections = ["spawns", "bosses", "extracts", "transits", "locks", "hazards", "containers", "looseLoot", "switches", "stationaryWeapons", "btrStops"];
let markerCount = 0;
for (const map of Object.values(maps)) {
  const markerMap = markerSnapshot.maps.find(candidate => candidate.id === map.tdevId);
  if (!markerMap) throw new Error(`Marker snapshot is missing map ${map.tdevId}`);
  for (const collection of markerCollections) {
    for (const marker of markerMap[collection] || []) {
      const position = marker.position;
      if (!Array.isArray(position) || position.length !== 3 || position.some(value => !Number.isFinite(value))) {
        throw new Error(`${markerMap.name}/${collection}: invalid marker position`);
      }
      markerCount++;
    }
  }
}
if (markerCount < 15000) throw new Error(`Marker snapshot unexpectedly contains only ${markerCount} entries`);
console.log(`Verified ${Object.keys(maps).length} maps × 3 anchors; max projection error ${maxError}%${sourceMaps ? "; source bounds match" : ""}; ${markerCount} marker positions`);
