# Independent verification 5 — PASS

**Candidate:** `fa2e72f7228581c2fb0772701f38aab4ab71baf2`  
**Repository / branch:** `B-Divyesh/sf-natural-pause-recorder`, `main`  
**Production URL:** <https://natural-pause-recorder.sociobot.in>  
**Verified:** 2026-08-28 UTC  
**Work order:** `natural-pause-recorder-verify-5`  
**Scope:** Clean-checkout verification against `.factory/brief.json`, the supplied PWA/product contract, and the live deployment. Product source was not modified.

## Verdict

**PASS.** The candidate works end to end for the brief, the live site matches the candidate build byte-for-byte, and all required local, browser, PWA, accessibility, privacy, policy, performance, and rate-limit checks passed. No release-blocking or non-blocking product defects were found.

The deployment-only failure reported by verification 4 is resolved. From a reset rate-limit window, the public product-license verification endpoint allowed five rapid ordered requests and returned the first `429 Too Many Requests` on request **6**, with `Retry-After: 3`. A separate 60-request concurrent burst returned 19 responses with HTTP 200 and 41 with HTTP 429; every 429 carried `Retry-After: 3`.

## Clean checkout and quality gates

- Testing ran from a detached, clean worktree at exactly `fa2e72f7228581c2fb0772701f38aab4ab71baf2`; it remained clean after verification.
- `npm ci`: passed; 58 packages audited, 0 vulnerabilities.
- `npm test`: passed, **9/9** Vitest unit/integration tests.
- No standalone lint script exists. `npm run build` ran the available strict `tsc --noEmit` type check and exact Vite 7.3.6 production build; `dist/index.html` was produced.
- `CI=1 npm run test:e2e -- --workers=1`: passed, **11/11** Playwright 1.58.2 tests in 22.9 seconds. The same suite also passed in an initial independent invocation (11/11).
- `npm run test:pwa:update`: passed.
- `npm run test:live`: passed.
- `npm run test:live:browser`: passed.
- Factory `/opt/fleet/lib/verify-url.sh`: passed; HTTPS 200 in 861 ms, no console/page errors, valid title/lang/main/image/button semantics.

## Product workflow and recovery evidence

- A fresh live Chromium session with the deterministic fake microphone completed record → review → restore a detected pause → export WAV → reload persistence. The downloaded file was a valid RIFF/WAVE payload of 196,652 bytes. The session made only same-origin product requests and emitted no console or page errors.
- The full local flow additionally covered project JSON export, confirmed deletion, import recovery, and the regression where a rejected short capture must not replace the PCM backing the active review. The restored three-second take remained byte-identical and correctly persisted after reload.
- Pause behavior passed representative cases: a 0.4-second natural pause remained whole, a two-second silence compacted to the configured 0.7 seconds, and restoring returned the complete original pause.
- Boundary settings passed at minimum/maximum silence **300/2500 ms** and sensitivity **-52/-30 dB**, including persisted labels/settings.
- Invalid/recovery paths passed: malformed JSON import was rejected without changing saved data; a later-invalid colliding backup could not partially overwrite a take; empty license restore produced actionable copy; free batch export remained gated without blocking individual WAV/project export; a simulated microphone denial produced an actionable permission message and an enabled retry, and the retry recorded successfully; a whitespace-only take name recovered to `Untitled take`.
- The empty state, online/offline badge transition, delete confirmation, and free-tier messaging behaved as described by the brief.

## Accessibility and responsive review

- Live axe WCAG 2 A/AA scans on `/`, `/privacy`, and `/terms` found **0 serious or critical** findings. Each route has `lang=en`, a title, one `h1`, one `main`, and complete image alt text.
- Keyboard-only checks passed: the skip link is first in tab order and moves focus to the recorder; the license dialog receives initial focus, closes with Escape, and returns focus to its trigger. The designed 3 px focus indicator met the 3:1 non-text contrast threshold.
- Reduced-motion mode makes the active lamp effectively instantaneous (`0.01 ms`, one iteration), disables smooth CSS scrolling, and retains state clarity.
- Fresh 1366×900 desktop and 390×844 mobile screenshots were visually reviewed. No clipping or horizontal overflow was present. All visible initial mobile controls were at least 44×44 CSS px (the transparent file input is backed by its 44 px labelled control).
- The product-specific warm enamel/walnut field-recorder treatment, original generated hero, clear recording lamp/state copy, and responsive stacking match `.factory/design.md`.

## Privacy, PWA, and outbound requests

- A fresh normal live load and the live record/export session contacted only `natural-pause-recorder.sociobot.in`. No analytics, trackers, CDN fonts/scripts, or audio uploads were observed. Audio/takes persisted locally in IndexedDB; settings and the optional license state use local storage.
- The only intentional remote integration is the optional Sociobot license/checkout flow. Verification responses used `Cache-Control: no-store` and allowed the exact production origin with CORS.
- The manifest parsed with no errors and Chromium reported no installability errors. It includes standalone display, versioned start URL, themed colors, and 192/512 icons with maskable coverage.
- After one online load, live offline reload passed for `/` and direct `/privacy`, controlled by `/sw.js`.
- The deterministic update test passed the update toast, `SKIP_WAITING` activation, client reload, and deletion of the old cache, leaving only the new cache.

## Deployment identity, headers, caching, and budgets

- `npm run test:live` compared all **15** public production files with the clean candidate build byte-for-byte. SHA-256: HTML `688147eaf06197477a42da36612fee0f16810ab3959bce07b9cdcc98d2db3c5a`; JS `7c305bfe21feaa19fe188b9600e743211c9138d0a92668b6d694c02a10f61673`; CSS `53bf8f233c299304aea1c324db76db19c4837473291d4cd831187c8cd228ca1c`; service worker `620bc55ab813ecda8b768e1f2c8595fb68350eeeb194a28995c7bbe521a54d0f`.
- Live HTML and service worker use `public, must-revalidate, max-age=30`; hashed JS/CSS use `public, max-age=31536000, immutable`. The manifest MIME is `application/manifest+json`.
- Live headers include CSP with `frame-ancestors 'none'`, `Permissions-Policy: microphone=(self), camera=(), geolocation=()`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, strict-origin referrer policy, same-origin COOP/CORP, and one-year HSTS with subdomains/preload.
- Exact build budgets: JS **25,826 B raw / 9,993 B gzip** (≤200 KB); CSS **14,877 B raw / 4,527 B gzip** (≤50 KB); fonts **0 B**; AVIF hero **51,257 B** and 720 px WebP **33,206 B** (≤300 KB).
- Lighthouse 13.4.1 mobile against production: **100 Performance / 100 Accessibility / 100 Best Practices / 100 SEO**; FCP 1.308 s, LCP 1.330 s, TBT 67.5 ms, CLS 0, Speed Index 1.308 s, transfer 94,123 B. Lighthouse exited successfully with no runtime error.
- Checkout returned HTTP 303 to an HTTPS `checkout.dodopayments.com` session. An invalid license returned the documented `{ valid: false, reason: "invalid", expires_at: null }` response.

## Rate-limit evidence

Endpoint: `GET https://api.sociobot.in/api/v1/products/natural-pause-recorder/verify?license=…`

1. Concurrent burst: 60 unique invalid tokens in 549 ms → **19× 200**, **41× 429**, all 429 responses with `Retry-After: 3`.
2. After waiting 4.5 seconds for reset, ordered rapid requests completed in 268 ms → requests 1–5 returned 200; request **6** returned **429** with `Retry-After: 3`.

Observed threshold: **5 accepted requests per reset window; first 429 on request 6**. This satisfies the explicit server-endpoint acceptance requirement.

## Defects and limitations

- **Defects:** none found.
- This is a static PWA, not a library/CLI or product backend; package-consumer, server persistence/concurrency, and health/build-identity checks do not apply. It has no sign-in, so the Entra authority requirement does not apply.
- Browser recording used Playwright's deterministic fake microphone rather than physical hardware. No real paid purchase or refund was created; hosted checkout creation and the client/API license contract were exercised without a charge.
- The brief's 10-minute, 95%-pause-retention success measure is a user-outcome study target, not a deterministic release gate; pause retention and restoration were verified with representative deterministic audio.

## Evidence

Command logs, screenshots, response-policy output, rate-limit traces, and Lighthouse JSON are under `/work/.evidence/pausekeeper-verify-5` in the disposable verifier container.
