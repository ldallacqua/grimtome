import { useEffect, useMemo } from 'react';
import { AssetsContext, BrandMark, Spinner } from '@/design-system';
import { BuildsScreen } from '@/features/builds/BuildsScreen';
import { DashboardScreen } from '@/features/dashboard/DashboardScreen';
import { ItemAdvisorScreen } from '@/features/item-advisor/ItemAdvisorScreen';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { ParagonScreen } from '@/features/paragon/ParagonScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { SkillsScreen } from '@/features/skills/SkillsScreen';
import { TransitionBanner } from '@/features/transitions/TransitionBanner';
import { isTauri, platform } from '@/services/platform';
import { refreshAssets } from './assets';
import { Shell } from './Shell';
import { startPersistence, useApp } from './store';
import { ingestScan } from './useScan';

function useBootstrap() {
  useEffect(() => {
    const stop = startPersistence();
    void useApp
      .getState()
      .hydrate()
      .then(() => refreshAssets());
    const unsubscribe = platform.subscribe((e) => {
      const s = useApp.getState();
      if (e.type === 'scan') ingestScan(e.payload, 'capture');
      else if (e.type === 'scan-error') s.toast({ tone: 'danger', title: 'Scan failed', body: e.message });
      else if (e.type === 'overlay-click-through') s.updateSettings((st) => ({ ...st, overlay: { ...st.overlay, clickThrough: e.enabled } }));
    });
    return () => {
      stop();
      unsubscribe();
    };
  }, []);

  const hotkeys = useApp((s) => s.settings.hotkeys);
  const ready = useApp((s) => s.ready);
  const toast = useApp((s) => s.toast);
  useEffect(() => {
    if (!ready || !platform.hotkeys.supported) return;
    void platform.hotkeys.apply(hotkeys).then(({ failed }) => {
      if (failed.length) toast({ tone: 'warning', title: 'Some hotkeys could not be registered', body: `${failed.join(', ')} may be used by another app.` });
    });
  }, [ready, hotkeys, toast]);

  const overlay = useApp((s) => s.settings.overlay);
  useEffect(() => {
    if (!ready || !isTauri) return;
    void platform.windows.setOverlayClickThrough(overlay.clickThrough);
  }, [ready, overlay.clickThrough]);

  const reduceMotion = useApp((s) => s.settings.appearance.reduceMotion);
  const lang = useApp((s) => s.settings.language);
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
    document.documentElement.lang = lang;
  }, [reduceMotion, lang]);
}

function Screen() {
  const route = useApp((s) => s.route);
  switch (route) {
    case 'dashboard':
      return <DashboardScreen />;
    case 'advisor':
      return <ItemAdvisorScreen />;
    case 'skills':
      return <SkillsScreen />;
    case 'paragon':
      return <ParagonScreen />;
    case 'builds':
      return <BuildsScreen />;
    case 'settings':
      return <SettingsScreen />;
  }
}

export function App() {
  useBootstrap();
  const ready = useApp((s) => s.ready);
  const onboarded = useApp((s) => s.onboardingComplete);
  const resolver = useApp((s) => s.resolver);
  const useGame = useApp((s) => s.settings.assets.useGameAssets);
  const showArt = useApp((s) => s.settings.appearance.showGameArt);
  const assets = useMemo(
    () => ({ resolver, enhanced: useGame && resolver.hasGameAssets, showArt: showArt && useGame && resolver.hasGameAssets }),
    [resolver, useGame, showArt],
  );

  if (!ready) {
    return (
      <div className="gt-splash">
        <BrandMark size={64} />
        <Spinner size={22} />
      </div>
    );
  }
  return (
    <AssetsContext.Provider value={assets}>
      {onboarded ? (
        <Shell banner={<TransitionBanner />}>
          <Screen />
        </Shell>
      ) : (
        <Onboarding />
      )}
    </AssetsContext.Provider>
  );
}
