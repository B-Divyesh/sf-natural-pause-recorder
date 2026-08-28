import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { cp, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';

const root = await mkdtemp(join(tmpdir(), 'pausekeeper-update-'));
await cp('dist', root, { recursive: true });
const workerPath = join(root, 'sw.js');
const worker = await readFile(workerPath, 'utf8');
await writeFile(workerPath, worker.replace('pausekeeper-shell-v5', 'pausekeeper-update-a'));

const contentTypes = new Map([
  ['.avif', 'image/avif'], ['.css', 'text/css'], ['.html', 'text/html'], ['.js', 'text/javascript'],
  ['.jpg', 'image/jpeg'], ['.json', 'application/json'], ['.png', 'image/png'], ['.webmanifest', 'application/manifest+json'], ['.webp', 'image/webp'],
]);
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    let filePath = join(root, normalize(pathname).replace(/^\/+/, ''));
    try { if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html'); }
    catch { filePath = join(root, 'index.html'); }
    const body = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': contentTypes.get(extname(filePath)) ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(500).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address === 'object');
const origin = `http://127.0.0.1:${address.port}`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(origin);
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 10_000 });

  await writeFile(workerPath, worker.replace('pausekeeper-shell-v5', 'pausekeeper-update-b'));
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())?.update(); });
  await page.getByText('A fresh version is ready').waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Update now' }).click();
  await page.waitForFunction(async () => (await caches.keys()).includes('pausekeeper-update-b'), null, { timeout: 10_000 });
  const cacheNames = await page.evaluate(() => caches.keys());
  assert.deepEqual(cacheNames, ['pausekeeper-update-b']);
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  await rm(root, { recursive: true, force: true });
}

console.log('Service-worker update toast, activation, reload, and old-cache cleanup passed');
