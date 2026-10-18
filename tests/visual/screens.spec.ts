import { expect, test } from '@playwright/test';
import { goTo, hideToasts, onboardWithSamples, scanSample } from '../e2e/helpers';

/**
 * Visual regression for the main screens at common desktop sizes. Runs without
 * game assets, so baselines contain only Grimtome's own artwork.
 */

const SIZES = [
  { name: '1080p', viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  { name: '1440p', viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 },
  { name: 'hidpi', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
] as const;

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: size.viewport, deviceScaleFactor: size.deviceScaleFactor });

    test('screens', async ({ page }) => {
      await onboardWithSamples(page);
      await hideToasts(page);
      await expect(page).toHaveScreenshot(`dashboard-${size.name}.png`);

      await scanSample(page, 'Legendary gloves');
      await expect(page).toHaveScreenshot(`advisor-${size.name}.png`);

      for (const [label, file] of [
        ['Skills', 'skills'],
        ['Paragon', 'paragon'],
        ['Builds', 'builds'],
        ['Settings', 'settings'],
      ] as const) {
        await goTo(page, label);
        await page.locator('.gt-main').evaluate((el) => el.scrollTo(0, 0));
        await expect(page).toHaveScreenshot(`${file}-${size.name}.png`);
      }

      await goTo(page, 'Builds');
      await page.getByRole('button', { name: 'Switch to endgame' }).click();
      await expect(page.getByRole('dialog')).toHaveScreenshot(`transition-dialog-${size.name}.png`);
    });
  });
}

test('overlay', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 260 });
  await page.goto('/?window=overlay&demo');
  await expect(page.locator('.gt-ov__card')).toBeVisible();
  await expect(page.locator('.gt-ov__card')).toHaveScreenshot('overlay.png');
});
