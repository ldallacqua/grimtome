/** Core enumerations shared by every domain module. Keep this file dependency-free. */

export const CLASS_IDS = [
  'barbarian',
  'druid',
  'necromancer',
  'rogue',
  'sorcerer',
  'spiritborn',
  'paladin',
  'warlock',
] as const;
export type ClassId = (typeof CLASS_IDS)[number];

export const SLOTS = [
  'helm',
  'chest',
  'gloves',
  'pants',
  'boots',
  'amulet',
  'ring',
  'weapon',
  'offhand',
] as const;
export type Slot = (typeof SLOTS)[number];

export const RARITIES = ['common', 'magic', 'rare', 'legendary', 'unique', 'mythic'] as const;
export type Rarity = (typeof RARITIES)[number];

export const BUILD_ROLES = ['leveling', 'endgame'] as const;
export type BuildRole = (typeof BUILD_ROLES)[number];

export const CLASS_NAMES: Record<ClassId, string> = {
  barbarian: 'Barbarian',
  druid: 'Druid',
  necromancer: 'Necromancer',
  rogue: 'Rogue',
  sorcerer: 'Sorcerer',
  spiritborn: 'Spiritborn',
  paladin: 'Paladin',
  warlock: 'Warlock',
};

export const SLOT_NAMES: Record<Slot, string> = {
  helm: 'Helm',
  chest: 'Chest Armor',
  gloves: 'Gloves',
  pants: 'Pants',
  boots: 'Boots',
  amulet: 'Amulet',
  ring: 'Ring',
  weapon: 'Weapon',
  offhand: 'Off-hand',
};

/** Level cap and Paragon cap for the supported game version (Season 15 / patch 3.2). */
export const MAX_CHARACTER_LEVEL = 70;
export const MAX_PARAGON_LEVEL = 300;

export function isClassId(v: unknown): v is ClassId {
  return typeof v === 'string' && (CLASS_IDS as readonly string[]).includes(v);
}

/** Lowercase, punctuation-free identifier segment (mirrors `slug` in the Rust catalog). */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
