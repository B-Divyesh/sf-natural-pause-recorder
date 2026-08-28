import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('has a clear, keyboard-reachable recorder', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page).toHaveTitle(/Pausekeeper/);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to recorder' })).toBeFocused();
  expect(errors).toEqual([]);
});

test('app shell and legal pages work offline after first load', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 10_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Keep the pauses');
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Privacy');
});

test('mobile layout exposes core actions without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible();
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client);
});

test('records, reviews, restores and exports a take locally', async ({ page, context }) => {
  await context.grantPermissions(['microphone'], { origin: 'http://127.0.0.1:4173' });
  await page.goto('/');
  await page.getByLabel('Keep at least').fill('300');
  await page.getByLabel('Voice sensitivity').fill('-30');
  await page.getByRole('button', { name: 'Start recording' }).click();
  await expect(page.getByText('Recording', { exact: true })).toBeVisible();
  await page.waitForTimeout(1800);
  await page.getByRole('button', { name: 'Stop & review' }).click();
  await expect(page.getByRole('heading', { name: 'Shape the quiet' })).toBeVisible();
  await page.getByRole('button', { name: /Restore .* pause/ }).click();
  await expect(page.getByText(/Restored the full/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export WAV' }).first()).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export WAV' }).first().click();
  await expect((await download).suggestedFilename()).toMatch(/\.wav$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Take / })).toBeVisible();
});

test('has no serious or critical automated accessibility violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.filter(violation => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
});
