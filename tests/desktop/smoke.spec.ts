import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Launches the built desktop app with WebView2 remote debugging and checks the
 * native side end to end: commands respond, the windows exist, and a real GDI
 * screen capture + Windows OCR reads a tooltip that the app itself shows on
 * screen (region mode, so the result does not depend on where the mouse is).
 *
 * The app uses its normal data folder; the test only reads state and adds one
 * scan to the history.
 */

const EXE = process.env.GRIMTOME_EXE ?? resolve('target/release/grimtome.exe');
const PORT = 9333;

let app: ChildProcess | undefined;
let browser: Browser | undefined;

async function waitForCdp(): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('WebView2 did not expose the debugging port');
}

async function mainPage(b: Browser): Promise<Page> {
  for (let i = 0; i < 50; i++) {
    const page = b
      .contexts()
      .flatMap((c) => c.pages())
      .find((p) => !p.url().includes('window=overlay') && !p.url().startsWith('about:'));
    if (page) return page;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('main window page not found');
}

const invoke = <T>(page: Page, cmd: string, args: Record<string, unknown> = {}) =>
  page.evaluate(
    ([c, a]) =>
      (
        window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => Promise<unknown> } }
      ).__TAURI_INTERNALS__.invoke(c as string, a),
    [cmd, args] as const,
  ) as Promise<T>;

test.skip(process.platform !== 'win32', 'Windows only');
test.skip(!existsSync(EXE), `build the app first (${EXE} not found)`);

test.beforeAll(async () => {
  app = spawn(EXE, [], {
    env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    stdio: 'ignore',
  });
  await waitForCdp();
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
});

test.afterAll(async () => {
  await browser?.close().catch(() => {});
  if (app && app.exitCode === null) {
    // Wait for a full exit: Grimtome is single-instance, so a lingering process
    // would swallow the next launch.
    const exited = new Promise((r) => app!.once('exit', r));
    app.kill();
    await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
    await new Promise((r) => setTimeout(r, 1000));
  }
});

test('desktop host answers and reads a tooltip from the screen', async () => {
  const page = await mainPage(browser!);
  await page.waitForFunction(() => '__TAURI_INTERNALS__' in window);
  await page.waitForSelector('.gt-shell, .gt-ob', { timeout: 30_000 });

  const location = await invoke<string>(page, 'storage_location');
  expect(location).toMatch(/app\.grimtome\.desktop/);

  const langs = await invoke<string[]>(page, 'ocr_languages');
  expect(langs.length).toBeGreaterThan(0);

  const status = await invoke<{ root: string | null; error: string | null }>(page, 'assets_status');
  expect(status.error).toBeNull();
  if (status.root) {
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.skin ?? null)).toBe('game');
  }
  await page.screenshot({ path: 'test-results/desktop/main.png' });

  // Show a sample tooltip full size in the window, then capture exactly that area.
  const shown = await page.evaluate(async () => {
    const img = new Image();
    img.src = '/samples/legendary-gloves-earthquakes.png';
    img.id = 'smoke-sample';
    Object.assign(img.style, { position: 'fixed', left: '40px', top: '80px', zIndex: '99999' });
    document.body.append(img);
    await img.decode();
    const r = img.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, dpr: window.devicePixelRatio };
  });
  const { x, y } = await invoke<{ x: number; y: number }>(page, 'plugin:window|inner_position', {
    label: 'main',
  });
  const region = {
    x: Math.round(x + shown.x * shown.dpr),
    y: Math.round(y + shown.y * shown.dpr),
    width: Math.round(shown.w * shown.dpr),
    height: Math.round(shown.h * shown.dpr),
  };
  type Payload = {
    ocr: { lines: { text: string; color?: string }[] };
    captureMs: number;
    image: string | null;
  };
  // The capture reads real screen pixels, so the window must be painted and on
  // top. Give it a moment and retry if another window was in front.
  let payload: Payload | undefined;
  for (let attempt = 0; attempt < 3 && !payload?.ocr.lines.length; attempt++) {
    await page.waitForTimeout(600);
    payload = await invoke<Payload>(page, 'scan_capture', {
      settings: { mode: 'region', region, language: 'en-US' },
    });
  }
  if (!payload) throw new Error('no capture');
  if (payload.image) {
    writeFileSync(
      'test-results/desktop/capture.png',
      Buffer.from(payload.image.split(',')[1] ?? '', 'base64'),
    );
  }
  const texts = payload.ocr.lines.map((l) => l.text);
  expect(texts[0]).toContain('Gauntlets of Earthquakes');
  expect(texts.join('\n')).toMatch(/800 Item Power/);
  expect(payload.ocr.lines[0]?.color).toMatch(/^#[0-9a-f]{6}$/);
  expect(payload.captureMs).toBeLessThan(3000);
});
