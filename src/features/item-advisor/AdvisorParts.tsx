import clsx from 'clsx';
import type { StructuredReason } from '@/domain/recommendations/engine';
import { renderReason } from '@/domain/recommendations/explain';
import type { BuildFit, FitTier } from '@/domain/recommendations/types';
import { Badge, Icon, Meter, type IconName } from '@/design-system';
import { useApp } from '@/app/store';

const TIER_LABEL: Record<FitTier, string> = {
  strong: 'Strong fit',
  partial: 'Partial fit',
  weak: 'Weak fit',
  none: 'No match',
  unknown: 'No guidance',
};

const TONE_ICON: Record<StructuredReason['tone'], IconName> = {
  positive: 'check',
  negative: 'minus',
  neutral: 'info',
  warning: 'warning',
};

export function ReasonList({ reasons }: { reasons: StructuredReason[] }) {
  const lang = useApp((s) => s.settings.language);
  if (!reasons.length) return null;
  return (
    <ul className="gt-reasons">
      {reasons.map((r, i) => (
        <li key={`${r.code}-${i}`} className={clsx('gt-reason', `is-${r.tone}`)}>
          <span className="gt-reason__icon">
            <Icon name={TONE_ICON[r.tone]} size={13} strokeWidth={2.2} />
          </span>
          <span className="gt-reason__text">{lang === 'en' ? r.text : renderReason(r.code, r.params, lang)}</span>
          {r.role ? <span className={clsx('gt-reason__role', `is-${r.role}`)}>{r.role === 'leveling' ? 'Leveling' : 'Endgame'}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function FitCard({ fit, active }: { fit: BuildFit; active: boolean }) {
  return (
    <div className={clsx('gt-fit gt-card', `is-${fit.role}`, active && 'is-active')}>
      <div className="gt-fit__head">
        <div>
          <div className="gt-fit__role">
            {fit.role === 'leveling' ? 'Leveling build' : 'Endgame build'}
            {active ? <span className="gt-fit__now">active</span> : <span className="gt-fit__now is-future">future</span>}
          </div>
          <div className="gt-fit__name">{fit.buildName}</div>
        </div>
        <Badge tone={fit.tier === 'strong' ? 'success' : fit.tier === 'partial' ? 'gold' : fit.tier === 'unknown' ? 'warning' : 'neutral'}>
          {TIER_LABEL[fit.tier]}
        </Badge>
      </div>
      <Meter value={fit.ratio * 100} max={100} tone={fit.role === 'endgame' ? 'arcane' : 'success'} label={`${fit.buildName} fit`} />
      {fit.unique ? (
        <div className="gt-fit__line">
          <Icon name="crown" size={15} />
          <span>
            Uses <strong>{fit.unique.name}</strong>
            {fit.unique.required ? ' (core)' : ''}
          </span>
        </div>
      ) : null}
      {fit.aspect ? (
        <div className="gt-fit__line">
          <Icon name="gem" size={15} />
          <span>
            Carries <strong>{fit.aspect.name}</strong>
          </span>
        </div>
      ) : null}
      {fit.matched.length ? (
        <div className="gt-fit__chips">
          {fit.matched.map((m) => (
            <span key={m.key} className="gt-chip is-match" title={`Priority ${m.weight}/3${m.greater ? ' · Greater Affix' : ''}`}>
              <span className="gt-chip__dots">{'●'.repeat(m.weight)}</span>
              {m.label}
              {m.greater ? <span className="gt-chip__ga">GA</span> : null}
            </span>
          ))}
        </div>
      ) : null}
      {fit.missingEssentials.length ? (
        <div className="gt-fit__chips">
          {fit.missingEssentials.map((m) => (
            <span key={m} className="gt-chip is-missing" title="Essential stat this item lacks">
              {m}
            </span>
          ))}
        </div>
      ) : null}
      {!fit.hasGuidance ? <p className="gt-muted gt-small">This build lists no affix priorities for this slot.</p> : null}
    </div>
  );
}
