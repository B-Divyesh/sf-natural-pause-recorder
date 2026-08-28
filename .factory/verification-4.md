# Independent verification 4 — FAIL

**Candidate:** `fa2e72f7228581c2fb0772701f38aab4ab71baf2`  
**Repository / branch:** `B-Divyesh/sf-natural-pause-recorder`, `main`  
**Production URL:** <https://natural-pause-recorder.sociobot.in>  
**Verified:** 2026-08-28 UTC  
**Scope:** Fresh clean-checkout verification against `.factory/brief.json`, the supplied PWA/product contract, and the deployed site. Product source was not modified.

## Verdict

**FAIL.** The candidate is deployed byte-for-byte, the recorder’s local-first workflow and PWA behavior pass, and the quality/security headers are correctly deployed. However, the required product-unlock API rate-limit check fails: the public license-verification endpoint accepted a rapid burst of invalid-token requests without returning HTTP 429 or a `Retry-After` header. The work order explicitly includes factory product-unlock calls in this requirement, so this is a release blocker despite the otherwise healthy static PWA.

## Release-blocking defect

| Severity | Finding | Fresh evidence | Required resolution |
| --- | --- | --- | --- |
| P1 — abuse/security control absent | `GET https://api.sociobot.in/api/v1/products/natural-pause-recorder/verify?license=…` did not rate limit invalid-token traffic. | First burst: **60 concurrent requests**, all `200`, no `Retry-After`. Immediate second burst: **150 concurrent requests in 1,098 ms**, all `200`, no `Retry-After`. Thus no threshold was observed after **210** rapid requests from this verifier. | Configure a finite per-client/product rate limit on this public verification route which responds with `429 Too Many Requests` and a valid `Retry-After`. Re-test and record the first request number that returns 429. |

This is an API/deployment defect rather than a product-source modification request; no source was changed by this verifier.

## Clean repository and build gates

- Started with a clean worktree at exactly `fa2e72f7228581c2fb0772701f38aab4ab71baf2`.
- `npm ci`: passed; 58 packages installed and npm reported 0 vulnerabilities.
- `npm test`: passed, **9/9** Vitest unit/integration tests.
- No standalone lint script is defined. `npm run build` ran the available strict `tsc --noEmit` check and exact Vite production build successfully, producing `dist/`.
- `CI=1 npx playwright test --workers=1`: passed, **11/11** tests in 26.6 s. This avoids relying on an interrupted parallel run and includes record/review/restore/export/persistence, malformed-import rollback, legal routes, accessibility, mobile, offline, and license-client checks.
- `npm run test:pwa:update`: passed; update toast, `SKIP_WAITING`, controller activation/reload, and old-cache cleanup.
- `npm run test:live`: passed; live artifact identity, headers, cache policy, manifest MIME, checkout redirect, and fake-license verification.
- `npm run test:live:browser`: passed; live desktop/mobile, keyboard, axe, reduced motion, PWA installability, privacy/network, and offline checks.

## Independent product exercise

- **Normal local workflow:** the pinned fake microphone run recorded, opened review, restored a held pause, downloaded a WAV, retained the take across reload, exported project JSON, deleted the take after confirmation, and imported it again. The regression specifically proves a rejected short second capture cannot corrupt the active review’s PCM; the restored three-second take remained byte-identical after reload.
- **Pause intent / boundaries:** unit integration covers a 0.4-second quiet interval remaining whole, a two-second sustained interval compacting to the configured 0.7 seconds, and full non-destructive restoration. A fresh live Chromium check accepted the legal settings endpoints (`min=300`, `max=2500`) with no errors.
- **Invalid/recovery paths:** malformed backup with a valid first colliding take and invalid later take was rejected without replacing the saved take; denied microphone simulation produced `Needs attention`, an actionable permission message, and an enabled Start button for retry. Empty license restore says “Paste a license token first.”
- **Desktop and 390×844 mobile:** fresh live screenshots were visually reviewed. No horizontal overflow was detected; recorder controls, settings, data actions, upgrade controls, and legal footer remain visible. The mid-century recorder visual system matches `.factory/design.md` and uses its documented original asset.

## Accessibility, privacy, PWA, and browser evidence

- Live `/`, `/privacy`, and `/terms` each had one `h1`, one `main`, `lang=en`, title, labelled controls, and image alt text. Axe WCAG 2 A/AA scans found **0 serious/critical** findings.
- Keyboard-only live check passed: visible 3 px designed focus, skip link focused `#recorder`, dialog opened with Close focused, Escape returned focus to its trigger. Reduced-motion mode changed animation duration to `1e-05s` and iterations to `1`.
- Fresh normal live load made only same-origin product requests; no analytics, trackers, CDN fonts/scripts, or audio uploads. The only intentional remote integration is optional Sociobot license verification after a license is supplied. Live API CORS permits the product origin and verification responses are `Cache-Control: no-store`.
- PWA manifest parsed with 0 errors and had 0 DevTools installability errors. After a first online load, offline reload worked for `/` and direct `/privacy`; the page was controlled by `/sw.js`. The deterministic service-worker update suite passed as above.
- No console errors or `pageerror` events occurred in the clean local/lived-browser suites or the independent boundary/error checks.

## Deployment identity, response policy, and performance

- `npm run test:live` compared all **15** public production files to the clean local build byte-for-byte. Key SHA-256 values: `index.html` `688147eaf06197477a42da36612fee0f16810ab3959bce07b9cdcc98d2db3c5a`; JS `7c305bfe21feaa19fe188b9600e743211c9138d0a92668b6d694c02a10f61673`; CSS `53bf8f233c299304aea1c324db76db19c4837473291d4cd831187c8cd228ca1c`.
- Direct live headers confirmed CSP with `frame-ancestors 'none'`, `Permissions-Policy: microphone=(self)`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, COOP/CORP same-origin, one-year HSTS, manifest `application/manifest+json`, and `public, max-age=31536000, immutable` for hashed JS/CSS. HTML remains short-cache as appropriate.
- Exact build sizes: JS **25,826 B raw / 9,994 B gzip** (under 200 KB), CSS **14,877 B raw / 4,539 B gzip** (under 50 KB), no font payload, mobile AVIF **51,257 B** (under 300 KB).
- Lighthouse 13.4 mobile report against production: **99 Performance / 100 Accessibility / 100 Best Practices / 100 SEO**; FCP 1.40 s, LCP 1.43 s, TBT 120.5 ms, CLS 0, transfer 94,198 B. The report was written, then this container’s Chromium crashed during Lighthouse’s final screenshot/BFCache phase (`TARGET_CRASHED`), yielding a non-zero Lighthouse process exit; independent Playwright browser checks had no page/console errors.

## Not applicable / limitations

- This is a static PWA, not a library/CLI or application backend; consumer package, server persistence/concurrency, health, and sign-in-tenant checks do not apply. There is no sign-in.
- Browser recording used the repository’s deterministic fake microphone. Physical microphone hardware and a paid production purchase/refund were not exercised; checkout redirect, client token capture/verification behavior, and invalid-token response were exercised without charging a card.

## Retest criteria

1. Deploy rate limiting for the public Sociobot verification endpoint used by this product.
2. From a clean client/IP, run a rapid burst against the same endpoint and record the first `429` plus its `Retry-After` value.
3. Re-run the listed clean build, PWA, live identity, and live browser suites; then update the deployment evidence.
