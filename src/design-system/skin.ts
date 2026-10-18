import { useEffect } from 'react';
import type { AssetResolver } from '@/services/assets/resolver';

/**
 * The native theme: Diablo IV's own interface textures, imported locally by the
 * user, exposed to CSS as custom properties (`--d4-<name>: url(...)`).
 *
 * Components style themselves with `:root[data-skin='game']` rules that read
 * these variables. Without imported assets (web build, CI, users who opt out)
 * `data-skin` is absent and Grimtome's original styling applies. Nothing here is
 * bundled: every value resolves through the local asset manifest at runtime.
 *
 * Frame numbers refer to atlas frames exported by `d4data` (see docs/ASSETS.md).
 */
export const SKIN_TEXTURES = {
  // Surfaces and frames
  'bg-app': 'ui.tiled-hellgothicbase',
  'bg-stone': 'ui.tiled-stonebasetile',
  panel: 'ui.nine.panel',
  'frame-iron': 'ui.nine.frame-iron',
  'frame-modal': 'ui.frames-modal.13',
  selection: 'ui.nine.selection',
  'header-ornament': 'ui.frames-modal.11',
  'header-plate': 'ui.social-header.14',
  'header-plate-ornate': 'ui.social-header.11',
  'statue-angel': 'ui.frames.10',
  'titlebar-l': 'ui.menunav.15',
  'titlebar-r': 'ui.menunav.16',
  'titlebar-mid': 'ui.menunav.3',
  'titlebar-fire': 'ui.menunav.17',
  'title-plate': 'ui.frames.9',
  'edge-v': 'ui.frames.1',
  'edge-v-top': 'ui.tiled-frameedgevertical.2',
  'edge-v-bottom': 'ui.tiled-frameedgevertical.0',
  'thorns-red': 'ui.frames.6',

  // Rules and dividers
  'rule-cap-l': 'ui.tiled-horizontalframedivider.0',
  'rule-line': 'ui.tiled-horizontalframedivider.1',
  'rule-center': 'ui.tiled-horizontalframedivider.2',
  'rule-cap-r': 'ui.tiled-horizontalframedivider.4',
  divider: 'ui.center-divider.3',
  'divider-half-l': 'ui.tooltip.9',
  'divider-half-r': 'ui.tooltip.12',

  // Buttons
  btn: 'ui.buttons.95',
  'btn-active': 'ui.buttons.96',
  'btn-primary': 'ui.buttons.97',
  'btn-primary-hover': 'ui.buttons.99',
  'btn-primary-active': 'ui.buttons.98',
  'btn-hero': 'ui.buttons-sharedelements.13',
  'btn-hero-hover': 'ui.buttons-sharedelements.14',
  'btn-hero-active': 'ui.buttons-sharedelements.15',
  'btn-danger': 'ui.buttons-sharedelements.18',
  'btn-danger-hover': 'ui.buttons-sharedelements.19',
  'btn-danger-active': 'ui.buttons-sharedelements.20',
  'btn-stone': 'ui.buttons.121',
  'btn-stone-hover': 'ui.buttons.122',
  'btn-stone-active': 'ui.buttons.123',
  'btn-square': 'ui.buttons.60',
  'btn-square-hover': 'ui.buttons.61',
  'btn-square-active': 'ui.buttons.62',
  'win-close': 'ui.buttons.67',
  'win-close-hover': 'ui.buttons.69',
  'win-max': 'ui.buttons-sharedelements.7',
  'win-max-hover': 'ui.buttons-sharedelements.8',
  'win-min': 'ui.controls.8',

  // Navigation
  'nav-hover': 'ui.listbanner.0',
  'nav-active': 'ui.listbanner.1',
  'nav-glow': 'ui.listbanner.2',
  tab: 'ui.smalltabs.3',
  'tab-hover': 'ui.smalltabs.3',
  'tab-active': 'ui.smalltabs.0',
  'tab-disabled': 'ui.smalltabs.3',
  'nav-dashboard': 'ui.menunav.22',
  'nav-dashboard-on': 'ui.menunav.23',
  'nav-advisor': 'ui.inventorytabicons.23',
  'nav-advisor-on': 'ui.inventorytabicons.22',
  'nav-skills': 'ui.menunav.32',
  'nav-skills-on': 'ui.menunav.33',
  'nav-paragon': 'ui.menunav.25',
  'nav-paragon-on': 'ui.menunav.26',
  'nav-builds': 'ui.menunav.72',
  'nav-builds-on': 'ui.menunav.73',
  'nav-settings': 'ui.inventorytabicons.6',
  'nav-settings-on': 'ui.inventorytabicons.7',

  // Form controls
  input: 'ui.controls.80',
  'input-hover': 'ui.controls.81',
  'input-focus': 'ui.gameoptions.4',
  'select-arrow': 'ui.controls.14',
  checkbox: 'ui.controls.33',
  'checkbox-hover': 'ui.controls.32',
  'checkbox-on': 'ui.controls.30',
  'checkbox-on-hover': 'ui.controls.29',
  radio: 'ui.controls.47',
  'radio-hover': 'ui.controls.46',
  'radio-on': 'ui.controls.44',
  'radio-on-hover': 'ui.controls.43',
  'slider-track': 'ui.controls.26',
  'slider-fill': 'ui.controls.25',
  'slider-thumb': 'ui.controls.37',
  'scroll-track': 'ui.controls.18',
  'scroll-thumb': 'ui.controls.20',
  'scroll-thumb-hover': 'ui.controls.19',
  'step-minus': 'ui.controls.8',
  'step-plus': 'ui.controls.10',

  // Meters
  'meter-track': 'ui.progressbars.13',
  'meter-frame': 'ui.progressbars.12',
  'meter-fill-red': 'ui.progressbars.14',
  'meter-fill-orange': 'ui.progressbars.19',
  'meter-fill-blue': 'ui.progressbars.24',
  'meter-fill-teal': 'ui.progressbars.0',
  'ring-frame': 'ui.gameoptions.5',
  'empty-wreath': 'ui.paragon-transparentelements.0',

  // Item tooltips
  'tooltip-common': 'ui.nine.tooltip-common',
  'tooltip-magic': 'ui.nine.tooltip-magic',
  'tooltip-rare': 'ui.nine.tooltip-rare',
  'tooltip-legendary': 'ui.nine.tooltip-legendary',
  'tooltip-unique': 'ui.nine.tooltip-unique',
  'tooltip-mythic': 'ui.nine.tooltip-mythic',
  'item-divider': 'ui.tooltip.8',
  bullet: 'ui.fonticon.0',
  'bullet-ga': 'ui.fonticon.65',
  'bullet-tempered': 'ui.fonticon.86',
  'cmp-up': 'ui.fonticon.8',
  'cmp-up-2': 'ui.fonticon.9',
  'cmp-down': 'ui.fonticon.7',
  socket: 'ui.itemcomponents.0',

  // Verdicts (native glyphs: upgrade arrow, star, stash bag, salvage anvil, alert)
  'verdict-upgrade': 'ui.fonticon.8',
  'verdict-keep': 'ui.fonticon.3',
  'verdict-stash': 'ui.inventorytabicons.3',
  'verdict-salvage': 'ui.tooltip-icons.27',
  'verdict-review': 'ui.fonticon.19',
  'verdict-ring': 'ui.skills.9',
  plate: 'ui.buttons-sharedelements.0',
  'plate-gold': 'ui.buttons-sharedelements.1',
  keycap: 'ui.buttons.15',

  // Toasts and notices
  'toast-bg': 'ui.minitoasts.0',
  'toast-edge-red': 'ui.minitoasts.7',
  'toast-edge-gold': 'ui.minitoasts.3',
  'toast-edge-teal': 'ui.minitoasts.6',
  'toast-edge-blue': 'ui.minitoasts.4',
  'toast-edge-violet': 'ui.minitoasts.2',
  'toast-edge-orange': 'ui.minitoasts.8',

  // Inventory: empty-slot silhouettes and rarity wells
  'slot-amulet': 'ui.paperdoll-emptysloticons.15',
  'slot-boots': 'ui.paperdoll-emptysloticons.16',
  'slot-gloves': 'ui.paperdoll-emptysloticons.17',
  'slot-helm': 'ui.paperdoll-emptysloticons.18',
  'slot-pants': 'ui.paperdoll-emptysloticons.19',
  'slot-ring': 'ui.paperdoll-emptysloticons.20',
  'slot-offhand': 'ui.paperdoll-emptysloticons.21',
  'slot-weapon': 'ui.paperdoll-emptysloticons.22',
  'slot-chest': 'ui.paperdoll-emptysloticons.23',
  'well-common': 'ui.2dinventory-itemrarities.0',
  'well-unique': 'ui.2dinventory-itemrarities.1',
  'well-rare': 'ui.2dinventory-itemrarities.2',
  'well-mythic': 'ui.2dinventory-itemrarities.3',
  'well-magic': 'ui.2dinventory-itemrarities.4',
  'well-legendary': 'ui.2dinventory-itemrarities.5',

  // Skill and paragon frames
  'skill-frame': 'ui.skills.0',
  'skill-frame-round': 'ui.skills.14',
  'skill-frame-diamond': 'ui.skilltree-abcdframes.0',
  'skill-frame-diamond-on': 'ui.skilltree-abcdframes.1',
  'skill-frame-diamond-off': 'ui.skilltree-abcdframes.2',
  pip: 'ui.fonticon.2',
  'pip-planned': 'ui.fonticon.10',
  'pip-on': 'ui.fonticon.27',
  'paragon-node': 'ui.paragon-transparentelements.21',
  'paragon-node-magic': 'ui.paragon-transparentelements.17',
  'paragon-node-rare': 'ui.paragon-transparentelements.10',
  'paragon-node-legendary': 'ui.paragon-transparentelements.13',
  'paragon-socket': 'ui.paragon-transparentelements.19',
} as const;

export type SkinTexture = keyof typeof SKIN_TEXTURES;

/** Without these the native theme would look broken, so it stays off. */
const REQUIRED: SkinTexture[] = ['panel', 'btn', 'btn-primary', 'tooltip-legendary', 'input', 'checkbox'];

/** Builds the `--d4-*` declarations, or null when the cache lacks required textures. */
export function skinVariables(resolver: AssetResolver): Record<string, string> | null {
  if (REQUIRED.some((k) => !resolver.has(SKIN_TEXTURES[k]))) return null;
  const vars: Record<string, string> = {};
  for (const [name, id] of Object.entries(SKIN_TEXTURES)) {
    const url = resolver.url(id);
    if (url) vars[`--d4-${name}`] = `url("${url}")`;
  }
  return vars;
}

/**
 * Applies (or removes) the native theme on the document root. Textures that a
 * given cache lacks simply stay unset, and each rule keeps its CSS fallback.
 */
export function useGameSkin(resolver: AssetResolver, enabled: boolean): boolean {
  const vars = enabled ? skinVariables(resolver) : null;
  const key = vars ? JSON.stringify(vars) : '';
  useEffect(() => {
    const root = document.documentElement;
    if (!vars) {
      delete root.dataset.skin;
      return;
    }
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    root.dataset.skin = 'game';
    return () => {
      for (const k of Object.keys(vars)) root.style.removeProperty(k);
      delete root.dataset.skin;
    };
    // `key` captures the variable set; `vars` is rebuilt each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return !!vars;
}
