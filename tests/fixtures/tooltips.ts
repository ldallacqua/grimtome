/**
 * Tooltip text fixtures written for Grimtome's tests. They mirror the *layout*
 * of Diablo IV tooltips (header, type line, item power, affixes, power text,
 * footer) using original wording for flavor and powers.
 *
 * The same specs drive the synthetic PNG tooltips rendered by
 * `scripts/render-tooltip-fixtures.mjs` for OCR tests.
 */

export interface TooltipFixture {
  id: string;
  lines: string[];
  /** Optional color hints as an OCR engine would sample them. */
  colors?: Record<number, { color?: string; iconColor?: string }>;
}

export const RARE_GLOVES_CRIT: TooltipFixture = {
  id: 'rare-gloves-crit',
  lines: [
    'Grim Grasp',
    'Ancestral Rare Gloves',
    '800 Item Power',
    '1,126 Armor',
    '◆ +12.5% Critical Strike Chance [10.0 - 15.0]%',
    '◆ +16.0% Attack Speed [12.0 - 18.0]%',
    '◆ +92 Strength [70 - 110]',
    '◆ +8.5% Lucky Hit Chance',
    'Requires Level 60',
    'Sell Value: 24,512',
    'Durability: 100/100',
  ],
  colors: { 0: { color: '#ffff64' }, 4: { iconColor: '#9a9a9a' } },
};

export const LEGENDARY_GLOVES_EARTHQUAKES: TooltipFixture = {
  id: 'legendary-gloves-earthquakes',
  lines: [
    'Gauntlets of Earthquakes',
    'Ancestral Legendary Gloves',
    '800 Item Power',
    '1,190 Armor',
    '★ +14.0% Critical Strike Chance',
    '◆ +5.5% Movement Speed',
    '◆ +120 Maximum Life',
    '◆ +21.0% Fire Resistance',
    'Ground Stomp and Leap leave behind tremors that deal 1,420',
    'Physical damage over 4 seconds.',
    'Empty Socket',
    'Requires Level 60',
    'Sell Value: 31,002',
  ],
  colors: { 0: { color: '#f08a2c' }, 4: { iconColor: '#f0a028' } },
};

export const UNIQUE_MAGNUM_OPUS: TooltipFixture = {
  id: 'unique-magnum-opus',
  lines: [
    "Ramaladni's Magnum Opus",
    'Unique Two-Handed Mace',
    '800 Item Power',
    '4,980 Damage Per Second',
    '◆ +22.0% Vulnerable Damage',
    '◆ +45.0% Critical Strike Damage',
    '◆ +98 Strength',
    'Skills deal additional damage for each point of Fury you have, but you no longer passively generate Fury.',
    'Unique Equip',
    'Requires Level 60',
  ],
  colors: { 0: { color: '#c7b377' } },
};

export const MYTHIC_HARLEQUIN: TooltipFixture = {
  id: 'mythic-harlequin',
  lines: [
    'Harlequin Crest',
    'Mythic Unique Helm',
    '925 Item Power',
    '1,402 Armor',
    '★ +2 to All Skills',
    '◆ +20.0% Cooldown Reduction',
    '◆ +1,520 Maximum Life',
    'Gain bonus damage reduction and additional ranks to all of your skills.',
    'Requires Level 60',
  ],
};

export const RARE_RING_UNKNOWN: TooltipFixture = {
  id: 'rare-ring-unknown',
  lines: [
    'Ember Band',
    'Rare Ring',
    '750 Item Power',
    '◆ +18.0% Lightning Resistance',
    '◆ +7.5% Gold Drop Rate',
    'Requires Level 55',
  ],
};

export const RARE_AMULET_ENDGAME: TooltipFixture = {
  id: 'rare-amulet-endgame',
  lines: [
    'Sigil of Ashes',
    'Ancestral Rare Amulet',
    '800 Item Power',
    '◆ +9.0% Cooldown Reduction',
    '★ +11.5% Damage Reduction',
    '◆ +4.0% Movement Speed',
    'Requires Level 60',
  ],
};

export const GARBLED: TooltipFixture = {
  id: 'garbled',
  lines: ['~~ ~', 'Ll1 I11', '+?? ###', 'xX x'],
};
