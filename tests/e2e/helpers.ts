import { expect, type Page } from '@playwright/test';

/** Starts from a clean profile and completes onboarding with the sample builds. */
export async function onboardWithSamples(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByText('Try the sample builds').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  const enter = page.getByRole('button', { name: 'Enter Grimtome' });
  const next = page.getByRole('button', { name: 'Continue' });
  await enter.or(next).first().waitFor();
  if (!(await enter.isVisible())) await next.click();
  await enter.click();
  await expect(page.locator('.gt-shell')).toBeVisible();
}

export async function goTo(page: Page, label: string): Promise<void> {
  await page.locator('.gt-nav__item', { hasText: label }).first().click();
}

/** Scans one of the bundled sample tooltips through the normal OCR → parse path. */
export async function scanSample(page: Page, title: string): Promise<void> {
  await goTo(page, 'Item Advisor');
  const item = page.locator('.gt-samples__item', { hasText: title }).first();
  const toggle = page.getByRole('button', { name: 'Samples', exact: true });
  await item.or(toggle).first().waitFor();
  if (!(await item.isVisible())) await toggle.click();
  await item.click();
  await expect(page.getByTestId('advisor-result')).toBeVisible();
}

/** Hides toasts so screenshots are stable. */
export async function hideToasts(page: Page): Promise<void> {
  await page.addStyleTag({ content: '.gt-toasts { display: none !important; }' });
}
