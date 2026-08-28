import { strict as assert } from 'node:assert';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const origin = process.env.PAUSEKEEPER_URL ?? 'https://natural-pause-recorder.sociobot.in';
const evidence = process.env.PAUSEKEEPER_EVIDENCE ?? '/work/.evidence/pausekeeper-repair-2';
await mkdir(evidence, { recursive: true });

const browser = await chromium.launch();
const browserErrors = [];
const unexpectedHosts = new Set();
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await context.newPage();
page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });
page.on('pageerror', error => browserErrors.push(String(error)));
page.on('request', request => {
  const host = new URL(request.url()).hostname;
  if (host !== new URL(origin).hostname) unexpectedHosts.add(host);
});

await page.goto(origin, { waitUntil: 'networkidle' });
await page.screenshot({ path: `${evidence}/live-desktop.png`, fullPage: true });
assert.equal(await page.locator('h1').count(), 1);
assert.equal(await page.locator('main').count(), 1);
assert.equal(await page.locator('img:not([alt])').count(), 0);
assert.equal(await page.locator('body').evaluate(element => getComputedStyle(element).fontSize), '16px');

await page.keyboard.press('Tab');
assert.equal(await page.getByRole('link', { name: 'Skip to recorder' }).evaluate(element => element === document.activeElement), true);
await page.keyboard.press('Enter');
assert.equal(await page.locator('#recorder').evaluate(element => element === document.activeElement), true);
const restoreLicense = page.getByRole('button', { name: 'Have a license? Restore it' });
await restoreLicense.click();
assert.equal(await page.getByRole('button', { name: 'Close license dialog' }).evaluate(element => element === document.activeElement), true);
await page.keyboard.press('Escape');
assert.equal(await restoreLicense.evaluate(element => element === document.activeElement), true);

for (const path of ['/', '/privacy', '/terms']) {
  await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  assert.deepEqual(results.violations.filter(violation => ['serious', 'critical'].includes(violation.impact ?? '')), [], `${path} has serious or critical axe findings`);
}

await page.emulateMedia({ reducedMotion: 'reduce' });
await page.goto(origin);
const reducedMotion = await page.locator('#record-lamp').evaluate(element => {
  const style = getComputedStyle(element);
  return { duration: style.animationDuration, iterations: style.animationIterationCount };
});
assert.equal(reducedMotion.duration, '1e-05s');
assert.equal(reducedMotion.iterations, '1');

const cdp = await context.newCDPSession(page);
const manifest = await cdp.send('Page.getAppManifest');
assert.equal(manifest.errors.length, 0, 'manifest must parse without errors');
const installability = await cdp.send('Page.getInstallabilityErrors');
assert.equal(installability.installabilityErrors.length, 0, 'PWA must have no installability errors');
assert.deepEqual([...unexpectedHosts], [], 'normal use must not contact third parties');
assert.deepEqual(browserErrors, [], 'desktop/legal checks must not emit console or page errors');

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mobilePage = await mobile.newPage();
await mobilePage.goto(origin, { waitUntil: 'networkidle' });
const width = await mobilePage.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
assert.ok(width.scroll <= width.client, `mobile overflow: ${width.scroll}px > ${width.client}px`);
for (const link of await mobilePage.locator('.site-header a:visible, footer a:visible').all()) {
  const box = await link.boundingBox();
  assert.ok((box?.height ?? 0) >= 44, 'mobile navigation target must be at least 44px high');
}
await mobilePage.screenshot({ path: `${evidence}/live-mobile-390.png`, fullPage: true });
await mobile.close();

const offline = await browser.newContext();
const offlinePage = await offline.newPage();
await offlinePage.goto(origin);
await offlinePage.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 10_000 });
await offline.setOffline(true);
await offlinePage.reload();
assert.match(await offlinePage.locator('h1').innerText(), /Keep the pauses/);
await offlinePage.goto(`${origin}/privacy`);
assert.match(await offlinePage.locator('h1').innerText(), /Privacy/);
await offline.close();

await context.close();
await browser.close();
console.log('Live desktop, 390px mobile, keyboard, axe, reduced-motion, installability, privacy, and offline checks passed');
