import clsx from 'clsx';
import { useState, type CSSProperties } from 'react';
import { hotkeyParts } from '@/app/settings';
import { useApp } from '@/app/store';
import {
  BrandMark,
  Button,
  Icon,
  KeyCap,
  Segmented,
  Toggle,
  Wordmark,
  useAssets,
  type IconName,
} from '@/design-system';
import { isTauri, platform } from '@/services/platform';
import { ImportDialog } from '../builds/ImportDialog';
import { GameAssetsSection } from '../settings/GameAssetsSection';
import './onboarding.css';

const STEPS = ['Welcome', 'Builds', 'Game assets', 'Ready'] as const;

function Feature({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <div className="gt-ob-feature gt-card">
      <span className="gt-ob-feature__icon">
        <Icon name={icon} size={20} />
      </span>
      <div>
        <div className="gt-ob-feature__title">{title}</div>
        <p>{body}</p>
      </div>
    </div>
  );
}

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const builds = useApp((s) => s.builds);
  const loadSamples = useApp((s) => s.loadSampleBuilds);
  const complete = useApp((s) => s.completeOnboarding);
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const { resolver, showArt } = useAssets();
  const art = showArt ? resolver.url('art.loadingscreen-season15-08') : null;
  const hasBuilds = !!(builds.leveling || builds.endgame);
  const steps = isTauri ? STEPS : STEPS.filter((s) => s !== 'Game assets');
  const current = steps[step]!;
  const next = () => setStep((s) => Math.min(steps.length - 1, s + 1));

  return (
    <div
      className={clsx('gt-ob', art && 'has-art')}
      style={art ? ({ '--ob-art': `url("${art}")` } as CSSProperties) : undefined}
      data-tauri-drag-region
    >
      <div className="gt-ob__veil" aria-hidden />
      <div className="gt-ob__card">
        <ol className="gt-ob__steps" aria-label="Setup progress">
          {steps.map((s, i) => (
            <li key={s} className={clsx(i === step && 'is-current', i < step && 'is-done')}>
              <span className="gt-ob__stepdot">
                {i < step ? <Icon name="check" size={11} strokeWidth={2.4} /> : i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>

        {current === 'Welcome' ? (
          <div className="gt-ob__body gt-ob__welcome">
            <BrandMark size={96} />
            <Wordmark size={30} />
            <p className="gt-ob__tagline">Know what to keep.</p>
            <p className="gt-ob__lede">
              A Diablo IV companion that reads item tooltips and judges them against the build you play now
              and the build you are working toward.
            </p>
            <div className="gt-ob__features">
              <Feature
                icon="advisor"
                title="Explainable item verdicts"
                body="Upgrade, keep, stash for endgame or salvage — always with the reasons."
              />
              <Feature
                icon="skills"
                title="Skill & Paragon guidance"
                body="Your next skill point and Paragon milestone, and when to switch builds."
              />
              <Feature
                icon="lock"
                title="Private by design"
                body="Runs on your PC. No account, no cloud, no telemetry, no game memory access."
              />
            </div>
            <Button variant="primary" size="lg" iconRight="chevronRight" onClick={next}>
              Begin
            </Button>
          </div>
        ) : null}

        {current === 'Builds' ? (
          <div className="gt-ob__body">
            <h2 className="gt-ob__title">Bring your builds</h2>
            <p className="gt-ob__lede">
              Grimtome follows two builds: one for leveling and the endgame build you are aiming for.
            </p>
            <div className="gt-ob__choices">
              <button
                type="button"
                className={clsx(
                  'gt-ob__choice gt-card',
                  hasBuilds && builds.leveling?.source.kind === 'sample' && 'is-selected',
                )}
                onClick={loadSamples}
              >
                <Icon name="sparkle" size={22} />
                <strong>Try the sample builds</strong>
                <span>Barbarian · Whirlwind leveling → Earthquake Hammer endgame</span>
              </button>
              <button type="button" className="gt-ob__choice gt-card" onClick={() => setImportOpen(true)}>
                <Icon name="paste" size={22} />
                <strong>Paste from a guide</strong>
                <span>Copy sections from the guide you follow (Maxroll or any site) and paste them</span>
              </button>
            </div>
            {hasBuilds ? (
              <div className="gt-ob__loaded">
                <Icon name="check" size={16} />
                {[builds.leveling?.name, builds.endgame?.name].filter(Boolean).join(' → ')}
              </div>
            ) : null}
            <div className="gt-ob__nav">
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                Back
              </Button>
              <Button variant="primary" iconRight="chevronRight" onClick={next}>
                {hasBuilds ? 'Continue' : 'Skip for now'}
              </Button>
            </div>
            <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
          </div>
        ) : null}

        {current === 'Game assets' ? (
          <div className="gt-ob__body gt-ob__body--wide">
            <h2 className="gt-ob__title">Optional: your game&apos;s artwork</h2>
            <p className="gt-ob__lede">
              Use icons and textures from your own installation for a richer interface. Entirely optional —
              Grimtome looks complete without it.
            </p>
            <GameAssetsSection />
            <div className="gt-ob__nav">
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                Back
              </Button>
              <Button variant="primary" iconRight="chevronRight" onClick={next}>
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {current === 'Ready' ? (
          <div className="gt-ob__body">
            <h2 className="gt-ob__title">Ready to play</h2>
            <p className="gt-ob__lede">Run Diablo IV in borderless windowed mode, hover an item and press</p>
            <div className="gt-ob__hotkey">
              <KeyCap keys={hotkeyParts(settings.hotkeys.scan)} />
            </div>
            <div className="gt-ob__options">
              <div className="gt-ob__option gt-card">
                <span>
                  <strong>In-game overlay</strong>
                  <small>Show verdicts on top of the game</small>
                </span>
                <Toggle
                  label="In-game overlay"
                  checked={settings.overlay.enabled}
                  onChange={(v) => update((s) => ({ ...s, overlay: { ...s.overlay, enabled: v } }))}
                />
              </div>
              <div className="gt-ob__option gt-card">
                <span>
                  <strong>Capture</strong>
                  <small>Smart mode finds the tooltip for you</small>
                </span>
                <Segmented
                  size="sm"
                  label="Capture mode"
                  value={settings.capture.mode}
                  onChange={(mode) => update((s) => ({ ...s, capture: { ...s.capture, mode } }))}
                  options={[
                    { value: 'smart', label: 'Smart' },
                    { value: 'cursor', label: 'Cursor' },
                    { value: 'region', label: 'Region' },
                  ]}
                />
              </div>
            </div>
            <div className="gt-ob__nav">
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                Back
              </Button>
              <Button
                variant="primary"
                size="lg"
                icon="sigil"
                onClick={() => {
                  complete();
                  if (settings.overlay.enabled) void platform.windows.showOverlay(true);
                }}
              >
                Enter Grimtome
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <p className="gt-ob__legal">Unofficial companion · not affiliated with Blizzard Entertainment</p>
    </div>
  );
}
