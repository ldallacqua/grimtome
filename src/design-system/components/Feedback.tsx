import clsx from 'clsx';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from '../icons';
import { Button } from './Button';
import './Feedback.css';

export function Meter({
  value,
  max,
  tone = 'gold',
  label,
}: {
  value: number;
  max: number;
  tone?: 'gold' | 'arcane' | 'success';
  label?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div
      className={clsx('gt-meter', `gt-meter--${tone}`)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
    >
      <div className="gt-meter__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({
  value,
  max,
  size = 72,
  children,
  tone = 'gold',
}: {
  value: number;
  max: number;
  size?: number;
  children?: ReactNode;
  tone?: 'gold' | 'arcane' | 'success';
}) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className={clsx('gt-ring', `gt-ring--${tone}`)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} className="gt-ring__track" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="gt-ring__fill"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="gt-ring__content">{children}</div>
    </div>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span className="gt-spinner" style={{ width: size, height: size }} role="status" aria-label="Loading" />
  );
}

export function Skeleton({
  width = '100%',
  height = 14,
  radius = 4,
}: {
  width?: number | string;
  height?: number;
  radius?: number;
}) {
  return <span className="gt-skeleton" style={{ width, height, borderRadius: radius }} aria-hidden />;
}

/** Original sigil illustration for empty states. */
function EmptySigil({ icon }: { icon: IconName }) {
  return (
    <div className="gt-empty__art" aria-hidden>
      <svg viewBox="0 0 160 160" className="gt-empty__svg">
        <defs>
          <radialGradient id="gt-empty-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(214,174,107,0.22)" />
            <stop offset="100%" stopColor="rgba(214,174,107,0)" />
          </radialGradient>
        </defs>
        <circle cx="80" cy="80" r="78" fill="url(#gt-empty-glow)" />
        <circle cx="80" cy="80" r="56" fill="none" stroke="rgba(214,174,107,0.35)" strokeWidth="1" />
        <circle
          cx="80"
          cy="80"
          r="64"
          fill="none"
          stroke="rgba(214,174,107,0.15)"
          strokeWidth="1"
          strokeDasharray="2 6"
        />
        <path
          d="M80 12 L88 72 L148 80 L88 88 L80 148 L72 88 L12 80 L72 72 Z"
          fill="none"
          stroke="rgba(214,174,107,0.28)"
          strokeWidth="1"
        />
        <rect
          x="58"
          y="58"
          width="44"
          height="44"
          transform="rotate(45 80 80)"
          fill="#0d0b0a"
          stroke="rgba(214,174,107,0.6)"
          strokeWidth="1.2"
        />
      </svg>
      <span className="gt-empty__icon">
        <Icon name={icon} size={30} strokeWidth={1.4} />
      </span>
    </div>
  );
}

export function EmptyState({
  icon = 'sigil',
  title,
  body,
  actions,
  compact,
}: {
  icon?: IconName;
  title: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={clsx('gt-empty', compact && 'gt-empty--compact')}>
      <EmptySigil icon={icon} />
      <h3 className="gt-empty__title">{title}</h3>
      {body ? <p className="gt-empty__body">{body}</p> : null}
      {actions ? <div className="gt-empty__actions">{actions}</div> : null}
    </div>
  );
}

export function Callout({
  tone = 'info',
  icon,
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success' | 'arcane';
  icon?: IconName;
  title?: ReactNode;
  children?: ReactNode;
}) {
  const fallback: Record<string, IconName> = {
    info: 'info',
    warning: 'warning',
    danger: 'warning',
    success: 'check',
    arcane: 'sparkle',
  };
  return (
    <div className={clsx('gt-callout', `gt-callout--${tone}`)}>
      <Icon name={icon ?? fallback[tone] ?? 'info'} size={18} />
      <div>
        {title ? <div className="gt-callout__title">{title}</div> : null}
        {children ? <div className="gt-callout__body">{children}</div> : null}
      </div>
    </div>
  );
}

export interface ToastItem {
  id: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  body?: string;
}

export function Toasts({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div className="gt-toasts" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={clsx('gt-toast', `gt-toast--${t.tone}`)}
          role={t.tone === 'danger' ? 'alert' : 'status'}
        >
          <Icon name={t.tone === 'success' ? 'check' : t.tone === 'info' ? 'info' : 'warning'} size={18} />
          <div className="gt-toast__text">
            <div className="gt-toast__title">{t.title}</div>
            {t.body ? <div className="gt-toast__body">{t.body}</div> : null}
          </div>
          <button
            type="button"
            className="gt-toast__close"
            aria-label="Dismiss"
            onClick={() => onDismiss(t.id)}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Dialog({
  open,
  title,
  children,
  onClose,
  actions,
  tone = 'default',
}: {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
  tone?: 'default' | 'danger';
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('button, [href], input, select, textarea')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="gt-dialog__backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={clsx('gt-dialog', `gt-dialog--${tone}`)}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        <div className="gt-dialog__head">
          <h2 className="gt-dialog__title">{title}</h2>
          <button type="button" className="gt-toast__close" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="gt-dialog__body">{children}</div>
        <div className="gt-dialog__actions">{actions ?? <Button onClick={onClose}>Close</Button>}</div>
      </div>
    </div>
  );
}
