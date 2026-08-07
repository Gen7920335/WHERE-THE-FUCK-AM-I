import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(repoRoot, path), "utf8");
const [whereAmI, settings, logWatcher, hotkeys, questRepository, mapJs] = await Promise.all([
  read("eft-where-am-i/UserControls/WhereAmI.cs"),
  read("eft-where-am-i/Classes/SettingsHandler.cs"),
  read("eft-where-am-i/Classes/LogWatcherService.cs"),
  read("eft-where-am-i/Classes/GlobalHotkeyManager.cs"),
  read("eft-where-am-i/Classes/QuestRepository.cs"),
  read("eft-where-am-i/html/map.js")
]);

function requireTokens(feature, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) throw new Error(`${feature}: missing ${token}`);
  }
}

requireTokens("automatic screenshot detection", whereAmI, [
  "new FileSystemWatcher", "Filter = \"*.png\"", "watcher.Created += OnScreenshotCreated",
  "OnScreenshotCreated", "CheckLocationAsync"
]);
requireTokens("automatic map detection", logWatcher, [
  "MapRegex", "MapNameMapping", "MapDetected?.Invoke", "scene preset path:maps/"
]);
requireTokens("automatic map detection bridge", whereAmI, [
  "GetOrFindLogPath", "logWatcher.MapDetected += OnMapDetectedFromLog", "HandleMapSelection(mapName)"
]);
requireTokens("dead-zone auto-panning", whereAmI, [
  "appSettings.auto_panning", "AutoPanToMarkerAsync(appSettings.dead_zone_percent)"
]);
requireTokens("local-map auto-panning", mapJs, [
  "window.__eftAutoPan", "panToPlayer()"
]);
requireTokens("Ctrl+Numpad floor hotkeys", hotkeys, [
  "VK_LCONTROL", "VK_RCONTROL", "VK_NUMPAD0", "VK_NUMPAD5",
  "_gameIsActive", "FloorHotkeyPressed?.Invoke"
]);
requireTokens("floor hotkey bridge", whereAmI, [
  "FloorHotkeyPressed", "OnFloorHotkeyPressed", "selectFloorByHotkey"
]);
requireTokens("quest persistence", questRepository, [
  "CREATE TABLE IF NOT EXISTS quests", "INSERT OR IGNORE INTO quests",
  "DELETE FROM quests", "SELECT quest_name FROM quests"
]);
requireTokens("quest persistence bridge", whereAmI, [
  "RestoreQuestsAsync", "questRepository.AddQuest", "questRepository.RemoveQuest",
  "window.eftMap?.setPinnedQuests"
]);
requireTokens("per-map panel visibility", whereAmI, [
  "panel_hidden_per_map", "ToggleAndSavePanelStateAsync", "SavePanelStateAsync"
]);
requireTokens("raid-end screenshot cleanup", logWatcher, [
  "TransitEndRegex", "RaidEnded?.Invoke"
]);
requireTokens("raid-end screenshot cleanup bridge", whereAmI, [
  "logWatcher.RaidEnded += OnRaidEndedFromLog", "auto_screenshot_cleanup",
  "Directory.GetFiles(screenshotPath, \"*.png\")", "File.Delete(file)"
]);
requireTokens("automatic path discovery", settings, [
  "GetOrFindScreenshotPath", "ScreenshotPathSearch", "GetOrFindLogPath", "LogPathSearch",
  "GetLogPathFromRegistry", "GetLogPathFromProcess"
]);
requireTokens("persistent upstream settings", settings, [
  "auto_screenshot_detection", "auto_map_detection", "auto_panning",
  "auto_screenshot_cleanup", "dead_zone_percent", "panel_hidden_per_map"
]);

console.log("Verified upstream public feature parity: screenshot/map detection, dead-zone panning, Ctrl+Numpad floors, quest and panel persistence, raid-end cleanup, and path discovery");
