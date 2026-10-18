import clsx from 'clsx';
import type { CSSProperties } from 'react';
import type { ClassId, Rarity, Slot } from '@/domain/shared/ids';
import { useAssets } from '../assets-context';
import { Icon } from '../icons';
import './GameIcon.css';

/**
 * Game-entity icons. Each renders an imported game asset when available and an
 * original Grimtome fallback otherwise, so layouts never depend on game files.
 */

const RARITY_FRAME: Partial<Record<Rarity, number>> = { common: 0, unique: 1, rare: 2, mythic: 3, magic: 4, legendary: 5 };

function initials(name: string): string {
  const words = name.replace(/[^A-Za-z\s]/g, '').split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

export function SkillIcon({
  id,
  name,
  size = 48,
  state = 'idle',
  className,
}: {
  id?: string | null;
  name: string;
  size?: number;
  state?: 'idle' | 'learned' | 'next' | 'locked';
  className?: string;
}) {
  const { resolver } = useAssets();
  const url = resolver.url(id);
  return (
    <span
      className={clsx('gt-skill-icon', `is-${state}`, !url && 'is-fallback', className)}
      style={{ '--size': `${size}px` } as CSSProperties}
      title={name}
    >
      {url ? <img src={url} alt="" draggable={false} /> : <span className="gt-skill-icon__rune">{initials(name)}</span>}
    </span>
  );
}

export function RarityGlyph({ rarity, size = 18 }: { rarity: Rarity | null; size?: number }) {
  const { resolver, enhanced } = useAssets();
  const frame = rarity ? RARITY_FRAME[rarity] : undefined;
  const url = enhanced && frame !== undefined ? resolver.url(`ui.2dinventory-itemrarities.${frame}`) : null;
  if (url) return <img className="gt-rarity-glyph" src={url} alt="" style={{ width: size, height: size }} draggable={false} />;
  return <span className="gt-rarity-glyph gt-rarity-glyph--css" data-rarity={rarity ?? 'common'} style={{ width: size * 0.62, height: size * 0.62 }} />;
}

export function ItemIcon({
  id,
  slot,
  rarity,
  size = 64,
  className,
}: {
  id?: string | null;
  slot: Slot | null;
  rarity: Rarity | null;
  size?: number;
  className?: string;
}) {
  const { resolver } = useAssets();
  const url = resolver.url(id);
  return (
    <span
      className={clsx('gt-item-icon', className)}
      data-rarity={rarity ?? 'common'}
      style={{ '--size': `${size}px` } as CSSProperties}
    >
      <span className="gt-item-icon__glow" aria-hidden />
      {url ? (
        <img src={url} alt="" draggable={false} />
      ) : (
        <Icon name={slot ?? 'gem'} size={Math.round(size * 0.46)} strokeWidth={1.3} className="gt-item-icon__glyph" />
      )}
    </span>
  );
}

const CLASS_GLYPH: Record<ClassId, string> = {
  barbarian: 'Ba',
  druid: 'Dr',
  necromancer: 'Ne',
  rogue: 'Ro',
  sorcerer: 'So',
  spiritborn: 'Sp',
  paladin: 'Pa',
  warlock: 'Wa',
};

export function ClassEmblem({ classId, size = 56, ring = true, className }: { classId: ClassId; size?: number; ring?: boolean; className?: string }) {
  const { resolver, enhanced } = useAssets();
  const url = resolver.url(`class.${classId}`);
  const frame = enhanced && ring ? resolver.url('ui.tooltip.15') : null;
  return (
    <span className={clsx('gt-class-emblem', ring && 'has-ring', className)} style={{ '--size': `${size}px` } as CSSProperties}>
      {frame ? <img className="gt-class-emblem__frame" src={frame} alt="" draggable={false} /> : null}
      {url ? (
        <img className="gt-class-emblem__img" src={url} alt="" draggable={false} />
      ) : (
        <span className="gt-class-emblem__fallback">{CLASS_GLYPH[classId]}</span>
      )}
    </span>
  );
}

export function GlyphIcon({ id, name, size = 40, className }: { id?: string | null; name: string; size?: number; className?: string }) {
  const { resolver } = useAssets();
  const url = resolver.url(id);
  return (
    <span className={clsx('gt-glyph-icon', !url && 'is-fallback', className)} style={{ '--size': `${size}px` } as CSSProperties} title={name}>
      {url ? <img src={url} alt="" draggable={false} /> : <span>{initials(name).slice(0, 1)}</span>}
    </span>
  );
}
