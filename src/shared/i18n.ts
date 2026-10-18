import { useApp } from '@/app/store';

/**
 * Minimal typed i18n. English is the source of truth; other locales may be
 * partial and fall back to English per key. Add a locale by adding a table.
 */

const en = {
  'nav.dashboard': 'Dashboard',
  'nav.advisor': 'Item Advisor',
  'nav.skills': 'Skills',
  'nav.paragon': 'Paragon',
  'nav.builds': 'Builds',
  'nav.settings': 'Settings',
  'nav.section.play': 'Companion',
  'nav.section.plan': 'Planning',
  'action.scan': 'Scan item',
  'action.scanning': 'Reading tooltip…',
  'action.upload': 'Upload screenshot',
  'action.paste': 'Paste tooltip text',
  'overlay.label': 'In-game overlay',
  'role.leveling': 'Leveling',
  'role.endgame': 'Endgame',
  'character.level': 'Level',
  'character.paragon': 'Paragon',
  'build.none': 'No build loaded',
  'transition.available': 'Endgame transition available',
} as const;

export type MessageKey = keyof typeof en;
type Table = Partial<Record<MessageKey, string>>;

const ptBR: Table = {
  'nav.dashboard': 'Painel',
  'nav.advisor': 'Conselheiro de Itens',
  'nav.skills': 'Habilidades',
  'nav.paragon': 'Paragon',
  'nav.builds': 'Builds',
  'nav.settings': 'Configurações',
  'nav.section.play': 'Companheiro',
  'nav.section.plan': 'Planejamento',
  'action.scan': 'Analisar item',
  'action.scanning': 'Lendo a dica…',
  'action.upload': 'Enviar captura',
  'action.paste': 'Colar texto da dica',
  'overlay.label': 'Sobreposição no jogo',
  'role.leveling': 'Evolução',
  'role.endgame': 'Endgame',
  'character.level': 'Nível',
  'character.paragon': 'Paragon',
  'build.none': 'Nenhuma build carregada',
  'transition.available': 'Transição para o endgame disponível',
};

const TABLES: Record<string, Table> = { en, 'pt-BR': ptBR };

export function translate(lang: string, key: MessageKey): string {
  return TABLES[lang]?.[key] ?? en[key];
}

export function useT() {
  const lang = useApp((s) => s.settings.language);
  return (key: MessageKey) => translate(lang, key);
}
