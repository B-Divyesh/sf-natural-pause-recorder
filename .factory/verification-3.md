# Independent verification 3 — FAIL

**Candidate:** `fe24c93af3c02b1dfcb73f754b66f3a09b9472b7`

**Production URL:** <https://natural-pause-recorder.sociobot.in>

**Verified:** 2026-08-28 UTC

**Contract:** `.factory/brief.json`, repository `AGENTS.md`, and the supplied PWA, accessibility, performance, privacy, and paid-unlock requirements

**Method:** clean detached worktree, clean npm install, pinned Playwright 1.58.2 Chromium, deterministic fake microphone audio, fresh browser profiles, direct production responses, and a byte comparison of the candidate build to production. Product source was not changed.

## Verdict

**FAIL. Do not accept candidate `fe24c93`.** A rejected too-short recording can cause a previously valid take's saved edited WAV to be silently replaced with audio from the rejected attempt when the user operates the still-visible pause controls. This corrupts the core WAV output and persists across reload. The production Plus purchase link also returns HTTP 404.

This is not explained by a stale or mismatched deployment: all 15 deployable files from the clean candidate build match production byte-for-byte, including the JavaScript that reproduces the data-integrity failure.

## Defects

| Severity | Finding | Exact evidence |
| --- | --- | --- |
| **P1 — persisted audio corruption** | **A rejected too-short recording leaves the previous take's review active but replaces its PCM working buffer. The next Restore/Compact action silently rebuilds and persists the previous take from the rejected recording's short buffer.** | Real live flow: recorded a valid 2.23 s take, exported its compacted WAV at **163,136 bytes**, immediately started and stopped a second recording, received `That take was too short to save`, then clicked the still-visible prior `Restore 0.7s pause`. The saved/exported WAV became **8,236 bytes** while metadata claimed **2.229 s**; IndexedDB held `rawBlob` **196,652 bytes** but corrupted `editedBlob` **8,236 bytes**. No error was shown. Clean local build reproduction with a deterministic seeded 3.0 s take produced `rawBlob` **288,044 bytes**, `editedBlob` **8,236 bytes**, and claimed `editedDuration: 3`. Cause: `stopRecording()` assigns the rejected attempt to `currentPcm` before its short-take guard, but does not clear `currentTake` or hide/disable the old review; `refreshEditedTake()` then combines old segments with the new short PCM and saves the result. |
| **P2 — paid path unavailable** | **The advertised production checkout cannot start.** | Fresh `GET https://api.sociobot.in/api/v1/products/natural-pause-recorder/checkout` returned **HTTP 404** and `{"error":"enabled factory product","status":404}`. The app visibly advertises “Buy Plus — $12 once.” The verify endpoint is online and returned HTTP 200 with `{ valid:false, reason:"invalid" }` for a fake token, so this is specifically an unregistered/disabled checkout path rather than general API downtime. |

## Clean checkout and repository gates

- Created a new detached worktree at exactly `fe24c93af3c02b1dfcb73f754b66f3a09b9472b7`; initial and final candidate-worktree status were clean.
- `npm ci`: passed; 58 packages installed; npm audit reported **0 vulnerabilities**.
- `npm test`: passed, **9/9** Vitest tests across audio analysis/output and project backup validation.
- `npm run build`: passed. This exact production command ran `tsc --noEmit` and Vite 7.3.6 and produced `dist/`.
- No standalone lint script exists. Strict TypeScript checking is part of the production build.
- `npm run test:e2e`: passed, **8/8** Playwright tests. The suite does not cover starting a rejected short recording while a previous review is active.

## End-to-end product evidence

### Normal and boundary cases

- On the live origin with deterministic fake microphone input, set the documented minimum-silence boundaries **300 ms** and **2,500 ms** and sensitivity boundaries **-52 dB** and **-30 dB**. Labels and persisted local settings matched each boundary.
- Recorded for 2.3 seconds, observed the explicit `Recording` state, stopped into `Shape the quiet`, restored a detected 0.7 s pause, compacted it again, and restored it once more.
- The normal exported WAV was **204,844 bytes** with valid `RIFF....WAVE` header bytes.
- A whitespace-only name normalized to `Untitled take` and persisted after reload.
- Delete cancellation preserved the take; confirmed deletion removed it.
- Project export produced a version-1 `Pausekeeper` envelope with one take and both base64 WAV payloads. Import restored the deleted take.
- A standalone too-short attempt saved no take, showed actionable retry copy, and left Start recording enabled. A malformed JSON import showed the invalid-backup alert and left the empty database unchanged.
- A simulated `NotAllowedError` produced `Needs attention`, browser-permission guidance, and an enabled retry. A simulated browser without `getUserMedia` produced explicit current-browser guidance.
- Free-tier custom preset and batch ZIP actions explained the Plus requirement while preserving individual WAV export. However, the real checkout is broken as reported above.

### Failure reproduction

1. Record and stop a normal take containing a compactable pause.
2. Leave its review timeline open.
3. Start another recording and stop it immediately so it is rejected as too short.
4. Observe that the first take's review timeline remains visible and operable.
5. Activate Restore or Compact on that old timeline, then export it.
6. The edited WAV is rebuilt from the rejected short attempt and persisted without an error; its stored duration metadata remains the old take's duration.

The raw WAV remains in IndexedDB, so expert manual recovery is possible by reopening Review and toggling a pause again. The product provides no warning or automatic repair, and the ordinary exported/saved edited output is corrupted, so this remains release-blocking. A repeat clean-local run exported the corrupted **24,620-byte** edited WAV both before and after reload, directly confirming persistence.

## Accessibility, responsive behavior, and visual review

- Fresh axe WCAG 2 A/AA scans on live `/`, `/privacy`, and `/terms` found **0 serious or critical findings**.
- Each route has an appropriate title, `lang="en"`, exactly one `<h1>`, one `<main>`, and no image missing `alt`. Body text is 16 px.
- Keyboard-only checks passed for skip navigation, recorder focus transfer, native controls, license-dialog initial focus, Escape close, and focus return. No keyboard trap was found.
- Focus contrast measured **11.93:1** on the walnut console and **4.82:1** on paper; the 3 px indicator is visible.
- Reduced-motion emulation produced 0.01 ms animation/transition duration, one iteration, steady lamp transform/opacity, and instant scrolling.
- At **390×844**, page width remained 390 px with no horizontal overflow; core record, brand, and footer targets were at least 44 px high. At **1366×900**, width also matched the viewport.
- Fresh full-page desktop and mobile screenshots were visually reviewed. The recorder, settings, empty state, upgrade section, and footer were coherent with no clipping or identity regression.
- No console errors or uncaught page errors occurred during the desktop, mobile, permission, recording, backup, legal-page, offline, and license-policy checks.

## PWA, offline, update, privacy, and network behavior

- Chromium reported **0 manifest errors** and **0 installability errors**. The manifest has standalone display, a versioned start URL, matching theme/background colors, and 192/512 icons with the 512 icon maskable.
- After one online load under a controlling live `sw.js`, offline reload succeeded for `/` and direct `/privacy` navigation; `navigator.onLine` was false.
- A byte-distinct local v1 → v2 service-worker simulation displayed `A fresh version is ready`, activated through `Update now`, reloaded under the new controller, deleted the v1 cache, retained only v2, and emitted no errors.
- A fresh normal session requested only `https://natural-pause-recorder.sociobot.in`; recording/export added no network audio transfer. There are no analytics, trackers, CDN fonts, third-party scripts, or audio uploads.
- The optional license flow stripped a query token from the URL, made one routed verification request, re-locked a revoked license, kept the buy link visible, and reused the daily cached verdict on reload. Empty restore input produced `Paste a license token first.`

## Deployment identity, response policy, caching, and budgets

- Downloaded every deployable file corresponding to the clean `dist/`. All **15/15** matched by SHA-256/byte comparison: HTML; hashed JS, source map, and CSS; service worker; manifest; offline page; robots and sitemap; two icons; and four hero variants.
- Key hashes: HTML `a4819098…3dd0`, JS `f2ce8e01…e7a9`, CSS `53bf8f23…ca1c`, service worker `e3cd413d…cf4`.
- Live HTML includes the restrictive CSP with `frame-ancestors 'none'`, `Permissions-Policy: microphone=(self), camera=(), geolocation=()`, `X-Frame-Options: DENY`, COOP/CORP, `X-Content-Type-Options: nosniff`, strict referrer policy, and one-year preload HSTS.
- Live hashed JS/CSS return `Cache-Control: public, max-age=31536000, immutable`; HTML remains short-cached for 30 seconds; the manifest is `application/manifest+json`.
- Initial JS: **25.74 KB raw / 9.96 KB gzip** (budget ≤200 KB).
- CSS: **14.88 KB raw / 4.54 KB gzip** (budget ≤50 KB).
- Fonts: **0 network bytes** (budget ≤120 KB).
- Mobile AVIF hero: **51.26 KB** (budget ≤300 KB).
- Lighthouse 12.8.2 mobile against live: **100 Performance / 100 Accessibility / 100 Best Practices / 100 SEO**; FCP **1.3 s**, LCP **1.3 s**, TBT **10 ms**, CLS **0**, total transfer **92 KiB**.
- Lighthouse against the clean local production build: **93 / 100 / 100 / 100**; FCP **1.0 s**, LCP **1.5 s**, TBT **310 ms**, CLS **0**, total transfer **92 KiB**. Lab-only runs do not provide INP.

## Required retest

1. Keep each take's decoded PCM tied to that take, or clear/disable the previous review before any new capture. On a rejected short take, do not replace the current review buffer. Add a regression that records/reviews take A, rejects short take B, toggles A's pause, and proves A's edited WAV length/content still derives from A's raw PCM.
2. Register and enable the production billing product so the published checkout URL redirects to hosted checkout instead of returning 404; then exercise a test purchase, return-token capture, verification, restore, and revocation.
3. Rebuild and redeploy, prove live artifacts match the repaired candidate, and repeat the normal, too-short recovery, offline/update, accessibility, privacy, and response-policy checks.
