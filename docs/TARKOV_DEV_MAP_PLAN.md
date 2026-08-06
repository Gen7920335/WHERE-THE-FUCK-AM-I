# tarkov.dev local map implementation

## Fixed product requirements

1. Scale the map UI from 65% to 200%.
2. Pin quests and show their objectives on the map.
3. Show only pinned-quest requirements in a panel. The panel supports right,
   bottom, and floating/draggable layouts.
4. Support three off-floor marker modes:
   - `arrows`: green arrows above the marker for higher floors and red arrows
     below it for lower floors;
   - `opacity`: the inherited semi-transparent behavior;
   - `both`: arrows and transparency together.
   One arrow represents one floor of difference.
5. Toggle an in-game-style wall palette independently of the selected floor.

The map base is the tarkov.dev interactive-map coordinate system and SVG asset
set. The application must not load or manipulate Tarkov-Market pages.

## Data flow

```text
EFT screenshot filename
  -> C# pose parser (x, y, z, quaternion)
  -> window.eftMap.setPlayerPosition(...)
  -> tarkov.dev coordinate rotation and bounds
  -> player marker and heading

tarkov.dev task snapshot
  -> objective world coordinates + current SVG floor extents
  -> pinned quest markers
  -> floor-rank delta
  -> arrows and/or opacity
```

The current renderer fetches SVGs from `https://assets.tarkov.dev/maps/svg/`.
Quest and map-marker data are generated from versioned tarkov.dev JSON snapshots
and bundled locally because the JSON endpoint does not expose a browser CORS
contract. The application owns its DOM, state, marker behavior, and panel
layout; a third-party page DOM is no longer part of the runtime contract.

## Implemented foundation

- `html/map.html`, `map.css`, and `map.js` implement the local renderer.
- Ten SVG-backed maps are registered: Factory, Customs, Woods, Shoreline,
  Interchange, The Lab, Reserve, Lighthouse, Streets of Tarkov, and Ground Zero.
- Quest selections persist through the existing SQLite `QuestRepository`.
- Settings now include `ui_scale`, `quest_panel_position`,
  `quest_floor_marker_mode`, and `tarkov_wall_colors`.
- The settings page and map toolbar can change the new options.
- Screenshot coordinates and quaternion direction are sent directly to the
  local renderer.
- Offline snapshots contain 16,188 extraction, transit, spawn, boss, lock,
  hazard, container, loose-item, switch, stationary-weapon, and BTR positions.
- Layer filters, item/key/location search, focused item overlays, marker detail
  cards, ruler measurements, fullscreen, and hide-panels controls are local.
- Current tarkov.dev height extents and building bounds drive off-floor marker
  opacity where the source data provides precise rules.

## Required data work before a public release

- Validate player-coordinate calibration on each map with two or more known EFT
  screenshot positions. Bounds and rotations are implemented, but must be
  checked against live screenshots.
- Fill precise Z extents and local building exceptions for every multi-floor
  map. The existing `floor_db.json` is incomplete.
- Author a per-map wall-color manifest. The current toggle applies a generic
  material palette to SVG wall/building classes; it is deliberately marked
  experimental until each building color is sampled and reviewed against an
  authorized reference.
- Add SVG/tile support for Labyrinth, Terminal, and Icebreaker. They are omitted
  from the selector until a compatible local projection is available, avoiding
  silently displaying the wrong map.

## Attribution and distribution gate

- The tarkov.dev website source is MIT licensed.
- SVG files are served by tarkov.dev and credit the
  `the-hideout/tarkov-dev-svg-maps` authors in tarkov.dev map metadata.
- TarkovData describes the SVGs as intended for community tools, but the checked
  repository does not contain a conventional root license file. Before bundling
  the SVG or quest JSON files in a distributable binary, obtain explicit asset
  redistribution terms or keep the runtime-fetch model and show source credits.
- Do not copy RE3MR map assets into a commercial release; their published
  Creative Commons terms include NonCommercial and ShareAlike restrictions.
