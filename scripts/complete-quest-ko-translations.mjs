import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const questPath = resolve(repoRoot, "eft-where-am-i/html/quest-locations.json");
const markerPath = resolve(repoRoot, "eft-where-am-i/html/map-markers.json");
const quests = JSON.parse(await readFile(questPath, "utf8"));
const markers = JSON.parse(await readFile(markerPath, "utf8"));
const requestedTask = process.argv[2] || "";

const manualTranslations = new Map([
  ["Locate and neutralize Shturman with a headshot from over 40 meters away while using an M700 sniper rifle with the specified scope", "지정된 조준경을 장착한 M700 sniper rifle을 사용해 40미터 넘는 거리에서 Shturman을 찾아 헤드샷으로 처치하기"],
  ["Eliminate any target while wearing a Bomber beanie and RayBench Hipster Reserve sunglasses on Streets of Tarkov", "Streets of Tarkov에서 Bomber beanie와 RayBench Hipster Reserve sunglasses를 착용한 상태로 아무 대상이나 처치하기"],
  ["Stash RayBench Hipster Reserve sunglasses inside the barber shop on Streets of Tarkov", "Streets of Tarkov의 barber shop 안에 RayBench Hipster Reserve sunglasses 숨겨두기"],
  ["Locate where the missing group was held captive on Streets of Tarkov", "Streets of Tarkov에서 실종된 일행이 감금되었던 장소 찾기"],
  ["Locate the improvised jail warden's apartment on Streets of Tarkov", "Streets of Tarkov에서 임시 감옥 관리인의 apartment 찾기"],
  ["Eliminate PMC operatives from over 40 meters away while using a bolt-action rifle with night or thermal scope", "night 또는 thermal scope를 장착한 bolt-action rifle을 사용해 40미터 넘는 거리에서 PMC 대원 처치하기"]
]);

const protectedTerms = new Set([
  "Ground Zero", "Factory", "Customs", "Interchange", "Woods", "Shoreline", "Lighthouse", "Reserve",
  "Streets of Tarkov", "The Lab", "Labyrinth", "Terminal", "Icebreaker", "Arena",
  "Old Gas Station", "New Gas Station",
  "PMC", "Scav", "Scavs", "USEC", "BEAR", "Kappa", "Lightkeeper", "PVP ZONE",
  ...Object.values(markers.itemNames || {}),
  ...Object.values(markers.containerNames || {}),
  ...Object.values(markers.maps || {}).flatMap(map => [
    map.name,
    ...(map.extracts || []).map(value => value.name),
    ...(map.transits || []).map(value => value.name),
    ...(map.bosses || []).map(value => value.name),
    ...(map.labels || []).map(value => value.text)
  ]),
  ...(quests.traders || []).map(value => value.name),
  ...(quests.tasks || []).flatMap(task => (task.neededKeys || []).flatMap(group => (group.keys || []).map(key => key.name)))
].filter(value => typeof value === "string" && value.trim().length >= 3));
const orderedTerms = [...protectedTerms].sort((a, b) => b.length - a.length);

function termPattern(term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const left = /^[A-Za-z0-9]/.test(term) ? "(?<![A-Za-z0-9])" : "";
  const right = /[A-Za-z0-9]$/.test(term) ? "(?![A-Za-z0-9])" : "";
  return new RegExp(`${left}${escaped}${right}`, "gi");
}

function protect(source, index, kind) {
  let text = source;
  const values = [];
  const reserve = value => {
    const token = `__Q${index}_TERM${values.length}__`;
    values.push(value);
    return token;
  };
  for (const term of orderedTerms) {
    if (!termPattern(term).test(text)) continue;
    text = text.replace(termPattern(term), () => reserve(term));
  }
  if (kind !== "objective") {
    text = text.replace(/\[(?:PVP ZONE|Arena)\]/gi, match => reserve(match));
  }
  return { text, restore: translated => values.reduceRight((result, value, termIndex) =>
    result.replaceAll(`__Q${index}_TERM${termIndex}__`, value), translated) };
}

function lostProtectedTerm(source, translated) {
  let remaining = source;
  const selected = [];
  for (const term of orderedTerms) {
    if (!termPattern(term).test(remaining)) continue;
    remaining = remaining.replace(termPattern(term), match => {
      selected.push(match);
      return `__SELECTED${selected.length - 1}__`;
    });
  }
  return selected.find(term => !termPattern(term).test(translated)) || null;
}

async function translateBatch(batch) {
  const separator = "\n@@@WTFQ_SPLIT@@@\n";
  const protectedBatch = batch.map((entry, index) => ({ ...entry, ...protect(entry.source, index, entry.kind) }));
  const query = protectedBatch.map(entry => entry.text).join(separator);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Translation request failed: ${response.status} ${response.statusText}`);
  const payload = await response.json();
  const translated = (payload[0] || []).map(part => part[0] || "").join("");
  const parts = translated.split(/\s*@@@WTFQ_SPLIT@@@\s*/);
  if (parts.length !== batch.length) throw new Error(`Translation batch split mismatch: ${parts.length}/${batch.length}`);
  return protectedBatch.map((entry, index) => ({
    ...entry,
    translated: entry.restore(parts[index].trim())
      .replace(/([A-Za-z0-9])을/g, "$1를")
      .replace(/([A-Za-z0-9])이(?=[가-힣])/g, "$1가")
      .replace(/([A-Za-z0-9])은/g, "$1는")
      .replace(/([A-Za-z0-9])과/g, "$1와")
  }));
}

const missing = [];
for (const task of quests.tasks || []) {
  if (requestedTask && task.name !== requestedTask) continue;
  task.nameKo = task.name;
  for (const objective of task.objectives || []) {
    if (manualTranslations.has(objective.description)) objective.descriptionKo = manualTranslations.get(objective.description);
    else missing.push({ target: objective, field: "descriptionKo", source: objective.description, kind: "objective" });
  }
}

let completed = 0;
for (let start = 0; start < missing.length; start += 16) {
  const batch = missing.slice(start, start + 16);
  const translated = await translateBatch(batch);
  for (const entry of translated) {
    entry.target[entry.field] = entry.translated || entry.source;
    completed++;
  }
  process.stdout.write(`\rTranslated ${completed}/${missing.length}`);
}

for (const task of quests.tasks || []) {
  const entries = (task.objectives || []).map(objective => ({
    source: objective.description,
    translated: objective.descriptionKo,
    kind: "objective"
  }));
  for (const entry of entries) {
    if (!entry.translated || /__Q\d+_TERM\d+__/.test(entry.translated)) throw new Error(`${task.name}: invalid Korean ${entry.kind}`);
    const lost = lostProtectedTerm(entry.source, entry.translated);
    if (lost) {
      throw new Error(`${task.name}: protected item/location name changed in ${entry.kind}: ${lost}\n${entry.source}\n${entry.translated}`);
    }
    if (!/[가-힣]/.test(entry.translated)) {
      throw new Error(`${task.name}: Korean ${entry.kind} contains no translated text`);
    }
  }
}

await writeFile(questPath, `${JSON.stringify(quests)}\n`);
console.log(`\nCompleted Korean fallback translations in ${questPath}`);
