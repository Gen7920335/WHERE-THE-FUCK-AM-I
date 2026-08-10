(() => {
  'use strict';

  const guide = (file) => `maps/terminal-guides/${file}`;
  const wiki = 'https://escapefromtarkov.fandom.com/wiki/Terminal';
  const ticket = 'https://escapefromtarkov.fandom.com/wiki/The_Ticket';

  window.__wtfTerminalData = {
    sections: [
      { id: 'extractions', title: 'Extractions' },
      { id: 'bosses', title: 'Spawns' },
      { id: 'quests', title: 'Quests' },
      { id: 'keys', title: 'Keys' },
      { id: 'map', title: 'Miscellaneous' },
      { id: 'loot', title: 'Loot' }
    ],
    filters: [
      { id: 'extract-zubr', section: 'extractions', title: 'Zubr Boat', icon: 'extract', defaultVisible: true },
      { id: 'boss-terminal', section: 'bosses', title: 'Random boss', icon: 'boss', defaultVisible: false },
      { id: 'quest-ticket', section: 'quests', title: 'Quest', detailTitle: 'The Ticket', icon: 'quest', defaultVisible: true },
      { id: 'loot-armory-key', section: 'keys', title: 'Armory key', icon: 'key', defaultVisible: false },
      { id: 'loot-black-keycard', section: 'keys', title: 'Black Division keycard', icon: 'keycard', defaultVisible: false },
      { id: 'loot-pier-key', section: 'keys', title: 'Pier door key', icon: 'key', defaultVisible: false },
      { id: 'map-locations', section: 'map', title: 'Locations', icon: 'location', defaultVisible: false },
      { id: 'map-panels', section: 'map', title: 'Electrical panels', icon: 'panel', defaultVisible: false },
      { id: 'loot-sz1', section: 'loot', title: 'SZ-1 explosive charge', icon: 'explosive', defaultVisible: false },
      { id: 'loot-toolset', section: 'loot', title: 'Toolset', icon: 'tool', defaultVisible: false },
      { id: 'loot-supplies', section: 'loot', title: 'Mission supplies', icon: 'loot', defaultVisible: false }
    ],
    markers: [
      {
        id: 'quest-01-armory-key', filter: 'quest-ticket', kind: 'quest', order: 1, left: 31.5, top: 25.6, floor: 1,
        title: 'Find the key for the armory', details: 'Check the dead RUAF soldiers on the route and the table inside the armory building.',
        image: guide('armory_key_spawn_map.png'), sourceUrl: ticket
      },
      {
        id: 'quest-02-armory', filter: 'quest-ticket', kind: 'quest', order: 2, left: 26.4, top: 32.0, floor: 1,
        title: 'Unlock the armory and recover your equipment', details: 'Use the Armory key, then search the lockers for the confiscated equipment.',
        image: guide('armory_key_map.png'), sourceUrl: ticket
      },
      {
        id: 'quest-03-keycard', filter: 'quest-ticket', kind: 'quest', order: 3, left: 19.6, top: 33.3, floor: 1,
        title: 'Obtain the Black Division keycard', details: 'Inside the Seaport Terminal building, search the weapon box on the tipped-over ATM.',
        image: guide('seaport_terminal_building_map.png'), sourceUrl: ticket
      },
      {
        id: 'quest-04-admin', filter: 'quest-ticket', kind: 'quest', order: 4, left: 43.5, top: 39.2, floor: 1,
        title: 'Access the Terminal loading zone', details: 'Swipe the Black Division keycard at the service-passage scanner in the administration building.',
        image: guide('black_division_keycard_lock_map.png'), sourceUrl: ticket
      },
      {
        id: 'quest-05-gate', filter: 'quest-ticket', kind: 'quest', order: 5, left: 44.0, top: 59.1, floor: 1,
        title: 'Open the SZ-1 gate', details: 'Open the metal gate with the SZ-1 explosive charge, an Elite Strength interaction, or a cooperative push.',
        image: guide('terminal_metal_gate_map.png'), sourceUrl: ticket
      },
      {
        id: 'quest-06-toolset', filter: 'quest-ticket', kind: 'quest', order: 6, left: 49.6, top: 61.5, floor: 1,
        title: 'Collect a Toolset', details: 'A Toolset has a guaranteed spawn near the south side of the SZ-1 gate. Keep it for the broken panel.',
        image: guide('terminatoolsetsmap.png'), sourceUrl: ticket
      },
      {
        id: 'quest-07-panel', filter: 'quest-ticket', kind: 'quest', order: 7, left: 32.1, top: 79.0, floor: 1,
        title: 'Repair the broken electrical panel', details: 'Only one of the 10 marked blue panels is broken each raid. Use the Toolset on the open, sparking panel.',
        image: guide('terminalelectricalpanelsmap.png'), sourceUrl: ticket
      },
      {
        id: 'quest-08-pump', filter: 'quest-ticket', kind: 'quest', order: 8, left: 34.3, top: 77.5, floor: 1,
        title: 'Drain the flooded pump station', details: 'After repairing the panel, operate the drainage control inside the pump station.',
        image: guide('terminalpumpingstationmap.png'), sourceUrl: ticket
      },
      {
        id: 'quest-09-pier-key', filter: 'quest-ticket', kind: 'quest', order: 9, left: 34.9, top: 80.2, floor: 1,
        title: 'Take the Pier door key', details: 'Loot the Pier door key from the safe in the pump-station control room.',
        image: guide('terminalpumpingstationmap.png'), sourceUrl: ticket
      },
      {
        id: 'quest-10-pier', filter: 'quest-ticket', kind: 'quest', order: 10, left: 81.7, top: 86.9, floor: 1,
        title: 'Unlock the pier door', details: 'Use the Pier door key and proceed along the pier toward the Zubr landing craft.',
        image: guide('terminal_pier_building_map.png'), sourceUrl: ticket
      },
      {
        id: 'quest-11-zubr', filter: 'quest-ticket', kind: 'quest', order: 11, left: 85.2, top: 60.6, floor: 1,
        title: 'Escape from Tarkov', details: 'Reach the Zubr Boat. The pier sequence includes a departure countdown and the final extraction timer.',
        image: guide('theticketterminalreachingpierpathmap.png'), sourceUrl: ticket
      },

      { id: 'armory-key-ruaf-1', filter: 'loot-armory-key', kind: 'key', left: 34.7, top: 19.3, floor: 1, title: 'Armory key spawn', details: 'Right hand of the dead RUAF soldier outside the starting building.', image: guide('armory_key_spawn_map.png'), sourceUrl: ticket },
      { id: 'armory-key-ruaf-2', filter: 'loot-armory-key', kind: 'key', left: 31.5, top: 25.6, floor: 1, title: 'Armory key spawn', details: 'Left hand of a dead RUAF soldier on the route to the armory.', image: guide('armory_key_spawn_map.png'), sourceUrl: ticket },
      { id: 'armory-key-ruaf-3', filter: 'loot-armory-key', kind: 'key', left: 29.5, top: 32.8, floor: 1, title: 'Armory key spawn', details: 'Search the dead RUAF soldier outside the armory building.', image: guide('armory_key_spawn_map.png'), sourceUrl: ticket },
      { id: 'armory-key-table', filter: 'loot-armory-key', kind: 'key', left: 26.4, top: 32.0, floor: 1, title: 'Armory key spawn', details: 'May spawn on a table inside the armory building.', image: guide('armory_key_spawn_map.png'), sourceUrl: ticket },
      { id: 'black-keycard', filter: 'loot-black-keycard', kind: 'keycard', left: 19.6, top: 33.3, floor: 1, title: 'Black Division keycard', details: 'Inside the flat weapon box placed on a tipped-over ATM in the Seaport Terminal building.', image: guide('seaport_terminal_building_map.png'), sourceUrl: ticket },
      { id: 'sz1-charge-1', filter: 'loot-sz1', kind: 'explosive', left: 30.1, top: 51.8, floor: 1, title: 'SZ-1 explosive charge spawn 1', details: 'Possible SZ-1 explosive charge spawn before the metal gate.', image: guide('terminalexplosivespawnsmap.png'), sourceUrl: ticket },
      { id: 'sz1-charge-2', filter: 'loot-sz1', kind: 'explosive', left: 32.0, top: 51.6, floor: 1, title: 'SZ-1 explosive charge spawn 2', details: 'Possible SZ-1 explosive charge spawn before the metal gate.', image: guide('terminalexplosivespawnsmap.png'), sourceUrl: ticket },
      { id: 'sz1-charge-3', filter: 'loot-sz1', kind: 'explosive', left: 31.8, top: 49.8, floor: 1, title: 'SZ-1 explosive charge spawn 3', details: 'Possible SZ-1 explosive charge spawn before the metal gate.', image: guide('terminalexplosivespawnsmap.png'), sourceUrl: ticket },
      { id: 'sz1-charge-4', filter: 'loot-sz1', kind: 'explosive', left: 29.2, top: 52.4, floor: 1, title: 'SZ-1 explosive charge spawn 4', details: 'Possible SZ-1 explosive charge spawn before the metal gate.', image: guide('terminalexplosivespawnsmap.png'), sourceUrl: ticket },
      { id: 'sz1-charge-5', filter: 'loot-sz1', kind: 'explosive', left: 26.8, top: 53.2, floor: 1, title: 'SZ-1 explosive charge spawn 5', details: 'Possible SZ-1 explosive charge spawn before the metal gate.', image: guide('terminalexplosivespawnsmap.png'), sourceUrl: ticket },
      { id: 'sz1-charge-6', filter: 'loot-sz1', kind: 'explosive', left: 28.0, top: 55.2, floor: 1, title: 'SZ-1 explosive charge spawn 6', details: 'Possible SZ-1 explosive charge spawn before the metal gate.', image: guide('terminalexplosivespawnsmap.png'), sourceUrl: ticket },
      { id: 'sz1-charge-7', filter: 'loot-sz1', kind: 'explosive', left: 29.6, top: 57.6, floor: 1, title: 'SZ-1 explosive charge spawn 7', details: 'Possible SZ-1 explosive charge spawn before the metal gate.', image: guide('terminalexplosivespawnsmap.png'), sourceUrl: ticket },
      { id: 'toolset-gate', filter: 'loot-toolset', kind: 'tool', left: 49.6, top: 61.5, floor: 1, title: 'Toolset', details: 'Guaranteed mission Toolset spawn near the south side of the SZ-1 gate.', image: guide('terminatoolsetsmap.png'), sourceUrl: ticket },
      { id: 'pier-key-safe', filter: 'loot-pier-key', kind: 'key', left: 34.9, top: 80.2, floor: 1, title: 'Pier door key', details: 'Inside the safe in the pump-station control room after draining the water.', image: guide('terminalpumpingstationmap.png'), sourceUrl: ticket },
      { id: 'starting-supplies', filter: 'loot-supplies', kind: 'loot', left: 34.5, top: 18.9, floor: 1, title: 'Starting supplies', details: 'Short collection window for food, water, medicine, armor and small consumables before the assault begins.', sourceUrl: ticket },
      { id: 'armory-equipment', filter: 'loot-supplies', kind: 'loot', left: 26.4, top: 32.0, floor: 1, title: 'Confiscated equipment', details: 'Your equipment is stored in a random locker inside the armory.', image: guide('armory_key_map.png'), sourceUrl: ticket },
      { id: 'admin-supplies', filter: 'loot-supplies', kind: 'loot', left: 43.5, top: 39.2, floor: 1, title: 'Administration hallway supplies', details: 'Provisions and medical supplies are scattered in the hallway after the service-passage door.', sourceUrl: ticket },

      {
        id: 'terminal-boss-area', filter: 'boss-terminal', kind: 'boss', left: 57.2, top: 73.8, floor: 1,
        title: 'Random boss spawn area',
        details: 'One random boss can spawn in the medium container ship berths: Glukhar, Killa, Reshala, Sanitar, or Tagilla.',
        image: guide('terminal_bosses_map.jpg'), sourceUrl: wiki
      },
      {
        id: 'zubr-extract', filter: 'extract-zubr', kind: 'extract', left: 85.2, top: 60.6, floor: 1,
        title: 'Zubr Boat', details: 'PMC, always available, single use. Seats depend on the entering party size; carry the Alpha-1 evidence container when required by your ending.',
        image: guide('theticketterminalreachingpierpathmap.png'), sourceUrl: wiki
      },

      { id: 'poi-infiltration', filter: 'map-locations', kind: 'location', left: 35.0, top: 11.6, floor: 1, title: 'Infiltration / security checkpoint', details: 'Terminal entry and security-check sequence.' },
      { id: 'poi-armory', filter: 'map-locations', kind: 'location', left: 26.4, top: 32.0, floor: 1, title: 'Armory', details: 'Keyed building containing the confiscated loadout.' },
      { id: 'poi-seaport', filter: 'map-locations', kind: 'location', left: 19.6, top: 33.3, floor: 1, title: 'Seaport Terminal', details: 'Black Division keycard building.' },
      { id: 'poi-admin', filter: 'map-locations', kind: 'location', left: 43.5, top: 39.2, floor: 1, title: 'Administration building', details: 'Service passage to the loading zone.' },
      { id: 'poi-pump', filter: 'map-locations', kind: 'location', left: 34.3, top: 77.5, floor: 1, title: 'Pump station', details: 'Drain controls and Pier door key safe.' },
      { id: 'poi-pier', filter: 'map-locations', kind: 'location', left: 81.7, top: 86.9, floor: 1, title: 'Pier checkpoint', details: 'Locked final approach toward the Zubr Boat.' },

      { id: 'panel-1', filter: 'map-panels', kind: 'panel', left: 40.6, top: 17.0, floor: 1, title: 'Electrical panel 1', details: 'Possible broken-panel location. Look for an open cover, red blinking light and sparks.', image: guide('terminalelectricalpanelsmap.png'), sourceUrl: ticket },
      { id: 'panel-2', filter: 'map-panels', kind: 'panel', left: 34.8, top: 30.8, floor: 1, title: 'Electrical panel 2', details: 'Possible broken-panel location.', image: guide('terminalelectricalpanelsmap.png'), sourceUrl: ticket },
      { id: 'panel-3', filter: 'map-panels', kind: 'panel', left: 39.7, top: 31.5, floor: 1, title: 'Electrical panel 3', details: 'Possible broken-panel location.', image: guide('terminalelectricalpanelsmap.png'), sourceUrl: ticket },
      { id: 'panel-4', filter: 'map-panels', kind: 'panel', left: 44.1, top: 29.3, floor: 1, title: 'Electrical panel 4', details: 'Possible broken-panel location.', image: guide('terminalelectricalpanelsmap.png'), sourceUrl: ticket },
      { id: 'panel-5', filter: 'map-panels', kind: 'panel', left: 43.8, top: 36.1, floor: 1, title: 'Electrical panel 5', details: 'Possible broken-panel location.', image: guide('terminalelectricalpanelsmap.png'), sourceUrl: ticket },
      { id: 'panel-6', filter: 'map-panels', kind: 'panel', left: 42.3, top: 43.9, floor: 1, title: 'Electrical panel 6', details: 'Possible broken-panel location.', image: guide('terminalelectricalpanelsmap.png'), sourceUrl: ticket },
      { id: 'panel-7', filter: 'map-panels', kind: 'panel', left: 42.5, top: 51.3, floor: 1, title: 'Electrical panel 7', details: 'Possible broken-panel location.', image: guide('terminalelectricalpanelsmap.png'), sourceUrl: ticket },
      { id: 'panel-8', filter: 'map-panels', kind: 'panel', left: 32.1, top: 50.8, floor: 1, title: 'Electrical panel 8', details: 'Possible broken-panel location.', image: guide('terminalelectricalpanelsmap.png'), sourceUrl: ticket },
      { id: 'panel-9', filter: 'map-panels', kind: 'panel', left: 34.0, top: 55.8, floor: 1, title: 'Electrical panel 9', details: 'Possible broken-panel location.', image: guide('terminalelectricalpanelsmap.png'), sourceUrl: ticket },
      { id: 'panel-10', filter: 'map-panels', kind: 'panel', left: 32.1, top: 79.0, floor: 1, title: 'Electrical panel 10', details: 'Possible broken-panel location at the pump station.', image: guide('terminalelectricalpanelsmap.png'), sourceUrl: ticket }
    ]
  };
})();
