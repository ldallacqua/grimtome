import type { Verdict } from './types';

/**
 * Human-readable text for reasons and verdicts.
 *
 * The engine emits stable `code`s with parameters; this module renders them.
 * Keeping the wording here (and per locale) lets the UI translate explanations
 * without touching the rules, and keeps future AI-written explanations grounded
 * in the same structured facts.
 */

export type ReasonCode =
  | 'low-confidence'
  | 'unknown-slot'
  | 'unique-active'
  | 'unique-future'
  | 'unique-unused'
  | 'mythic-unused'
  | 'aspect-active'
  | 'aspect-future'
  | 'aspect-unidentified'
  | 'affixes-active'
  | 'affixes-future'
  | 'greater-affix'
  | 'missing-essentials'
  | 'no-guidance'
  | 'no-value'
  | 'equipped-better'
  | 'compare-equipped'
  | 'ancestral';

export type Params = Record<string, string | number>;
export type Locale = 'en' | 'pt-BR';

type Table = Record<ReasonCode, (p: Params) => string>;

const list = (v: unknown) => String(v ?? '');

const en: Table = {
  'low-confidence': () => 'The tooltip could not be read reliably, so no firm recommendation is given.',
  'unknown-slot': () => 'The equipment slot could not be determined.',
  'unique-active': (p) => `${p.unique} is ${p.required ? 'a core unique' : 'used'} in your ${p.build} build.`,
  'unique-future': (p) => `${p.unique} is ${p.required ? 'required' : 'used'} by your planned ${p.build} build.`,
  'unique-unused': (p) => `Neither build uses ${p.unique}.`,
  'mythic-unused': () => 'Mythic uniques are rare — even unused ones are worth keeping until you have checked other builds.',
  'aspect-active': (p) => `Carries ${p.aspect}, which your ${p.build} build uses${p.slot ? ` on ${p.slot}` : ''}.`,
  'aspect-future': (p) => `Carries ${p.aspect}, which your planned ${p.build} build needs.`,
  'aspect-unidentified': () => 'Its legendary power could not be matched to an aspect your builds use.',
  'affixes-active': (p) => `Has ${p.count} of the top priorities for this slot in ${p.build}: ${list(p.labels)}.`,
  'affixes-future': (p) => `Has ${p.count} priority affix${Number(p.count) === 1 ? '' : 'es'} for ${p.build}: ${list(p.labels)}.`,
  'greater-affix': (p) => `Greater Affix on ${list(p.labels)}.`,
  'missing-essentials': (p) => `Missing essential stats for ${p.build}: ${list(p.labels)}.`,
  'no-guidance': (p) => `${p.build} has no gear guidance for this slot.`,
  'no-value': () => 'No match with either build’s uniques, aspects or priority affixes.',
  'equipped-better': (p) => `Your equipped ${p.slot} fits ${p.build} better.`,
  'compare-equipped': (p) => `Compare it with your equipped ${p.slot} before swapping.`,
  ancestral: () => 'Ancestral item — eligible for the strongest rolls and Greater Affixes.',
};

const ptBR: Table = {
  'low-confidence': () => 'Não foi possível ler a dica com confiança, então nenhuma recomendação firme é dada.',
  'unknown-slot': () => 'Não foi possível identificar o compartimento do equipamento.',
  'unique-active': (p) => `${p.unique} é ${p.required ? 'um único essencial' : 'usado'} na sua build ${p.build}.`,
  'unique-future': (p) => `${p.unique} é ${p.required ? 'necessário' : 'usado'} na sua build planejada ${p.build}.`,
  'unique-unused': (p) => `Nenhuma build usa ${p.unique}.`,
  'mythic-unused': () => 'Únicos míticos são raros — guarde até verificar outras builds.',
  'aspect-active': (p) => `Possui ${p.aspect}, usado pela sua build ${p.build}${p.slot ? ` em ${p.slot}` : ''}.`,
  'aspect-future': (p) => `Possui ${p.aspect}, necessário para sua build planejada ${p.build}.`,
  'aspect-unidentified': () => 'O poder lendário não corresponde a nenhum aspecto das suas builds.',
  'affixes-active': (p) => `Tem ${p.count} das prioridades deste compartimento em ${p.build}: ${list(p.labels)}.`,
  'affixes-future': (p) => `Tem ${p.count} afixo(s) prioritário(s) para ${p.build}: ${list(p.labels)}.`,
  'greater-affix': (p) => `Afixo Maior em ${list(p.labels)}.`,
  'missing-essentials': (p) => `Faltam atributos essenciais para ${p.build}: ${list(p.labels)}.`,
  'no-guidance': (p) => `${p.build} não tem orientação de equipamento para este compartimento.`,
  'no-value': () => 'Nenhuma correspondência com únicos, aspectos ou afixos prioritários das suas builds.',
  'equipped-better': (p) => `Seu ${p.slot} equipado é melhor para ${p.build}.`,
  'compare-equipped': (p) => `Compare com seu ${p.slot} equipado antes de trocar.`,
  ancestral: () => 'Item ancestral — pode ter os melhores valores e Afixos Maiores.',
};

const TABLES: Record<Locale, Table> = { en, 'pt-BR': ptBR };

export function renderReason(code: ReasonCode, params: Params, locale: Locale = 'en'): string {
  return (TABLES[locale] ?? en)[code](params);
}

export const VERDICT_LABELS: Record<Locale, Record<Verdict, string>> = {
  en: {
    upgrade: 'Upgrade candidate',
    keep: 'Keep',
    stash: 'Stash for endgame',
    salvage: 'Salvage / sell',
    review: 'Needs review',
  },
  'pt-BR': {
    upgrade: 'Possível melhoria',
    keep: 'Manter',
    stash: 'Guardar para o endgame',
    salvage: 'Desmontar / vender',
    review: 'Revisar',
  },
};
