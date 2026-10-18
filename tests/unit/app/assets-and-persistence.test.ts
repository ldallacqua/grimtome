import { describe, expect, it } from 'vitest';
import { defaultPersisted, deserialize, serialize } from '@/app/persistence';
import { defaultSettings, hotkeyParts, parseSettings } from '@/app/settings';
import { SAMPLE_ENDGAME, SAMPLE_LEVELING } from '@/domain/builds/samples';
import { SKIN_TEXTURES, skinVariables } from '@/design-system/skin';
import { AssetResolver } from '@/services/assets/resolver';
import type { AssetManifest } from '@/services/assets/types';

function manifest(ids: string[]): AssetManifest {
  return {
    schemaVersion: 1,
    gameBuild: '3.2.0',
    locale: 'enUS',
    generatedAtUnix: 0,
    source: 'test',
    assets: Object.fromEntries(
      ids.map((id) => [
        id,
        { file: `ui/${id}.png`, category: 'ui', width: 1, height: 1, sha256: '', texture: 't', frame: null },
      ]),
    ),
    failures: [],
  };
}

describe('AssetResolver', () => {
  it('prefers game assets, then user packs, then nothing', () => {
    const r = new AssetResolver(
      { manifest: manifest(['a', 'b']), urlFor: (f) => `game://${f}` },
      { manifest: manifest(['b', 'c']), urlFor: (f) => `user://${f}` },
    );
    expect(r.resolve('a')).toMatchObject({ url: 'game://ui/a.png', source: 'game' });
    expect(r.resolve('b')).toMatchObject({ source: 'game' });
    expect(r.resolve('c')).toMatchObject({ url: 'user://ui/c.png', source: 'user' });
    expect(r.resolve('missing')).toEqual({ url: null, source: 'none' });
    expect(r.resolve(null)).toEqual({ url: null, source: 'none' });
    expect(r.hasGameAssets).toBe(true);
    expect(r.counts()).toEqual({ ui: 2 });
  });

  it('works with no assets at all', () => {
    const r = AssetResolver.empty();
    expect(r.hasGameAssets).toBe(false);
    expect(r.url('skill.barbarian.bash')).toBeNull();
    expect(r.has('anything')).toBe(false);
  });
});

describe('native skin', () => {
  it('stays off unless the required textures are present', () => {
    const partial = new AssetResolver({ manifest: manifest(['ui.nine.panel']), urlFor: (f) => f });
    expect(skinVariables(partial)).toBeNull();
    expect(skinVariables(AssetResolver.empty())).toBeNull();
  });

  it('maps every available texture to a CSS variable', () => {
    const ids = Object.values(SKIN_TEXTURES);
    const full = new AssetResolver({ manifest: manifest(ids), urlFor: (f) => `asset://${f}` });
    const vars = skinVariables(full)!;
    expect(Object.keys(vars)).toHaveLength(Object.keys(SKIN_TEXTURES).length);
    expect(vars['--d4-panel']).toBe('url("asset://ui/ui.nine.panel.png")');
  });
});

describe('settings', () => {
  it('fills defaults and repairs invalid values', () => {
    const s = parseSettings({ overlay: { opacity: 'loud' }, hotkeys: { scan: 'Alt+S' } });
    expect(s.hotkeys.scan).toBe('Alt+S');
    expect(s.hotkeys.toggleOverlay).toBe(defaultSettings().hotkeys.toggleOverlay);
    expect(typeof s.overlay.opacity).toBe('number');
    expect(s.privacy.keepScanImages).toBe(false);
  });

  it('formats accelerators as key caps', () => {
    expect(hotkeyParts('CommandOrControl+Shift+D')).toEqual(['Ctrl', 'Shift', 'D']);
  });
});

describe('persistence', () => {
  it('round-trips builds, progress, transition and settings', () => {
    const state = {
      ...defaultPersisted(),
      builds: { leveling: SAMPLE_LEVELING, endgame: SAMPLE_ENDGAME },
      progress: { ...defaultPersisted().progress, level: 42, paragon: 7 },
      transition: { phase: 'endgame' as const, postponedUntil: null, history: [] },
      onboardingComplete: true,
    };
    const back = deserialize(serialize(state));
    expect(back.builds.leveling?.name).toBe(SAMPLE_LEVELING.name);
    expect(back.builds.endgame?.name).toBe(SAMPLE_ENDGAME.name);
    expect(back.progress.level).toBe(42);
    expect(back.transition.phase).toBe('endgame');
    expect(back.onboardingComplete).toBe(true);
  });

  it('drops only the corrupt section', () => {
    const good = JSON.parse(
      serialize({
        ...defaultPersisted(),
        builds: { leveling: SAMPLE_LEVELING },
        progress: { ...defaultPersisted().progress, level: 30 },
        onboardingComplete: true,
      }),
    ) as Record<string, unknown>;
    const back = deserialize(JSON.stringify({ ...good, progress: { level: 'thirty' } }));
    expect(back.builds.leveling?.name).toBe(SAMPLE_LEVELING.name);
    expect(back.progress.level).toBe(defaultPersisted().progress.level);
    expect(back.onboardingComplete).toBe(true);
  });

  it('survives garbage and empty storage', () => {
    expect(deserialize('not json')).toEqual(defaultPersisted());
    expect(deserialize(null)).toEqual(defaultPersisted());
  });

  it('does not keep tooltip images unless the user opted in', () => {
    const scan = {
      id: 's1',
      at: '2026-10-18T00:00:00.000Z',
      source: 'upload' as const,
      lines: ['x'],
      image: 'data:image/png;base64,AAAA',
      item: JSON.parse('null'),
    };
    const text = serialize({ ...defaultPersisted(), scans: [scan] });
    expect(text).not.toContain('base64');
  });
});
