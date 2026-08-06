# Map calibration

The local renderer uses the current tarkov.dev interactive SVG maps and projects
Escape from Tarkov world coordinates through three edge anchors per map. The
anchors are the SVG map's top-left, top-right, and bottom-left world-coordinate
corners. Solving the resulting affine transform keeps position, scale, axis
direction, and non-square map proportions consistent with the source map.

Calibration metadata was synchronized from `tarkov-dev` commit
`b118c1f5d2902dc23a80b6fdd6130f3ca79a4663` (2026-08-04). Reserve deliberately
uses `svgBounds`, which differs from its viewport `bounds`.

Run the following after changing map metadata:

```powershell
& .\.tools\node-v24.19.0-win-x64\node.exe .\scripts\verify-map-calibration.mjs
```

Quest positions are generated from the tarkov.dev regular task data and bundled
as `html/quest-locations.json`. Refresh that snapshot with:

```powershell
& .\.tools\node-v24.19.0-win-x64\node.exe .\scripts\update-tarkov-data.mjs
```
