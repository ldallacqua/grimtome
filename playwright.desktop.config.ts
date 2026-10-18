import { defineConfig } from '@playwright/test';

/**
 * Desktop smoke tests: launch the real Grimtome executable and drive its WebView2
 * through the Chrome DevTools Protocol. Windows only; build first with
 * `pnpm app:build` (or set GRIMTOME_EXE). See docs/TESTING.md.
 */
export default defineConfig({
  testDir: 'tests/desktop',
  timeout: 120_000,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results/desktop',
});
