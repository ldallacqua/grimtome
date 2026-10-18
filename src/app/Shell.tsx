import clsx from 'clsx';
import type { ReactNode } from 'react';
import { CLASS_NAMES } from '@/domain/shared/ids';
import {
  BrandMark,
  ClassEmblem,
  Icon,
  KeyCap,
  Toasts,
  Toggle,
  Wordmark,
  type IconName,
} from '@/design-system';
import { isTauri, platform } from '@/services/platform';
import { useT, type MessageKey } from '@/shared/i18n';
import { hotkeyParts } from './settings';
import { selectActiveBuild, useApp, type Route } from './store';
import { useScanController } from './useScan';
import './Shell.css';

const NAV: { route: Route; icon: IconName; key: MessageKey; section: 'play' | 'plan' }[] = [
  { route: 'dashboard', icon: 'dashboard', key: 'nav.dashboard', section: 'play' },
  { route: 'advisor', icon: 'advisor', key: 'nav.advisor', section: 'play' },
  { route: 'skills', icon: 'skills', key: 'nav.skills', section: 'plan' },
  { route: 'paragon', icon: 'paragon', key: 'nav.paragon', section: 'plan' },
  { route: 'builds', icon: 'builds', key: 'nav.builds', section: 'plan' },
];

/** Menu icon: the game's own menu glyph with the native skin, a line icon otherwise. */
function NavGlyph({ route, icon }: { route: Route; icon: IconName }) {
  return (
    <span className="gt-nav__glyph" data-nav={route} aria-hidden>
      <Icon name={icon} size={18} />
    </span>
  );
}

function TitleBar() {
  const route = useApp((s) => s.route);
  const t = useT();
  const current = NAV.find((n) => n.route === route)?.key ?? 'nav.settings';
  return (
    <header className="gt-titlebar" data-tauri-drag-region>
      <div className="gt-titlebar__brand" data-tauri-drag-region>
        <BrandMark size={22} />
        <Wordmark size={12} />
      </div>
      <div className="gt-titlebar__crumb" data-tauri-drag-region>
        <span className="gt-titlebar__sep">◆</span>
        {t(current)}
      </div>
      <div className="gt-titlebar__spacer" data-tauri-drag-region />
      {isTauri ? (
        <div className="gt-titlebar__controls">
          <button
            type="button"
            aria-label="Minimize"
            className="is-min"
            onClick={() => void platform.windows.minimize()}
          >
            <Icon name="minimize" size={14} />
          </button>
          <button
            type="button"
            aria-label="Maximize"
            className="is-max"
            onClick={() => void platform.windows.toggleMaximize()}
          >
            <Icon name="maximize" size={12} />
          </button>
          <button
            type="button"
            aria-label="Close"
            className="is-close"
            onClick={() => void platform.windows.close()}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ) : null}
    </header>
  );
}

function CharacterCard() {
  const build = useApp(selectActiveBuild);
  const phase = useApp((s) => s.transition.phase);
  const progress = useApp((s) => s.progress);
  const navigate = useApp((s) => s.navigate);
  const t = useT();
  return (
    <button
      type="button"
      className="gt-charcard"
      onClick={() => navigate('builds')}
      aria-label="Active build"
    >
      {build ? (
        <ClassEmblem classId={build.classId} size={58} />
      ) : (
        <span className="gt-charcard__empty">
          <Icon name="builds" size={22} />
        </span>
      )}
      <span className="gt-charcard__info">
        <span className="gt-charcard__class">{build ? CLASS_NAMES[build.classId] : t('build.none')}</span>
        <span className="gt-charcard__build">{build?.name ?? 'Load builds to begin'}</span>
        <span className="gt-charcard__meta">
          <span className={clsx('gt-charcard__role', `is-${phase}`)}>{t(`role.${phase}`)}</span>
          <span className="gt-num">
            {t('character.level')} {progress.level}
          </span>
          {progress.paragon > 0 ? <span className="gt-num">P{progress.paragon}</span> : null}
        </span>
      </span>
    </button>
  );
}

function Sidebar() {
  const route = useApp((s) => s.route);
  const navigate = useApp((s) => s.navigate);
  const overlayEnabled = useApp((s) => s.settings.overlay.enabled);
  const updateSettings = useApp((s) => s.updateSettings);
  const hotkey = useApp((s) => s.settings.hotkeys.scan);
  const scanning = useApp((s) => s.scanning);
  const t = useT();
  const { scanNow } = useScanController();

  const item = (n: (typeof NAV)[number]) => (
    <button
      key={n.route}
      type="button"
      className={clsx('gt-nav__item', route === n.route && 'is-active')}
      onClick={() => navigate(n.route)}
      aria-current={route === n.route ? 'page' : undefined}
    >
      <NavGlyph route={n.route} icon={n.icon} />
      <span>{t(n.key)}</span>
    </button>
  );

  return (
    <aside className="gt-sidebar">
      <CharacterCard />
      <nav className="gt-nav" aria-label="Main">
        <div className="gt-nav__section">{t('nav.section.play')}</div>
        {NAV.filter((n) => n.section === 'play').map(item)}
        <div className="gt-nav__section">{t('nav.section.plan')}</div>
        {NAV.filter((n) => n.section === 'plan').map(item)}
      </nav>
      <div className="gt-sidebar__footer">
        <button
          type="button"
          className={clsx('gt-scan-cta', scanning && 'is-busy')}
          onClick={() => void scanNow()}
          disabled={scanning}
        >
          <span className="gt-scan-cta__icon">
            <Icon name="scan" size={20} />
          </span>
          <span className="gt-scan-cta__text">
            <span className="gt-scan-cta__label">{scanning ? t('action.scanning') : t('action.scan')}</span>
            <KeyCap keys={hotkeyParts(hotkey)} size="sm" />
          </span>
        </button>
        <div className="gt-sidebar__row">
          <span className="gt-sidebar__rowlabel">
            <Icon name="overlay" size={15} />
            {t('overlay.label')}
          </span>
          <Toggle
            label={t('overlay.label')}
            checked={overlayEnabled}
            onChange={(v) => {
              updateSettings((s) => ({ ...s, overlay: { ...s.overlay, enabled: v } }));
              void platform.windows.showOverlay(v);
            }}
          />
        </div>
        <button
          type="button"
          className={clsx('gt-nav__item', route === 'settings' && 'is-active')}
          onClick={() => navigate('settings')}
        >
          <NavGlyph route="settings" icon="settings" />
          <span>{t('nav.settings')}</span>
        </button>
      </div>
    </aside>
  );
}

export function Shell({ children, banner }: { children: ReactNode; banner?: ReactNode }) {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  const route = useApp((s) => s.route);
  return (
    <div className="gt-shell">
      <TitleBar />
      <div className="gt-shell__body">
        <Sidebar />
        <main className="gt-main" id="main" key={route}>
          {banner}
          <div className="gt-main__inner">{children}</div>
        </main>
      </div>
      <Toasts items={toasts} onDismiss={dismiss} />
    </div>
  );
}
