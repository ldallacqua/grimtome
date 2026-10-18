import clsx from 'clsx';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import './Panel.css';

/** Original gold filigree corner (drawn for Grimtome). */
export function Corner({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={clsx('gt-corner', className)} style={style} viewBox="0 0 40 40" aria-hidden>
      <path d="M1 26V7a6 6 0 0 1 6-6h19" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 20V10a5 5 0 0 1 5-5h10" fill="none" stroke="currentColor" strokeWidth=".8" opacity=".55" />
      <path
        d="M1 7c4 0 6 2 6 6M7 1c0 4 2 6 6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth=".8"
        opacity=".7"
      />
      <path d="M26 1l3 0 1.6-1.6L32.2 1 30.6 2.6Z M1 26v3l-1.6 1.6L1 32.2l1.6-1.6Z" fill="currentColor" />
    </svg>
  );
}

/** Section rule. With the native skin it is drawn with the game's divider textures. */
export function Divider({
  variant = 'line',
  className,
}: {
  variant?: 'line' | 'ornate';
  className?: string;
}) {
  return (
    <div className={clsx('gt-divider', `gt-divider--${variant}`, className)} role="separator">
      <span className="gt-divider__line" />
      <span className="gt-divider__gem" />
      <span className="gt-divider__line" />
    </div>
  );
}

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  variant?: 'plain' | 'raised' | 'ornate' | 'inset';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  as?: 'section' | 'article' | 'div' | 'aside';
}

export function Panel({
  title,
  eyebrow,
  subtitle,
  actions,
  variant = 'plain',
  padding = 'md',
  as: Tag = 'section',
  className,
  children,
  ...rest
}: PanelProps) {
  const hasHeader = title || eyebrow || actions || subtitle;
  return (
    <Tag
      className={clsx('gt-panel', `gt-panel--${variant}`, `gt-panel--pad-${padding}`, className)}
      {...rest}
    >
      {variant === 'ornate' ? (
        <>
          <Corner className="gt-panel__corner gt-panel__corner--tl" />
          <Corner className="gt-panel__corner gt-panel__corner--tr" />
          <Corner className="gt-panel__corner gt-panel__corner--bl" />
          <Corner className="gt-panel__corner gt-panel__corner--br" />
        </>
      ) : null}
      {hasHeader ? (
        <header className="gt-panel__header">
          <div className="gt-panel__titles">
            {eyebrow ? <div className="gt-panel__eyebrow">{eyebrow}</div> : null}
            {title ? <h2 className="gt-panel__title">{title}</h2> : null}
            {subtitle ? <p className="gt-panel__subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="gt-panel__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="gt-panel__body">{children}</div>
    </Tag>
  );
}

/** Page-level heading with eyebrow, title and ornate rule. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="gt-page-header">
      <div className="gt-page-header__row">
        <div>
          {eyebrow ? <div className="gt-page-header__eyebrow">{eyebrow}</div> : null}
          <h1 className="gt-page-header__title">{title}</h1>
          {subtitle ? <p className="gt-page-header__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="gt-page-header__actions">{actions}</div> : null}
      </div>
      <Divider variant="ornate" className="gt-page-header__rule" />
    </header>
  );
}
