# Pausekeeper repair handoff

## Release status — PASS

The release-blocking findings reported for candidate `d47a4fbcd4ca20cd596077fa0fe13a8d24b23a41` in verifier commit `8d027a7b91bbe93daabffd083d1520c420007b31` are repaired. Source repairs are in `783f06d`; expanded release coverage and deployment policy are in `e209c55`.

The repaired static PWA was deployed on 2026-08-28 with factory deployment ID `689b1dc4-c3da-4f92-b230-8d51d3425d63` and verified at <https://natural-pause-recorder.sociobot.in>.

## Repairs

- Project imports now parse and validate the complete version-1 envelope, every take field, both WAV payloads, audio metadata, the full segment timeline, and duplicate IDs before any mutation.
- All imported takes are written in one IndexedDB read/write transaction. Any request or transaction failure aborts the batch. Existing-ID replacements require a specific confirmation before the transaction starts.
- The exact data-loss regression seeds `qa-existing`, imports a valid colliding first item followed by an invalid item without `rawWav`, accepts the invalid-file alert, and then reads IndexedDB to prove the original name and single-record count are unchanged.
- Playwright now feeds Chromium a generated deterministic 48 kHz WAV with a known restorable pause. The formerly flaky record → review → restore test passed in four complete parallel-suite runs, including twice consecutively and once after the final clean install.
- “Skip to recorder” now targets the focusable recorder workbench. Its regression activates the link and asserts focus moves to `#recorder`.
- Dark-console controls use a cream 3 px focus outline: measured contrast is **11.93:1** against walnut, up from the reported 2.19:1. Header, brand, and footer links now measure at least 44 CSS px high at desktop and 390 px.
- `staticwebapp.config.json` adds the restrictive CSP, `Permissions-Policy: microphone=(self), camera=(), geolocation=()`, `X-Frame-Options: DENY`, COOP/CORP, one-year preload HSTS, manifest MIME mapping, and one-year immutable caching for content-hashed JS/CSS.
- The service-worker cache advanced to `pausekeeper-shell-v4`, and the manifest start URL advanced to `/?v=2`.

## Clean local verification

Run from the repository root:

```sh
npm ci
npm test
npm run build
npm run test:e2e
```

Results on 2026-08-28:

- `npm ci`: 58 packages installed; audit reported **0 vulnerabilities**.
- `npm test`: **9/9** Vitest tests passed across audio and backup parsing.
- `npm run build`: strict `tsc --noEmit` passed; Vite 7.3.6 produced `dist/`.
- `npm run test:e2e`: **8/8** Playwright 1.58.2 tests passed after the final clean install; three earlier complete repair runs also passed, including two consecutively.
- Browser coverage includes deterministic microphone record → review → pause restore → WAV export → refresh persistence, project export → delete → import round trip, atomic malformed-import rejection, service-worker offline home/privacy navigation, keyboard skip and dialog focus return, desktop/390 px target sizing and overflow, deployment policy, and axe on `/`, `/privacy`, and `/terms`.
- Axe WCAG 2 A/AA: **0 serious or critical findings** on all three routes.
- Factory URL verification: title, `lang=en`, one `h1`, `main`, all image alt attributes, labeled buttons, and **0 console/page errors**.
- Desktop 1366×900 and mobile 390×844 full-page screenshots were visually reviewed; no clipping, overflow, or identity regression was found.
- Reduced motion: animation duration `0.01ms`, one iteration, and instant scroll behavior.

The Azure Static Web Apps emulator confirmed the deployed response configuration before release: hashed JS/CSS received `public, max-age=31536000, immutable`; the manifest received `application/manifest+json`; all security headers were present; the app loaded with no CSP console errors.

## Performance and budgets

Lighthouse 12.8.2 mobile against the local production build scored **100 Performance / 100 Accessibility / 100 Best Practices / 100 SEO**: FCP 1.0 s, LCP 1.4 s, TBT 30 ms, CLS 0, total transfer 92 KiB.

The live origin scored **100 / 100 / 100 / 100**: FCP 1.0 s, LCP 1.3 s, TBT 20 ms, CLS 0, total transfer 92 KiB.

- Initial JS: 25.74 KB raw / 9.96 KB gzip (budget ≤200 KB).
- CSS: 14.88 KB raw / 4.54 KB gzip (budget ≤50 KB).
- Fonts: 0 network bytes (budget ≤120 KB).
- Mobile AVIF hero: 51.26 KB (budget ≤300 KB).

## Live verification

- All **15/15** deployed product artifacts match the local `dist/` byte-for-byte: HTML; hashed JS, source map, and CSS; service worker; manifest; offline page; robots and sitemap; both icons; and all four hero variants.
- Live HTML returns CSP with `frame-ancestors 'none'`, microphone-scoped Permissions-Policy, `X-Frame-Options: DENY`, COOP/CORP, and `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.
- Live hashed JS and CSS return `Cache-Control: public, max-age=31536000, immutable`.
- Live `/manifest.webmanifest` returns `Content-Type: application/manifest+json`.
- Fresh live navigation made no third-party requests and emitted no console/page errors. Audio remains local; the only permitted external connection is explicit Sociobot license verification.
- Live offline reload succeeded for `/` and `/privacy` under a controlling `sw.js`.
- A byte-distinct v4 → v5 worker simulation displayed “A fresh version is ready,” activated through **Update now**, removed the old cache, reloaded under the new controller, and emitted no errors.
- Live license-policy smoke test stripped the returned token from the URL, made one routed Sociobot verification request, re-locked a revoked license with the buy link visible, and reused the daily verdict on reload without a second request.

## Known limits

- Capture still uses browser `ScriptProcessorNode` for broad direct-PCM compatibility; a future AudioWorklet migration would improve long-session architecture but is not a release blocker.
- Browser storage quotas vary, so important recordings should still be exported as project backups.
- Automated capture used Chromium’s deterministic fake microphone. Physical-device and iOS Safari install/capture checks require real hardware outside this worker.
- The factory billing product must be registered and a real test purchase exercised separately; the repository contains no provider secret and uses only the required Sociobot endpoints.

## Deployment

Build output remains `./dist` with `index.html` at its root. Deployment used:

```sh
npm run build
/opt/fleet/lib/deploy-static.sh natural-pause-recorder dist
```
