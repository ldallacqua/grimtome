import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { ParsedAffix } from '@/domain/items/types';
import type { Rarity, Slot } from '@/domain/shared/ids';
import { Icon } from '../icons';
import { ItemIcon, RarityGlyph } from './GameIcon';
import './ItemCard.css';

const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  magic: 'Magic',
  rare: 'Rare',
  legendary: 'Legendary',
  unique: 'Unique',
  mythic: 'Mythic Unique',
};

export interface AffixAnnotation {
  /** Matched by the active build (weight 1–3). */
  active?: 1 | 2 | 3;
  /** Matched by the future (endgame) build. */
  future?: 1 | 2 | 3;
}

export interface ItemCardProps {
  name: string | null;
  rarity: Rarity | null;
  ancestral?: boolean;
  itemType: string | null;
  slot: Slot | null;
  itemPower: number | null;
  baseStats?: string[];
  affixes: ParsedAffix[];
  powerText: string | null;
  sockets?: number;
  masterwork?: { rank: number; max: number } | null;
  requiredLevel?: number | null;
  iconId?: string | null;
  annotations?: Record<number, AffixAnnotation>;
  footer?: ReactNode;
  compact?: boolean;
  className?: string;
}

function Separator() {
  return (
    <div className="gt-item-card__sep" role="separator">
      <span />
      <i />
      <span />
    </div>
  );
}

/** Affix bullet: game glyphs with the native skin, CSS shapes otherwise. */
function Bullet({ affix }: { affix: ParsedAffix }) {
  if (affix.greater) {
    return (
      <span className="gt-affix__bullet gt-affix__bullet--ga" title="Greater Affix" aria-label="Greater Affix">
        <span aria-hidden>✦</span>
      </span>
    );
  }
  if (affix.tempered) {
    return (
      <span className="gt-affix__bullet gt-affix__bullet--tempered" title="Tempered affix">
        <Icon name="salvage" size={13} strokeWidth={2} />
      </span>
    );
  }
  return <span className="gt-affix__bullet gt-affix__bullet--plain" aria-hidden />;
}

function formatValue(a: ParsedAffix): string | null {
  if (a.value === null) return null;
  const decimals = /\d[.,](\d+)/.exec(a.raw.replace(/\[[^\]]*\]/g, ''))?.[1]?.length ?? 0;
  const v = decimals && !/^\d{1,3}([.,]\d{3})+$/.test(String(a.value)) ? a.value.toFixed(Math.min(2, decimals)) : a.value.toLocaleString('en-US');
  const sign = a.value >= 0 && /\+\s*\d/.test(a.raw) ? '+' : a.value >= 0 && a.key?.startsWith('skill-ranks') ? '+' : '';
  return `${sign}${v}${a.percent ? '%' : ''}`;
}

export function ItemCard({
  name,
  rarity,
  ancestral,
  itemType,
  slot,
  itemPower,
  baseStats = [],
  affixes,
  powerText,
  sockets = 0,
  masterwork,
  requiredLevel,
  iconId,
  annotations,
  footer,
  compact,
  className,
}: ItemCardProps) {
  const typeLine = [ancestral ? 'Ancestral' : null, rarity ? RARITY_LABEL[rarity] : null, itemType].filter(Boolean).join(' ');
  return (
    <article
      className={clsx('gt-item-card', compact && 'gt-item-card--compact', className)}
      data-rarity={rarity ?? 'common'}
      aria-label={name ?? 'Unnamed item'}
    >
      <header className="gt-item-card__header">
        <ItemIcon id={iconId ?? null} slot={slot} rarity={rarity} size={compact ? 52 : 68} />
        <div className="gt-item-card__titles">
          <h3 className="gt-item-card__name">{name ?? 'Unknown item'}</h3>
          <div className="gt-item-card__type">{typeLine || 'Unknown type'}</div>
        </div>
        <RarityGlyph rarity={rarity} size={compact ? 22 : 28} />
      </header>
      <div className="gt-item-card__body">
        {itemPower !== null ? (
          <div className="gt-item-card__power">
            <span className="gt-num">{itemPower.toLocaleString('en-US')}</span> Item Power
          </div>
        ) : null}
        {baseStats.map((b) => (
          <div key={b} className="gt-item-card__base">
            {b}
          </div>
        ))}
        {affixes.length ? (
          <>
            <Separator />
            <ul className="gt-item-card__affixes">
              {affixes.map((a, i) => {
                const ann = annotations?.[i];
                const value = formatValue(a);
                return (
                  <li key={`${a.raw}-${i}`} className={clsx('gt-affix', !a.key && 'is-unknown', a.greater && 'is-greater')}>
                    <Bullet affix={a} />
                    <span className="gt-affix__text">
                      {value ? <span className="gt-affix__value gt-num">{value}</span> : null}{' '}
                      <span className="gt-affix__label">{a.key ? a.label : a.raw}</span>
                    </span>
                    <span className="gt-affix__tags">
                      {!a.key ? (
                        <span className="gt-affix__tag gt-affix__tag--unknown" title="Not recognized">
                          ?
                        </span>
                      ) : null}
                      {ann?.active ? (
                        <span className="gt-affix__dot gt-affix__dot--active" title={`Priority ${ann.active}/3 for your active build`} />
                      ) : null}
                      {ann?.future ? (
                        <span className="gt-affix__dot gt-affix__dot--future" title={`Priority ${ann.future}/3 for your endgame build`} />
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
        {powerText ? (
          <>
            <Separator />
            <p className="gt-item-card__lore">{powerText}</p>
          </>
        ) : null}
        {sockets || masterwork || requiredLevel ? (
          <div className="gt-item-card__meta">
            {Array.from({ length: sockets }, (_, i) => (
              <span key={i} className="gt-item-card__socket" title="Empty socket" />
            ))}
            {masterwork ? (
              <span className="gt-item-card__mw">
                Masterwork <span className="gt-num">{masterwork.rank}</span>/<span className="gt-num">{masterwork.max}</span>
              </span>
            ) : null}
            {requiredLevel ? <span className="gt-item-card__req">Requires Level {requiredLevel}</span> : null}
          </div>
        ) : null}
        {footer ? <div className="gt-item-card__footer">{footer}</div> : null}
      </div>
    </article>
  );
}
