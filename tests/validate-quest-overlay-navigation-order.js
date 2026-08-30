const fs = require('fs');
const path = require('path');

const sourcePath = path.resolve(__dirname, '..', 'eft-where-am-i', 'UserControls', 'WhereAmI.cs');
const source = fs.readFileSync(sourcePath, 'utf8');

const methodBody = (signature, nextSignature) => {
  const start = source.indexOf(signature);
  const end = source.indexOf(nextSignature, start + signature.length);
  if (start < 0 || end < 0) throw new Error(`Unable to isolate ${signature}.`);
  return source.slice(start, end);
};

const navigationCompleted = methodBody(
  'private async void WebView2_NavigationCompleted',
  'private async Task ApplyEnhancementSettingsAsync'
);
const sourceChanged = methodBody(
  'private async void CoreWebView2_SourceChanged',
  'private string TryExtractMapNameFromUrl'
);

for (const [name, body] of [
  ['NavigationCompleted', navigationCompleted],
  ['SourceChanged', sourceChanged]
]) {
  if (body.includes('WaitForQuestContainerAsync')) {
    throw new Error(`${name} still blocks pinned marker restoration on the lazy native quest list.`);
  }
  const configureIndex = body.indexOf('await InjectQuestOverlayAsync()');
  const restoreIndex = body.indexOf('await RestoreQuestsAsync(appSettings.latest_map)');
  if (configureIndex < 0 || restoreIndex < 0 || restoreIndex < configureIndex) {
    throw new Error(`${name} does not configure then restore the quest overlay unconditionally.`);
  }
}

console.log('PASS: pinned quest overlay restoration does not wait for a native quest-text click.');
