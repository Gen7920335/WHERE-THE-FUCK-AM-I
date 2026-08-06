# Modified edition roadmap

This order keeps the fork buildable while removing the riskiest inherited
couplings before new features are added.

## Phase 0 — identity and ownership

- Choose product name, assembly name, package ID, icon, and application-data
  directory name.
- Create the fork and add it as `origin`; retain this repository as `upstream`.
- Replace updater, help, issue, and release-workflow URLs.
- Keep the MIT license and existing copyright notices; add the fork owner's
  notice without deleting prior notices.
- Disable automatic updates until a fork-owned release channel exists.

Acceptance: a development build cannot check or publish against the original
repository, and no visible link claims to be the upstream project.

## Phase 1 — isolate mutable state

- Introduce `IAppPaths` and store configuration/database/log/cache below a
  product-specific `%LocalAppData%` directory.
- Treat bundled `assets/settings.json` and `floor_db.json` as read-only defaults.
- Add a one-time migration from legacy files beside the executable.
- Reuse or clean WebView2 profile directories.

Acceptance: running from Visual Studio, a portable folder, or Program Files does
not alter tracked/shipped assets and preserves user data across updates.

## Phase 2 — extract pure parsers and tests

- Extract `ScreenshotPoseParser` from `WhereAmI.AutoSwitchFloorAsync`.
- Extract the map/raid parser from `LogWatcherService.ParseLine`.
- Add tests for valid/invalid/locale-sensitive filenames, every map alias,
  truncated log lines, polygon boundaries, holes, and Z-range boundaries.
- Add replay fixtures containing synthetic data only.

Acceptance: parsing and floor-selection changes are covered without launching a
GUI, game process, remote site, or Windows hook.

## Phase 3 — map-provider adapter

- Move selectors, scripts, retry rules, and feature probes behind
  `IMapPageAdapter`.
- Replace absolute selectors with semantic fallback lists where possible.
- Restrict privileged WebView behavior to the expected HTTPS origin.
- Extract production JavaScript into versioned asset files shared with local DOM
  fixtures.
- Add a compatibility status panel when the provider DOM has changed.

Acceptance: a provider markup change fails visibly and locally instead of
silently breaking unrelated features.

## Phase 4 — safety and reliability

- Replace plain-HTTP IP geolocation or make the feature opt-in and provider-free.
- Replace unbounded `async void` flows with cancellable tasks where event APIs
  allow it; serialize screenshot processing.
- Validate and narrow screenshot cleanup, with a recoverable mode.
- Add log rotation/redaction and expose hook/WebView initialization failures.
- Reduce the inherited nullable warning backlog before enabling warnings-as-errors.

Acceptance: destructive actions are scoped and recoverable, privacy-sensitive
network calls are explicit, and failures reach the UI/logs.

## Phase 5 — new features and release

- Add fork-specific features behind configuration flags.
- Add CI for restore, npm audit, CSS build, JSON validation, .NET build, tests,
  and self-contained publish.
- Sign binaries and test clean install/update/rollback on Windows 10 and 11.
- Verify WebView2-missing, offline, provider-down, invalid-path, and read-only-path
  behavior.

Acceptance: a tagged release is reproducible from CI, installs independently of
upstream, and has a documented rollback path.

## Decisions needed before Phase 0 implementation

1. Fork/product name and GitHub owner/repository.
2. Whether the fork remains dependent on tarkov-market or gets a provider-neutral
   adapter/local map source.
3. Portable-only, installer-only, or both distribution modes.
4. The first feature set that distinguishes the modified edition.
