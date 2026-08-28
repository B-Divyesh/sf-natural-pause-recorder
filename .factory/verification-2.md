# Independent verification 2 — FAIL

**Candidate:** `d47a4fbcd4ca20cd596077fa0fe13a8d24b23a41`

**Production URL:** <https://natural-pause-recorder.sociobot.in>

**Verified:** 2026-08-28 UTC

**Contract:** `.factory/brief.json`, repository `AGENTS.md`, and the supplied PWA, accessibility, performance, privacy, and paid-unlock requirements

**Method:** clean detached worktree, fresh browser profiles, pinned Playwright 1.58.2 Chromium, and direct production responses. Product source was not changed.

## Verdict

**FAIL. Do not release candidate `d47a4fb`.** A malformed project backup can overwrite an existing local recording before the import is rejected, after which the product explicitly and falsely says that existing takes were unchanged. This is reproducible on both the clean local production build and the live origin. Because recordings are the product's primary user data and project backup/import is the ownership and recovery path, this P1 data-loss defect blocks acceptance.

The earlier failure is not deployment-only. Every one of the 15 files emitted by the clean candidate build matches the corresponding live file byte-for-byte.

## Defects

| Severity | Finding | Exact evidence |
| --- | --- | --- |
| **P1 — user-data loss** | **Rejected imports are not atomic and can overwrite an existing recording.** The importer validates and writes one take at a time with separate IndexedDB `put()` calls. A valid first entry with a colliding ID is committed before a later invalid entry throws. The catch then claims, “Your existing takes were not changed.” | Local and live reproduction: seed take ID `qa-existing` / `live-collision`; import a version-1 Pausekeeper JSON whose first item has the same ID and replacement WAV fields and whose second item lacks `rawWav`; accept the invalid-file alert; read the original key directly from IndexedDB. Local name changed from `Original irreplaceable take` to `OVERWRITTEN BY REJECTED IMPORT`; live name changed from `Live original` to `LIVE OVERWRITE`. The alert claimed no changes in both cases. |
| **P2 — release-gate reliability** | **The exact e2e suite fails in a clean checkout.** Its recording test assumes Chromium's synthetic microphone will always contain a pause longer than 300 ms, but the fixture is not deterministic under the configured parallel run. | `npm run test:e2e` was run twice from the clean candidate worktree; both runs ended **4 passed, 1 failed** after 30 seconds at `getByRole('button', { name: /Restore .* pause/ })`. The failed page had three disabled held pauses (0.2 s, 0.0 s, 0.1 s). The same test passed unchanged when isolated, and a separate live run found a 0.4 s restorable pause, confirming a nondeterministic gate rather than a consistent recorder failure. Use a fixed fake-audio file or deterministic imported fixture. |
| **P2 — keyboard focus contrast** | **The global focus ring does not meet the required 3:1 non-text contrast on the recorder bay.** | `:focus-visible` is `#176f8a`; the recorder background is `#30352f`. Calculated WCAG relative-luminance contrast is **2.19:1**. The ring is offset outside Start/Stop controls onto that background. It passes on cream (5.44:1) and paper (4.82:1), but keyboard focus needs a compliant treatment on every surface. |
| **P2 — production response policy** | **The microphone application lacks a CSP, Permissions-Policy, and clickjacking protection.** | Fresh `HEAD /` contained HSTS, Referrer-Policy, `X-Content-Type-Options`, legacy `X-XSS-Protection`, and DNS-prefetch control, but no `Content-Security-Policy`, `Permissions-Policy`, `X-Frame-Options`, or CSP `frame-ancestors`. HSTS is only `max-age=10886400` (126 days) despite a `preload` token; preload eligibility requires at least one year. Configure at the deployment layer, including `Permissions-Policy: microphone=(self)`. |
| **P2 — production caching** | **Content-hashed JS/CSS are not served with long-lived immutable caching.** | `/assets/index-qWTbj69E.js` and `/assets/index-BpVa3mVT.css` both returned `Cache-Control: public, must-revalidate, max-age=30`. The service worker helps repeat use, but this misses the supplied immutable-asset policy and wastes the value of content hashes. |
| **P3 — skip navigation** | **“Skip to recorder” neither transfers focus nor skips to the recorder.** | Keyboard check: Tab focused the link with a visible 3 px ring; Enter set `#main`, left `document.activeElement` on `BODY`, and left scroll at 0; the next Tab focused the hero's “Open the recorder” link. The target is the non-focusable start of `<main>`, not `#recorder`. |
| **P3 — touch targets** | **Several links are smaller than the required 44×44 CSS px target.** | At 390 px, the home brand measured 147×31 px and footer Privacy/Terms/Source links measured 58×25, 47×25, and 55×25 px. At desktop, header Recorder/Takes/Plus links were 82×25, 50×25, and 38×25 px. Core recorder buttons do meet the target. |
| **P3 — manifest MIME** | **The web manifest is served as a generic binary.** | `HEAD /manifest.webmanifest` returned `Content-Type: application/octet-stream`; use `application/manifest+json` (or `application/json`). Chromium nevertheless reported zero manifest or installability errors in this run. |

## Clean checkout and repository gates

- Created a fresh detached worktree at exactly `d47a4fbcd4ca20cd596077fa0fe13a8d24b23a41`; initial status was clean.
- `npm ci`: passed; 58 packages installed; npm audit reported **0 vulnerabilities**.
- `npm test`: passed, **6/6** Vitest unit tests.
- `npm run build`: passed. This is the repository's exact production command and includes `tsc --noEmit`; `dist/` was produced.
- No standalone lint script exists. Type checking is part of the production build.
- `npm run test:e2e`: failed **twice** at **4/5** as described above. The failing test passed when run alone.

## End-to-end product evidence

### Normal recording and ownership paths

- On the live origin with a permitted fake microphone: set protected silence to 300 ms and sensitivity to -30 dB, started capture, observed explicit `Recording` state, recorded for 2.2 seconds, stopped, and received a saved review.
- The first live attempt found one restorable pause. Clicking it reported `Restored the full 0.4 second pause.`
- Live WAV export downloaded `take-aug-28-539-am.wav`, **204,844 bytes**, with `RIFF....WAVE` header bytes.
- A whitespace-only take name normalized to `Untitled take`; it persisted after reload.
- Delete cancellation preserved the take; a subsequent confirmed delete removed it.
- Project backup round trip passed on the production build: one recorded take exported to a 285,777-byte version-1 Pausekeeper JSON with `data:audio/wav;base64,` fields; a new browser profile imported it without an alert and exported a valid 106,540-byte RIFF/WAVE.
- Settings accepted and persisted all documented boundaries: minimum silence **300–2500 ms** and sensitivity **-52 to -30 dB**; output labels and local storage reflected the values.

### Invalid input and recovery

- A simulated `NotAllowedError` produced `Needs attention` plus actionable browser-permission guidance; Start recording remained enabled for retry.
- Stopping after about 80 ms produced `That take was too short to save. Record for at least one second.` and saved no card.
- A fully valid backup imports correctly. The mixed-validity/colliding-ID backup takes the destructive P1 path above and does not recover honestly.
- An empty license restore reports `Paste a license token first.`
- A routed revoked-license response stored the verdict, re-locked Plus, kept the purchase link visible, stripped `license=qa-token-123` from the browser URL, and made one GET to the required Sociobot endpoint. Reload reused the daily verdict and made no second call.

## Accessibility, keyboard, responsive, and visual checks

- Fresh Playwright axe WCAG 2 A/AA scans of the live home, `/privacy`, and `/terms` pages found **0 serious or critical** violations. Lighthouse accessibility scored **100**.
- Home and legal routes each have `lang=en`, an appropriate title, exactly one `<h1>`, and one `<main>`; all images have alt attributes. No heading/landmark console failures were observed.
- Native license dialog initially focuses its close button, closes with Escape, and returns focus to the opener. No keyboard trap was found.
- Focus is visibly drawn as a 3 px outline, with the dark-surface contrast defect documented above.
- At **390×844**, document width was exactly 390 px (no horizontal overflow), controls stacked coherently, recorder actions remained visible, and the desktop/mobile screenshots were visually reviewed. The original recorder artwork and product-specific instrument-panel system render cleanly at both widths.
- Reduced-motion emulation matched the media query: animation/transition durations became `0.01ms`, iteration count became 1, the active lamp stayed at identity transform/full opacity, and document scrolling became `auto`.

## PWA, offline, update, and privacy checks

- Live Chromium reported the manifest URL, **zero manifest errors**, and **zero installability errors**. The manifest defines standalone display, versioned start URL, theme/background colors, and 192/512 icons with the 512 icon maskable.
- After one live online load, the page was controlled by `https://natural-pause-recorder.sociobot.in/sw.js`. With the context forced offline, both `/` and a direct `/privacy` navigation reloaded successfully with `navigator.onLine === false`.
- Service-worker update behavior was exercised without modifying product source: a temporary server served the candidate `dist/` and changed only the worker cache version from QA v1 to QA v2. `registration.update()` displayed `A fresh version is ready`; **Update now** activated v2, removed the v1 cache, reloaded, and hid the toast. No console/page errors occurred.
- A fresh uncontrolled live load requested only the document, the same-origin hashed JS/CSS, and the same-origin AVIF hero. During live recording/export, additional requests were only same-origin `blob:` URLs. There were **no analytics, trackers, CDNs, audio uploads, or third-party requests**.
- The only observed optional external call was the contract-required Sociobot license-verification GET after explicitly supplying a token. It carried no audio or request body.
- Fresh local and live checks emitted **no console errors** and **no uncaught page errors**.

## Deployment identity, headers, caching, and budgets

- Rebuilt the candidate and downloaded every corresponding production artifact. All **15/15** matched by SHA-256/byte comparison: HTML, JS, JS source map, CSS, service worker, manifest, offline page, robots, sitemap, two icons, and four hero formats.
- Key build hashes: JS `ac108746…a23c`, CSS `f48b27f6…0aef`, HTML `6fb8cf1d…6884`, service worker `6e6f5497…02c8`.
- Initial JS: **22.33 KB raw / 9.01 KB gzip** (budget ≤200 KB).
- CSS: **14.62 KB raw / 4.47 KB gzip** (budget ≤50 KB).
- Fonts: **0 bytes** network payload (budget ≤120 KB).
- Mobile AVIF hero: **51.26 KB** (budget ≤300 KB).
- Lighthouse 12.8.2 mobile against the clean `dist/`: **Performance 96, Accessibility 100, Best Practices 100, SEO 100**; FCP **1.0 s**, LCP **1.4 s**, TBT **220 ms**, CLS **0**, total transfer **91 KiB**. INP is not available from this lab-only page load.
- Production HTML is short-cached for 30 seconds; hashed-asset and security-policy defects are listed above.

## Required retest

1. Parse and validate every import entry before any mutation, then write the complete import in one IndexedDB transaction (with an explicit collision policy). Add a regression proving a later invalid item cannot change an earlier colliding take.
2. Replace the synthetic microphone assumption with a deterministic audio fixture and require the full `npm run test:e2e` command to pass reliably.
3. Correct dark-surface focus contrast and skip-link destination/focus behavior.
4. Deploy the fix, prove all live artifact hashes match the new candidate, and recheck offline/update behavior plus cache/security headers.
