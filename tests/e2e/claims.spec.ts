import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const demoUrl = '/demo';

async function openDemo(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(demoUrl);
  await expect(page.getByRole('complementary', { name: 'Demo controls' })).toBeVisible();
  await expect(page.getByText('Demo — sample data, nothing is saved to your real takes.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review protected pauses' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lesson intro — warm-up directions' })).toBeVisible();
}

async function seedRealTake(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('pausekeeper', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('takes', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const wav = new Blob([new Uint8Array([82, 73, 70, 70])], { type: 'audio/wav' });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('takes', 'readwrite');
      transaction.objectStore('takes').put({
        id: 'real-keep', name: 'Real take that must stay', createdAt: 1, duration: 1, editedDuration: 1,
        sampleRate: 8000, minSilenceMs: 700, thresholdDb: -42,
        segments: [], rawBlob: wav, editedBlob: wav,
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  });
}

async function readRealTakeName(page: import('@playwright/test').Page): Promise<string | null> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('pausekeeper', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<string | null>((resolve, reject) => {
      const request = database.transaction('takes').objectStore('takes').get('real-keep');
      request.onsuccess = () => resolve((request.result as { name?: string } | undefined)?.name ?? null);
      request.onerror = () => reject(request.error);
    });
  });
}

test('@claim:demo-sandbox loads a populated sample and never changes real takes', async ({ page }) => {
  await seedRealTake(page);
  await openDemo(page);
  await page.getByLabel('Take name').fill('Changed sample title');
  await page.getByLabel('Take name').press('Tab');
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByLabel('Take name')).toHaveValue('Lesson intro — warm-up directions');
  await expect.poll(() => readRealTakeName(page)).toBe('Real take that must stay');
});

test('@claim:record-locally records a new demo take without leaving the sandbox', async ({ page, context }) => {
  await context.grantPermissions(['microphone'], { origin: 'http://127.0.0.1:4173' });
  await openDemo(page);
  await page.getByRole('button', { name: 'Start recording' }).click();
  await expect(page.getByText('Recording', { exact: true })).toBeVisible();
  await page.waitForTimeout(1600);
  await page.getByRole('button', { name: 'Stop & review' }).click();
  await expect(page.getByText(/Demo take saved in the sample area/)).toBeVisible();
  await expect(page.locator('.take-card')).toHaveCount(2);
});

test('@claim:privacy-local keeps the sample flow on the product origin', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await openDemo(page);
  await page.getByRole('button', { name: /Restore .* pause/ }).first().click();
  await expect(page.locator('#review-status')).toContainText('Restored the full');
  expect(requests.every(url => new URL(url).origin === 'http://127.0.0.1:4173')).toBe(true);
});

test('@claim:pause-range applies both supported minimum-pause boundaries', async ({ page }) => {
  await openDemo(page);
  const control = page.getByLabel('Keep at least');
  await control.fill('300');
  await expect(page.locator('#minimum-output')).toHaveText('0.3 seconds');
  await control.fill('2500');
  await expect(page.locator('#minimum-output')).toHaveText('2.5 seconds');
});

test('@claim:long-pause-only shows held short pauses and compactable long pauses', async ({ page }) => {
  await openDemo(page);
  await expect(page.getByRole('button', { name: /Held/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Restore .* pause/ }).first()).toBeVisible();
  await expect(page.locator('#review-summary')).toContainText('compacted');
});

test('@claim:pause-restoration restores a full held pause before export', async ({ page }) => {
  await openDemo(page);
  const restore = page.getByRole('button', { name: /Restore .* pause/ }).first();
  const label = await restore.innerText();
  await restore.click();
  await expect(page.locator('#review-status')).toContainText('Restored the full');
  await expect(page.getByRole('button', { name: label.replace('Restore', 'Compact') })).toBeVisible();
});

test('@claim:pause-timeline displays separate voice and pause sections', async ({ page }) => {
  await openDemo(page);
  await expect(page.locator('.review-timeline .voice')).toHaveCount(5);
  await expect(page.locator('.review-timeline .pause')).toHaveCount(4);
  await expect(page.locator('#review-timeline')).toHaveAttribute('aria-label', /voice sections and 4 pauses/);
});

test('@claim:take-persistence keeps a demo edit after refresh', async ({ page }) => {
  await openDemo(page);
  await page.getByLabel('Take name').fill('Lesson intro — revised demo');
  await page.getByLabel('Take name').press('Tab');
  await expect(page.getByRole('heading', { name: 'Lesson intro — revised demo' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Take name')).toHaveValue('Lesson intro — revised demo');
  await expect(page.getByRole('heading', { name: 'Lesson intro — revised demo' })).toBeVisible();
});

test('@claim:wav-export downloads a playable WAV from the sample', async ({ page }) => {
  await openDemo(page);
  const download = page.waitForEvent('download');
  await page.locator('#export-current').click();
  const file = await download;
  const output = await readFile(await file.path() as string);
  expect(output.subarray(0, 4).toString()).toBe('RIFF');
  expect(output.subarray(8, 12).toString()).toBe('WAVE');
});

test('@claim:project-backup exports portable sample project data', async ({ page }) => {
  await openDemo(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export project data' }).click();
  const file = await download;
  const backup = JSON.parse(await readFile(await file.path() as string, 'utf8')) as { product: string; version: number; takes: Array<{ name: string; rawWav: string }> };
  expect(backup.product).toBe('Pausekeeper');
  expect(backup.version).toBe(1);
  expect(backup.takes).toHaveLength(1);
  expect(backup.takes[0]?.name).toBe('Lesson intro — warm-up directions');
  expect(backup.takes[0]?.rawWav.startsWith('data:audio/wav;base64,')).toBe(true);
});

test('@claim:atomic-import rejects a malformed collision without changing the sample', async ({ page }) => {
  await openDemo(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export project data' }).click();
  const file = await download;
  const backup = JSON.parse(await readFile(await file.path() as string, 'utf8')) as { takes: Array<{ id: string; name: string; rawWav: string; [key: string]: unknown }> };
  const first = { ...backup.takes[0], name: 'Bad replacement' };
  const invalidLater: Record<string, unknown> = { ...first, id: 'invalid-later-take' };
  delete invalidLater.rawWav;
  const alert = page.waitForEvent('dialog');
  await page.locator('#import-data').setInputFiles({ name: 'broken-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ product: 'Pausekeeper', version: 1, takes: [first, invalidLater] })) });
  const dialog = await alert;
  expect(dialog.message()).toContain('existing takes were not changed');
  await dialog.accept();
  await expect(page.getByRole('heading', { name: 'Lesson intro — warm-up directions' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Lesson intro — warm-up directions' })).toBeVisible();
});

test('@claim:offline-reload reloads the demo after a first visit', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await openDemo(page);
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 10_000 });
  const cachedUrls = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async name => (await caches.open(name)).keys()))).flat().map(request => request.url));
  expect(cachedUrls.some(url => /\/assets\/index-.*\.js$/.test(url))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  expect(page.url()).toContain('/demo');
  await expect(page.getByText('Demo — sample data, nothing is saved to your real takes.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review protected pauses' })).toBeVisible();
  await context.close();
});

test('@claim:plus-convenience keeps core export available while batch export is paid', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: 'Export all WAVs' }).click();
  await expect(page.locator('#license-state')).toContainText('Batch ZIP export requires Plus');
  const download = page.waitForEvent('download');
  await page.locator('#export-current').click();
  await expect(await download).toBeTruthy();
  await expect(page.getByRole('link', { name: 'Buy Plus — $12 once' })).toBeVisible();
});

test('@claim:daily-license-check reuses a valid demo license verdict for one day', async ({ page }) => {
  let requests = 0;
  await page.addInitScript(() => localStorage.setItem('demo:sb_license:natural-pause-recorder', 'demo-license-token'));
  await page.route('https://api.sociobot.in/api/v1/products/natural-pause-recorder/verify?license=demo-license-token', async route => {
    requests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true, reason: 'ok', expires_at: null }) });
  });
  await openDemo(page);
  await expect(page.locator('#license-state')).toContainText('Plus unlocked on this device');
  await page.reload();
  await expect(page.locator('#license-state')).toContainText('Plus unlocked');
  expect(requests).toBe(1);
});

test('@claim:no-speech-profiling does not generate a transcript or send sample audio away', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await openDemo(page);
  await page.getByRole('button', { name: /Restore .* pause/ }).first().click();
  await expect(page.locator('[aria-label*="transcript" i]')).toHaveCount(0);
  await expect(page.getByText(/Restored the full/)).toBeVisible();
  expect(requests.every(url => new URL(url).origin === 'http://127.0.0.1:4173')).toBe(true);
});
