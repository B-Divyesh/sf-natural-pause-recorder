import { strict as assert } from 'node:assert';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const origin = process.env.PAUSEKEEPER_URL ?? 'https://natural-pause-recorder.sociobot.in';

const home = await fetch(`${origin}/`, { redirect: 'manual' });
assert.equal(home.status, 200, 'home must return HTTP 200');
const html = await home.text();
assert.match(html, /<title>Pausekeeper/, 'live HTML must be Pausekeeper');
assert.match(home.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
assert.match(home.headers.get('permissions-policy') ?? '', /microphone=\(self\)/);
assert.equal(home.headers.get('x-frame-options'), 'DENY');
assert.match(home.headers.get('strict-transport-security') ?? '', /max-age=31536000/);

const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map(match => match[1]);
assert.equal(assets.length, 2, 'live HTML must reference one JS and one CSS asset');
for (const asset of assets) {
  const response = await fetch(`${origin}${asset}`);
  assert.match(response.headers.get('cache-control') ?? '', /max-age=31536000/);
  assert.match(response.headers.get('cache-control') ?? '', /immutable/);
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? filesBelow(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
}
const deployableFiles = (await filesBelow('dist')).filter(path => !path.endsWith('staticwebapp.config.json'));
assert.equal(deployableFiles.length, 15, 'production build must contain the expected 15 public files');
for (const file of deployableFiles) {
  const asset = `/${relative('dist', file)}`;
  const response = await fetch(`${origin}${asset}`);
  assert.equal(response.status, 200, `${asset} must return HTTP 200`);
  const local = await readFile(file);
  const live = Buffer.from(await response.arrayBuffer());
  assert.deepEqual(live, local, `${asset} must match the local production build byte-for-byte`);
}

const manifest = await fetch(`${origin}/manifest.webmanifest`);
assert.equal(manifest.status, 200);
assert.match(manifest.headers.get('content-type') ?? '', /^application\/manifest\+json/i);

const checkout = await fetch('https://api.sociobot.in/api/v1/products/natural-pause-recorder/checkout', { redirect: 'manual' });
assert.equal(checkout.status, 303, 'checkout must redirect to the hosted payment page');
const checkoutLocation = new URL(checkout.headers.get('location') ?? '');
assert.equal(checkoutLocation.protocol, 'https:');
assert.equal(checkoutLocation.hostname, 'checkout.dodopayments.com');

const verification = await fetch('https://api.sociobot.in/api/v1/products/natural-pause-recorder/verify?license=release-check-not-a-license');
assert.equal(verification.status, 200);
assert.deepEqual(await verification.json(), { valid: false, reason: 'invalid', expires_at: null });

console.log(`Live identity, response policy, immutable assets, checkout redirect, and verification passed for ${origin}`);
