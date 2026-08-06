import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const outputPath = resolve(repoRoot, "eft-where-am-i/html/quest-locations.json");
const endpoints = {
  tasks: "https://json.tarkov.dev/regular/tasks",
  taskTranslations: "https://json.tarkov.dev/regular/tasks_en",
  itemTranslations: "https://json.tarkov.dev/regular/items_en"
};

async function getJson(url, cacheName) {
  const cachePath = resolve(repoRoot, ".tools/reference", cacheName);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const text = await response.text();
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, text);
    return JSON.parse(text);
  } catch (error) {
    try {
      return JSON.parse(await readFile(cachePath, "utf8"));
    } catch {
      throw new Error(`Could not update or read ${cacheName}: ${error.message}`);
    }
  }
}

const [rawTasks, taskEnglish, itemEnglish] = await Promise.all([
  getJson(endpoints.tasks, "regular-tasks.json"),
  getJson(endpoints.taskTranslations, "regular-tasks-en.json"),
  getJson(endpoints.itemTranslations, "regular-items-en.json")
]);

const taskText = taskEnglish.data || {};
const itemText = itemEnglish.data || {};

function objectiveLocations(objective) {
  const locations = [];
  for (const zone of objective.zones || []) {
    if (!zone?.map || !zone?.position) continue;
    locations.push({
      map: zone.map,
      x: zone.position.x,
      y: zone.position.y,
      z: zone.position.z,
      top: zone.top,
      bottom: zone.bottom,
      kind: "zone"
    });
  }
  for (const group of objective.possibleLocations || []) {
    for (const position of group.positions || []) {
      locations.push({ map: group.map, x: position.x, y: position.y, z: position.z, kind: "possible" });
    }
  }
  return locations;
}

const tasks = Object.values(rawTasks.data?.tasks || {}).map(task => ({
  id: task.id,
  name: taskText[task.name] || task.normalizedName || task.id,
  minPlayerLevel: task.minPlayerLevel || 0,
  taskRequirements: (task.taskRequirements || []).map(requirement => ({
    task: requirement.task,
    status: requirement.status || []
  })),
  neededKeys: (task.neededKeys || []).map(group => ({
    map: group.map,
    keys: (group.keys || []).map(id => ({ id, name: itemText[`${id} Name`] || id }))
  })),
  objectives: (task.objectives || []).map(objective => ({
    id: objective.id,
    description: taskText[objective.description] || objective.type || objective.id,
    type: objective.type,
    count: objective.count || 1,
    optional: Boolean(objective.optional),
    maps: objective.maps || [],
    locations: objectiveLocations(objective)
  }))
}));

const snapshot = {
  generatedAt: new Date().toISOString(),
  source: endpoints,
  tasks
};

await writeFile(outputPath, `${JSON.stringify(snapshot)}\n`);
console.log(`Wrote ${tasks.length} tasks to ${outputPath}`);
