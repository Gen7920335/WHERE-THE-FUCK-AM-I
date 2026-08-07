# Clean-room feature parity

This fork keeps the MIT-licensed desktop application code and implements map behavior independently. It does not copy Tarkov-Market source code or private data, call private endpoints, bypass authentication, or unlock a paid account feature.

## Implemented equivalents

| Behavior | Independent implementation |
| --- | --- |
| Screenshot position and facing | Parses the EFT screenshot filename locally and projects its Unity position/quaternion through three map anchors. |
| Automatic screenshot detection | Local `FileSystemWatcher`; no game memory access. |
| Automatic map detection and cleanup | Reads local EFT logs and manages the configured screenshot directory. |
| Map, floors, zoom, pan, ruler, fullscreen | Local HTML/SVG renderer using public tarkov.dev SVG maps. |
| Extractions, spawns, locks, hazards and loot | Generated snapshot from public tarkov.dev JSON data with 44 independently defined layer controls. |
| Quest locations and requirements | Generated from public tarkov.dev tasks, objectives, keys, prerequisite tasks and trader requirements. |
| Quest pinning and movable requirements | Local SQLite pin persistence and local renderer panels. |
| Quest progress filters | Local Story/Kappa/All filters, player/faction/level settings, trader loyalty levels and completed-task tracking. |
| Floor indication and editing | Arrow/opacity modes plus a local world-coordinate polygon editor. Polygons use world X/Z; floor height uses world Y. |
| Squad positions | Account-free LAN multicast plus player-hosted encrypted UDP rooms. A client connects with the host IPv4/DNS name, UDP port, and session-only password. No cloud service is used. |
| Wall colors | Changes SVG room fills only and preserves wall outlines. |
| UI scale, themes and languages | Stored application settings and local renderer configuration. |

## Deliberate boundaries

- LAN mode retains a multicast room selector and is not encrypted. Direct host/client mode derives an AES-GCM key from a password using PBKDF2; the password is kept in memory and never written to settings or sent over the network.
- Direct mode requires the host to permit the application through Windows Firewall and forward the configured UDP port. It may not work when the host ISP uses CGNAT.
- `Story` is this project's public-data definition: tasks not flagged as Lightkeeper-only. `Kappa` uses tarkov.dev's `kappaRequired` field.
- Game edition is stored as local profile context. Quest availability is calculated from explicit player level, faction, prerequisite completion and trader loyalty fields.
- Proprietary Tarkov-Market accounts, cloud squad infrastructure, paid entitlements and unpublished coordinates are not reproduced. Their useful visible behaviors are provided through local implementations instead.
- Data refresh is performed by `scripts/update-tarkov-data.mjs`; the generated files retain their public source URLs and generation time.
