import { useEffect, useState } from 'react';
import { refreshAssets } from '@/app/assets';
import { useApp } from '@/app/store';
import { Badge, Button, Callout, Dialog, Field, Meter, Panel, Toggle } from '@/design-system';
import { isTauri, platform, type ImportProgress, type Installation } from '@/services/platform';

const LAYOUT_LABEL: Record<Installation['layout'], string> = {
  steamStatic: 'Steam install — supported',
  casc: 'Battle.net install — not supported yet',
  unknown: 'Unrecognized layout',
};

export function GameAssetsSection() {
  const settings = useApp((s) => s.settings.assets);
  const showArt = useApp((s) => s.settings.appearance.showGameArt);
  const updateSettings = useApp((s) => s.updateSettings);
  const status = useApp((s) => s.assetStatus);
  const resolver = useApp((s) => s.resolver);
  const toast = useApp((s) => s.toast);
  const [installs, setInstalls] = useState<Installation[] | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState<Installation | 'manual' | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    void platform.assets.detectInstallations().then(setInstalls);
    return platform.subscribe((e) => e.type === 'import-progress' && setProgress(e.payload));
  }, []);

  const manifest = status?.manifest ?? null;
  const counts = manifest ? resolver.counts() : {};
  const supported = installs?.find((i) => i.layout === 'steamStatic') ?? null;

  const runImport = async (target: Installation | 'manual') => {
    let path: string | null = null;
    if (target === 'manual') {
      path = await platform.dialogs.pickFolder('Select your Diablo IV folder');
      if (!path) return;
      const inst = await platform.assets.inspect(path);
      if (!inst || inst.layout !== 'steamStatic') {
        toast({ tone: 'warning', title: 'Unsupported folder', body: 'Select the Diablo IV folder of a Steam installation (it contains Data\\.build.config).' });
        return;
      }
    } else {
      path = target.root;
    }
    setBusy(true);
    setProgress({ stage: 'reading', done: 0, total: 1 });
    updateSettings((s) => ({ ...s, assets: { ...s.assets, consentAcceptedAt: s.assets.consentAcceptedAt ?? new Date().toISOString(), gamePath: path } }));
    try {
      const summary = await platform.assets.import(path, 'enUS');
      await refreshAssets();
      toast({ tone: 'success', title: 'Game assets imported', body: `${summary.assets} icons and textures from build ${summary.gameBuild ?? 'unknown'} in ${(summary.elapsedMs / 1000).toFixed(1)}s.` });
    } catch (e) {
      toast({ tone: 'danger', title: 'Import failed', body: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Panel id="game-assets" title="Game assets" eyebrow="Optional · local only" variant="raised">
      <p className="gt-muted" style={{ marginBottom: 12 }}>
        Grimtome can read icons, class emblems and interface textures from your own Diablo IV installation and keep them in a private cache on this PC. The
        app looks complete without them; nothing is ever uploaded or shared.
      </p>
      {manifest ? (
        <Callout tone="success" title={`Imported from game build ${manifest.gameBuild ?? 'unknown'}`}>
          {Object.entries(counts)
            .map(([k, v]) => `${v} ${k}`)
            .join(' · ')}{' '}
          · stored in {status?.root}
        </Callout>
      ) : (
        <Callout tone="info" title="No game assets imported">
          Using Grimtome&apos;s original artwork.
        </Callout>
      )}
      <div style={{ marginTop: 8 }}>
        {isTauri ? (
          <Field label="Detected installations" hint={installs === null ? 'Searching…' : installs.length ? undefined : 'None found automatically. You can choose the folder yourself.'}>
            <div className="gt-installs">
              {(installs ?? []).map((i) => (
                <div key={i.root} className="gt-install">
                  <div>
                    <div className="gt-install__path">{i.root}</div>
                    <div className="gt-row" style={{ marginTop: 4 }}>
                      <Badge tone={i.layout === 'steamStatic' ? 'success' : 'warning'}>{LAYOUT_LABEL[i.layout]}</Badge>
                      {i.build ? <span className="gt-muted gt-small">Build {i.build}</span> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Field>
        ) : null}
        {busy && progress ? (
          <div style={{ margin: '12px 0' }}>
            <div className="gt-row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="gt-small">{progress.stage === 'icons' ? 'Decoding icons and textures' : progress.stage === 'writing' ? 'Writing cache' : 'Reading game data'}</span>
              <span className="gt-num gt-small gt-muted">
                {progress.done}/{progress.total}
              </span>
            </div>
            <Meter value={progress.done} max={Math.max(1, progress.total)} label="Import progress" />
          </div>
        ) : null}
        <div className="gt-row gt-row--wrap" style={{ margin: '12px 0 4px' }}>
          {isTauri ? (
            <>
              <Button variant="primary" icon="download" loading={busy} disabled={!supported} onClick={() => supported && setConsent(supported)}>
                {manifest ? 'Re-import from game' : 'Import from my game'}
              </Button>
              <Button variant="secondary" icon="folder" disabled={busy} onClick={() => setConsent('manual')}>
                Choose folder…
              </Button>
              {manifest ? (
                <>
                  <Button variant="ghost" icon="external" onClick={() => void platform.assets.reveal()}>
                    Open cache folder
                  </Button>
                  <Button variant="ghost" icon="trash" onClick={() => setConfirmClear(true)}>
                    Delete imported assets
                  </Button>
                </>
              ) : null}
            </>
          ) : (
            <span className="gt-muted gt-small">Importing is available in the Windows desktop app.</span>
          )}
        </div>
        <Field label="Use imported game assets" hint="Turn off to see Grimtome's original artwork everywhere." inline>
          <Toggle label="Use imported game assets" checked={settings.useGameAssets} onChange={(v) => updateSettings((s) => ({ ...s, assets: { ...s.assets, useGameAssets: v } }))} />
        </Field>
        <Field label="Show game artwork in banners" hint="Large illustrations behind the dashboard hero." inline>
          <Toggle label="Show game artwork" checked={showArt} onChange={(v) => updateSettings((s) => ({ ...s, appearance: { ...s.appearance, showGameArt: v } }))} />
        </Field>
      </div>

      <Dialog
        open={consent !== null}
        title="Import assets from your game?"
        onClose={() => setConsent(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConsent(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon="check"
              onClick={() => {
                const target = consent!;
                setConsent(null);
                void runImport(target);
              }}
            >
              I understand, import
            </Button>
          </>
        }
      >
        <ul className="gt-consent">
          <li>Grimtome reads files from your installed copy of Diablo IV, read-only. It never touches the running game, its memory or its network traffic.</li>
          <li>Encrypted game content is skipped; nothing is decrypted.</li>
          <li>Copies are stored only on this PC, in your user profile, and are never uploaded or redistributed. You can delete them at any time.</li>
          <li>
            Blizzard&apos;s End User License Agreement restricts unauthorized software that reads or collects information from its games. Reading your own
            installation for personal display is a gray area that you accept by continuing. Grimtome is not affiliated with or endorsed by Blizzard
            Entertainment.
          </li>
        </ul>
      </Dialog>
      <Dialog
        open={confirmClear}
        tone="danger"
        title="Delete imported game assets?"
        onClose={() => setConfirmClear(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={async () => {
                setConfirmClear(false);
                await platform.assets.clear();
                await refreshAssets();
                toast({ tone: 'success', title: 'Imported assets deleted' });
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        The private cache is removed from this PC. Grimtome switches back to its original artwork; you can import again later.
      </Dialog>
    </Panel>
  );
}
