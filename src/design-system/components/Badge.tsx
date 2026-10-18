import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '../icons';
import './Badge.css';

export type Tone = 'neutral' | 'gold' | 'success' | 'warning' | 'danger' | 'arcane' | 'info';

export function Badge({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: IconName;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={clsx('gt-badge', `gt-badge--${tone}`, className)}>
      {icon ? <Icon name={icon} size={12} strokeWidth={2} /> : null}
      {children}
    </span>
  );
}

export function KeyCap({ keys, size = 'md' }: { keys: string[]; size?: 'sm' | 'md' }) {
  return (
    <span className={clsx('gt-keys', `gt-keys--${size}`)} aria-label={keys.join(' + ')}>
      {keys.map((k, i) => (
        <span key={`${k}-${i}`} className="gt-keys__group">
          {i > 0 ? <span className="gt-keys__plus">+</span> : null}
          <kbd className="gt-key">{k}</kbd>
        </span>
      ))}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('gt-stat', className)}>
      <div className="gt-stat__label">{label}</div>
      <div className="gt-stat__value">{value}</div>
      {hint ? <div className="gt-stat__hint">{hint}</div> : null}
    </div>
  );
}

export function Confidence({ level, score }: { level: 'high' | 'medium' | 'low'; score?: number }) {
  const label =
    level === 'high' ? 'High confidence' : level === 'medium' ? 'Medium confidence' : 'Low confidence';
  return (
    <span
      className={clsx('gt-confidence', `gt-confidence--${level}`)}
      title={score !== undefined ? `${Math.round(score * 100)}%` : undefined}
    >
      <span className="gt-confidence__bars" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      {label}
    </span>
  );
}
