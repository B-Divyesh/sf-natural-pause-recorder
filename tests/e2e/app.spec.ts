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
  await page.keyboard.press('Enter');
  await expect(page.locator('#recorder')).toBeFocused();
  expect(errors).toEqual([]);
});

test('focus indicators and navigation links meet non-text target requirements', async ({ page }) => {
  const contrast = ([redA, greenA, blueA]: number[], [redB, greenB, blueB]: number[]) => {
    const luminance = ([red, green, blue]: number[]) => {
      const channels = [red, green, blue].map(channel => {
        const value = channel / 255;
        return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
      });
      return .2126 * (channels[0] ?? 0) + .7152 * (channels[1] ?? 0) + .0722 * (channels[2] ?? 0);
    };
    const [lighter, darker] = [luminance([redA, greenA, blueA]), luminance([redB, greenB, blueB])].sort((a, b) => b - a);
    return ((lighter ?? 0) + .05) / ((darker ?? 0) + .05);
  };
  const rgb = (value: string) => (value.match(/\d+/g) ?? []).slice(0, 3).map(Number);

  await page.goto('/');
  const recordButton = page.getByRole('button', { name: 'Start recording' });
  await recordButton.focus();
  const colors = await recordButton.evaluate(element => ({
    outline: getComputedStyle(element).outlineColor,
    surface: getComputedStyle(element.closest('.recorder-panel') as Element).backgroundColor,
  }));
  // The panel is transparent, so compare against its painted console parent.
  const consoleColor = await page.locator('.console').evaluate(element => getComputedStyle(element).backgroundColor);
  expect(contrast(rgb(colors.outline), rgb(colors.surface === 'rgba(0, 0, 0, 0)' ? consoleColor : colors.surface))).toBeGreaterThanOrEqual(3);

  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const links = page.locator('.site-header a:visible, footer a:visible');
    for (let index = 0; index < await links.count(); index += 1) {
      const box = await links.nth(index).boundingBox();
      expect(box?.height, `link ${index} at ${viewport.width}px`).toBeGreaterThanOrEqual(44);
    }
  }
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
  await page.waitForTimeout(2200);
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

test('a rejected later import item cannot overwrite an earlier colliding take', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const sampleRate = 8_000;
    const samples = sampleRate;
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    const text = (offset: number, value: string) => { for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index)); };
    text(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text(36, 'data'); view.setUint32(40, samples * 2, true);
    const wav = new Blob([buffer], { type: 'audio/wav' });
    const take = {
      id: 'qa-existing', name: 'Original irreplaceable take', createdAt: Date.now(), duration: 1, editedDuration: 1,
      sampleRate, minSilenceMs: 700, thresholdDb: -42,
      segments: [{ id: '0-8000', type: 'voice', start: 0, end: samples, originalDuration: 1, outputDuration: 1, restored: true }],
      rawBlob: wav, editedBlob: wav,
    };
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('pausekeeper', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('takes', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('takes', 'readwrite');
      transaction.objectStore('takes').put(take);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Original irreplaceable take' })).toBeVisible();

  const dialogPromise = page.waitForEvent('dialog');
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('pausekeeper', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const existing = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const request = database.transaction('takes').objectStore('takes').get('qa-existing');
      request.onsuccess = () => resolve(request.result as Record<string, unknown>);
      request.onerror = () => reject(request.error);
    });
    const toDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const first = { ...existing, name: 'OVERWRITTEN BY REJECTED IMPORT', rawBlob: undefined, editedBlob: undefined, rawWav: await toDataUrl(existing.rawBlob as Blob), editedWav: await toDataUrl(existing.editedBlob as Blob) };
    const second = { ...first, id: 'invalid-later-take' } as Record<string, unknown>;
    delete second.rawWav;
    const transfer = new DataTransfer();
    transfer.items.add(new File([JSON.stringify({ product: 'Pausekeeper', version: 1, takes: [first, second] })], 'malformed-project.json', { type: 'application/json' }));
    const input = document.querySelector<HTMLInputElement>('#import-data');
    if (!input) throw new Error('Missing import input');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const dialog = await dialogPromise;
  expect(dialog.message()).toContain('existing takes were not changed');
  await dialog.accept();

  const stored = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('pausekeeper', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<{ name: string; count: number }>((resolve, reject) => {
      const transaction = database.transaction('takes');
      const store = transaction.objectStore('takes');
      const recordRequest = store.get('qa-existing');
      const countRequest = store.count();
      transaction.oncomplete = () => resolve({ name: recordRequest.result.name as string, count: countRequest.result });
      transaction.onerror = () => reject(transaction.error);
    });
  });
  expect(stored).toEqual({ name: 'Original irreplaceable take', count: 1 });
});

test('deployment policy declares security, immutable assets, and manifest MIME', async ({ request }) => {
  const response = await request.get('/staticwebapp.config.json');
  expect(response.ok()).toBeTruthy();
  const config = await response.json() as {
    routes: Array<{ route: string; headers: Record<string, string> }>;
    globalHeaders: Record<string, string>;
    mimeTypes: Record<string, string>;
  };
  expect(config.routes).toContainEqual(expect.objectContaining({ route: '/assets/index-*', headers: expect.objectContaining({ 'Cache-Control': expect.stringContaining('immutable') }) }));
  expect(config.globalHeaders['Content-Security-Policy']).toContain("frame-ancestors 'none'");
  expect(config.globalHeaders['Permissions-Policy']).toContain('microphone=(self)');
  expect(config.globalHeaders['X-Frame-Options']).toBe('DENY');
  expect(config.globalHeaders['Strict-Transport-Security']).toContain('max-age=31536000');
  expect(config.mimeTypes['.webmanifest']).toBe('application/manifest+json');
});

test('has no serious or critical automated accessibility violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.filter(violation => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
});
