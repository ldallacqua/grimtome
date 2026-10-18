import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { Verdict } from '@/domain/recommendations/types';
import { Icon, type IconName } from '../icons';
import './Verdict.css';

export const VERDICT_META: Record<Verdict, { label: string; icon: IconName; short: string }> = {
  upgrade: { label: 'Upgrade candidate', icon: 'upgrade', short: 'Upgrade' },
  keep: { label: 'Keep', icon: 'keep', short: 'Keep' },
  stash: { label: 'Stash for endgame', icon: 'stash', short: 'Stash' },
  salvage: { label: 'Salvage / sell', icon: 'salvage', short: 'Salvage' },
  review: { label: 'Needs review', icon: 'review', short: 'Review' },
};

export function VerdictBadge({ verdict, size = 'md', short }: { verdict: Verdict; size?: 'sm' | 'md'; short?: boolean }) {
  const m = VERDICT_META[verdict];
  return (
    <span className={clsx('gt-verdict-badge', `gt-verdict-badge--${size}`)} data-verdict={verdict}>
      <Icon name={m.icon} size={size === 'sm' ? 12 : 14} strokeWidth={2} />
      {short ? m.short : m.label}
    </span>
  );
}

/** The hero verdict display used by the Item Advisor and the overlay. */
export function VerdictBanner({
  verdict,
  headline,
  summary,
  aside,
  compact,
}: {
  verdict: Verdict;
  headline: string;
  summary: ReactNode;
  aside?: ReactNode;
  compact?: boolean;
}) {
  const m = VERDICT_META[verdict];
  return (
    <div className={clsx('gt-verdict', compact && 'gt-verdict--compact')} data-verdict={verdict} role="status" aria-live="polite">
      <div className="gt-verdict__sigil" aria-hidden>
        <span className="gt-verdict__ring" />
        <Icon name={m.icon} size={compact ? 20 : 26} strokeWidth={1.8} />
      </div>
      <div className="gt-verdict__text">
        <div className="gt-verdict__label">{m.label}</div>
        <div className="gt-verdict__headline">{headline}</div>
        <p className="gt-verdict__summary">{summary}</p>
      </div>
      {aside ? <div className="gt-verdict__aside">{aside}</div> : null}
    </div>
  );
}
