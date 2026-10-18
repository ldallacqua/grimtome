import { useEffect, useState, type KeyboardEvent } from 'react';
import { flushPersistence, useApp } from '@/app/store';
import { hotkeyParts, type Settings } from '@/app/settings';
import { Button, Dialog, Field, KeyCap, PageHeader, Panel, Segmented, Select, Slider, TextField, Toggle } from '@/design-system';
import { isTauri, platform } from '@/services/platform';
import { GameAssetsSection } from './GameAssetsSection';
import './settings.css';

function HotkeyInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [recording, setRecording] = useState(false);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!recording) return;
    e.preventDefault();
    if (e.key === 'Escape') return setRecording(false);
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
    const mods = [e.ctrlKey && 'CommandOrControl', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean) as string[];
    if (!mods.length) return; // require a modifier so the game keeps its single keys
    const key = e.code.startsWith('Key') ? e.code.slice(3) : e.code.startsWith('Digit') ? e.code.slice(5) : e.key.length === 1 ? e.key.toUpperCase() : e.key;
    onChange([...mods, key].join('+'));
    setRecording(false);
  };
  return (
    <button type="button" className={`gt-hotkey ${recording ? 'is-recording' : ''}`} onClick={() => setRecording(true)} onBlur={() => setRecording(false)} onKeyDown={onKey} aria-label={`${label}: ${value}`}>
      {recording ? <span className="gt-hotkey__hint">Press a combination…</span> : <KeyCap keys={hotkeyParts(value)} />}
    </button>
  );
}

function useSettingsPatch() {
  const update = useApp((s) => s.updateSettings);
  return <K extends keyof Settings>(key: K, patch: Partial<Settings[K]>) => update((s) => ({ ...s, [key]: { ...(s[key] as object), ...patch } }) as Settings);
}

export function SettingsScreen() {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const patch = useSettingsPatch();
  const clearScans = useApp((s) => s.clearScans);
  const resetAll = useApp((s) => s.resetAll);
  const toast = useApp((s) => s.toast);
  const [languages, setLanguages] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    void platform.ocr.languages().then(setLanguages).catch(() => setLanguages([]));
    void platform.storage.location().then(setLocation);
  }, []);
  const region = settings.capture.region ?? { x: 0, y: 0, width: 900, height: 1100 };

  return (
    <div>
      <PageHeader eyebrow="Settings" title="Settings" subtitle="Everything stays on this computer. Grimtome has no account, no cloud and no telemetry." />
      <div className="gt-settings">
        <Panel title="General" variant="raised">
          <Field label="Language" hint="Interface language. Explanations are fully translated where available.">
            <Segmented
              label="Language"
              value={settings.language}
              onChange={(v) => update((s) => ({ ...s, language: v }))}
              options={[
                { value: 'en', label: 'English' },
                { value: 'pt-BR', label: 'Português (BR)' },
              ]}
            />
          </Field>
          <Field label="Reduce motion" hint="Turns off animations and transitions." inline>
            <Toggle label="Reduce motion" checked={settings.appearance.reduceMotion} onChange={(v) => patch('appearance', { reduceMotion: v })} />
          </Field>
        </Panel>

        <Panel title="Capture & recognition" variant="raised">
          <Field label="Capture mode" hint="Smart finds the tooltip near your cursor on the whole screen. Cursor area and fixed region capture a smaller box.">
            <Segmented
              label="Capture mode"
              value={settings.capture.mode}
              onChange={(mode) => patch('capture', { mode })}
              options={[
                { value: 'smart', label: 'Smart' },
                { value: 'cursor', label: 'Cursor area' },
                { value: 'region', label: 'Fixed region' },
              ]}
            />
          </Field>
          {settings.capture.mode === 'cursor' ? (
            <Field label="Cursor area size" hint="Width and height (physical pixels) captured around the cursor.">
              <div className="gt-row">
                <TextField className="gt-num-input" value={settings.capture.cursorBox.width} onChange={(e) => patch('capture', { cursorBox: { ...settings.capture.cursorBox, width: Number(e.target.value) || 1000 } })} aria-label="Width" />
                <span className="gt-muted">×</span>
                <TextField className="gt-num-input" value={settings.capture.cursorBox.height} onChange={(e) => patch('capture', { cursorBox: { ...settings.capture.cursorBox, height: Number(e.target.value) || 1200 } })} aria-label="Height" />
              </div>
            </Field>
          ) : null}
          {settings.capture.mode === 'region' ? (
            <Field label="Fixed region" hint="Screen rectangle in physical pixels (x, y, width, height).">
              <div className="gt-row">
                {(['x', 'y', 'width', 'height'] as const).map((k) => (
                  <TextField
                    key={k}
                    className="gt-num-input"
                    aria-label={k}
                    value={region[k]}
                    onChange={(e) => patch('capture', { region: { ...region, [k]: Number(e.target.value) || 0 } })}
                  />
                ))}
              </div>
            </Field>
          ) : null}
          <Field label="OCR language" hint={isTauri ? 'Windows OCR languages installed on this PC.' : 'Real OCR runs in the desktop app.'}>
            <Select value={settings.capture.language} onChange={(e) => patch('capture', { language: e.target.value })}>
              {(languages.length ? languages : [settings.capture.language]).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
        </Panel>

        <Panel title="Hotkeys" variant="raised">
          <Field label="Scan item" hint="Hover an item in game and press this. Works while Diablo IV has focus.">
            <HotkeyInput label="Scan item" value={settings.hotkeys.scan} onChange={(v) => patch('hotkeys', { scan: v })} />
          </Field>
          <Field label="Show / hide overlay">
            <HotkeyInput label="Toggle overlay" value={settings.hotkeys.toggleOverlay} onChange={(v) => patch('hotkeys', { toggleOverlay: v })} />
          </Field>
          <Field label="Toggle click-through" hint="Lets mouse clicks pass through the overlay to the game.">
            <HotkeyInput label="Click-through" value={settings.hotkeys.clickThrough} onChange={(v) => patch('hotkeys', { clickThrough: v })} />
          </Field>
        </Panel>

        <Panel title="Overlay" variant="raised">
          <Field label="Enable overlay" hint="A small always-on-top card that shows verdicts over the game (borderless window mode)." inline>
            <Toggle
              label="Enable overlay"
              checked={settings.overlay.enabled}
              onChange={(v) => {
                patch('overlay', { enabled: v });
                void platform.windows.showOverlay(v);
              }}
            />
          </Field>
          <Field label="Opacity">
            <Slider value={Math.round(settings.overlay.opacity * 100)} min={40} max={100} label="Overlay opacity" format={(v) => `${v}%`} onChange={(v) => patch('overlay', { opacity: v / 100 })} />
          </Field>
          <Field label="Layout">
            <Segmented label="Overlay layout" value={settings.overlay.mode} onChange={(mode) => patch('overlay', { mode })} options={[{ value: 'compact', label: 'Compact' }, { value: 'expanded', label: 'Expanded' }]} />
          </Field>
          <Field label="Click-through" hint="When on, the overlay ignores the mouse." inline>
            <Toggle label="Click-through" checked={settings.overlay.clickThrough} onChange={(v) => patch('overlay', { clickThrough: v })} />
          </Field>
          <Field label="Show on every scan" inline>
            <Toggle label="Show on scan" checked={settings.overlay.showOnScan} onChange={(v) => patch('overlay', { showOnScan: v })} />
          </Field>
          <Field label="Auto-hide" hint="Hide the verdict after a few seconds (0 keeps it visible).">
            <Slider value={settings.overlay.autoHideSeconds} min={0} max={60} step={5} label="Auto-hide seconds" format={(v) => (v ? `${v}s` : 'Off')} onChange={(v) => patch('overlay', { autoHideSeconds: v })} />
          </Field>
        </Panel>

        <GameAssetsSection />

        <Panel title="Data & privacy" variant="raised">
          <Field label="Stored at" hint="Builds, progress, settings and scan history.">
            <code className="gt-path gt-well">{location}</code>
          </Field>
          <Field label="Keep tooltip images" hint="Off by default: screenshots are discarded after recognition." inline>
            <Toggle label="Keep tooltip images" checked={settings.privacy.keepScanImages} onChange={(v) => patch('privacy', { keepScanImages: v })} />
          </Field>
          <Field label="Scan history" hint="How many recent scans to keep.">
            <Slider value={settings.privacy.scanHistoryLimit} min={0} max={200} step={10} label="Scan history limit" onChange={(v) => patch('privacy', { scanHistoryLimit: v })} />
          </Field>
          <Field label="Clear data">
            <div className="gt-row">
              <Button
                size="sm"
                variant="secondary"
                icon="trash"
                onClick={() => {
                  clearScans();
                  toast({ tone: 'success', title: 'Scan history cleared' });
                }}
              >
                Clear scans
              </Button>
              <Button size="sm" variant="danger" icon="warning" onClick={() => setConfirmReset(true)}>
                Reset everything
              </Button>
            </div>
          </Field>
        </Panel>

        <Panel title="About" variant="raised">
          <p className="gt-muted">
            Grimtome 0.1.0 — an unofficial companion. Not affiliated with, endorsed or sponsored by Blizzard Entertainment. Diablo is a trademark of Blizzard
            Entertainment, Inc. Grimtome reads only what you show it: screenshots you capture and, optionally, files from your own installation. It never reads
            game memory, injects code, automates input or touches network traffic.
          </p>
        </Panel>
      </div>
      <Dialog
        open={confirmReset}
        tone="danger"
        title="Reset Grimtome?"
        onClose={() => setConfirmReset(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                setConfirmReset(false);
                await flushPersistence();
                await resetAll();
              }}
            >
              Reset everything
            </Button>
          </>
        }
      >
        Builds, progress, scans and settings are deleted from this PC. Imported game assets stay until you delete them separately.
      </Dialog>
    </div>
  );
}
