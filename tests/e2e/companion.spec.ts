import { expect, test } from '@playwright/test';
import { goTo, onboardWithSamples, scanSample } from './helpers';

test('onboarding → progress → scan → switch build → reload keeps everything', async ({ page }) => {
  await onboardWithSamples(page);
  await expect(page.locator('.gt-hero__title')).toHaveText('Whirlwind Leveling');

  // Character progress
  await page.getByRole('textbox', { name: 'Character level' }).fill('42');
  await expect(page.getByRole('textbox', { name: 'Character level' })).toHaveValue('42');

  // A unique the endgame build needs is stashed while leveling…
  await scanSample(page, 'Unique mace');
  await expect(page.locator('.gt-verdict__label')).toHaveText('Stash for endgame');
  await expect(page.locator('.gt-item-card__name')).toHaveText("Ramaladni's Magnum Opus");

  // …and becomes an upgrade once the endgame build is active.
  await goTo(page, 'Builds');
  await page.getByRole('button', { name: 'Switch to endgame' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Switch now' }).click();
  await expect(page.locator('.gt-charcard__role')).toHaveText(/endgame/i);
  await goTo(page, 'Item Advisor');
  await expect(page.locator('.gt-verdict__label')).toHaveText('Upgrade candidate');

  // Everything survives a reload.
  await page.reload();
  await expect(page.locator('.gt-shell')).toBeVisible();
  await expect(page.locator('.gt-charcard__role')).toHaveText(/endgame/i);
  await expect(page.locator('.gt-charcard__meta')).toContainText('42');
  await goTo(page, 'Item Advisor');
  await expect(page.locator('.gt-strip__item')).toHaveCount(1);
  await expect(page.locator('.gt-verdict__label')).toHaveText('Upgrade candidate');
});

test('pasted tooltip text is parsed and judged', async ({ page }) => {
  await onboardWithSamples(page);
  await goTo(page, 'Item Advisor');
  await page.getByRole('button', { name: 'Paste text' }).click();
  await page
    .getByRole('dialog')
    .getByRole('textbox')
    .fill(
      [
        'Ember Band',
        'Rare Ring',
        '750 Item Power',
        '+18.0% Lightning Resistance',
        '+7.5% Gold Drop Rate',
        'Requires Level 55',
      ].join('\n'),
    );
  await page.getByRole('dialog').getByRole('button', { name: 'Analyze' }).click();
  await expect(page.locator('.gt-item-card__name')).toHaveText('Ember Band');
  await expect(page.locator('.gt-verdict__label')).toHaveText('Salvage / sell');
});
