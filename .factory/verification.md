# Independent verification — FAIL

**Candidate:** `d47a4fbcd4ca20cd596077fa0fe13a8d24b23a41`  
**Repository / branch:** `B-Divyesh/sf-natural-pause-recorder`, `main`  
**Production URL:** <https://natural-pause-recorder.sociobot.in>  
**Verified:** 2026-08-28 UTC  
**Scope:** independent clean-checkout QA against `.factory/brief.json`, the supplied product contract, and the deployed PWA. Product source was not changed during this verification.

## Verdict

**FAIL.** The core recorder, local persistence, WAV export, PWA shell, and deployed artifact identity all work, but the project-backup import path can silently overwrite an existing local recording before rejecting a malformed backup. The alert then falsely says existing takes were unchanged. This is user-data loss on a product whose promise is local ownership and recovery, so it blocks acceptance.

## Reproducible blocking defect

| Severity | Finding | Fresh evidence |
| --- | --- | --- |
| P1 — data loss | **Malformed JSON import is not atomic.** `import-data` saves each item as it iterates. If a valid-looking first item has the ID of an existing take and a later item is invalid, the earlier `put()` has already overwritten the saved take. The catch displays “Your existing takes were not changed.” | In Chromium, I first made a normal saved take. I imported a syntactically valid Pausekeeper backup whose first take had that saved take's ID and replacement WAV data, and whose second take lacked `rawWav`. The UI showed the stated invalid-file alert; before/after card count remained `1`; IndexedDB then reported the saved record name as `overwritten by malformed import`. The original audio was gone. |

Required fix: fully parse and validate every imported item before any write, then commit the full replacement/import in one IndexedDB transaction (or stage it and provide an explicit conflict policy). Do not claim no existing data changed unless that is true.

## Additional defects / release risks

| Severity | Finding | Evidence |
| --- | --- | --- |
| P2 — deployment performance | Hashed JS and CSS are served with `Cache-Control: public, must-revalidate, max-age=30`, not immutable long-lived caching. | Production `HEAD` responses for `/assets/index-qWTbj69E.js` and `/assets/index-BpVa3mVT.css` on 2026-08-28. This misses the supplied PWA caching policy even though the service worker mitigates repeat use. |
| P2 — deployment response policy | Production HTML and assets have HSTS, Referrer-Policy and `X-Content-Type-Options`, but no Content-Security-Policy, `Permissions-Policy`, clickjacking protection, or origin-isolation policy. | Direct production response-header capture. For a microphone/local-audio application, deploy a restrictive CSP and at least `Permissions-Policy: microphone=(self)`; configure frame protection. HSTS's `max-age=10886400` is also below the one-year preload requirement despite including `preload`. |
| P3 — keyboard skip behavior | The visible “Skip to recorder” link targets `#main`, but `<main>` is not focusable and is at the start of the hero rather than the recorder. Focus lands on `BODY`; the next Tab reaches the hero CTA, not the recorder. | Keyboard-only Chromium check: activate the skip link, inspect `document.activeElement` (`BODY`), then Tab (`Open the recorder`). Add a focus target (`tabindex="-1"`) and point the link at the intended recorder/main destination. |
| P3 — response MIME | `/manifest.webmanifest` is delivered as `application/octet-stream`, not a manifest JSON type. Chromium still registered the PWA in this run. | Production `HEAD /manifest.webmanifest`. Set `application/manifest+json` (or `application/json`) at the static host. |

## What passed

### Clean checkout and repository gates

- Initial checkout was clean and at exactly `d47a4fbcd4ca20cd596077fa0fe13a8d24b23a41`; `origin/main` resolves to the same commit.
- `npm ci`: completed, npm audit reported **0 vulnerabilities**.
- `npm test`: **6/6** Vitest unit tests passed.
- No standalone lint script is defined. `npm run build` runs the available TypeScript check (`tsc --noEmit`) and the exact production Vite build; it passed and produced `dist/`.
- `npm run test:e2e`: **5/5** Playwright 1.58.2 tests passed, covering recording with a fake microphone, pause restore, WAV download, refresh persistence, 390 px overflow, offline app/privacy navigation, and axe integration.

### Independent product exercise

- Normal local flow: set protected silence at both legal boundaries (300 and 2500 ms), start a fake-device microphone capture, observe `Recording` and enabled Stop, stop after 1.35 s, receive the review timeline, save the take locally, restore a pause, export a WAV, and reload to confirm IndexedDB persistence. The repository e2e run additionally verified the restored-pause control and WAV download.
- Permission recovery: replaced `getUserMedia` with `NotAllowedError`; UI gave the actionable blocked-permission message, changed state to `Needs attention`, and left Start recording enabled for retry.
- Invalid format recovery works for a wholly invalid file: it reports the invalid-project alert and leaves data alone. The mixed-validity case above is the failing recovery path.
- The 390×844 viewport had no horizontal overflow (`390/390`), core actions remained visible, and reduced-motion CSS reduced animation duration to `0.01ms` / one iteration. Desktop and mobile screenshots were visually reviewed; the product-specific recorder layout remained legible.
- Keyboard focus rings are visibly styled with a 3 px outline. Dialog uses native modal focus behavior. The skip-link limitation is recorded above.
- Axe WCAG 2 A/AA scans found **0 serious or critical** findings, both in the repository suite and in a fresh live-site scan.
- Fresh local and live runs produced no console errors or `pageerror` events.

### PWA checks

- After a first online load, `context.setOffline(true)` followed by reload worked for both `/` and `/privacy`; the controller was `/sw.js`.
- Service-worker update behavior was exercised without changing repository/product code: a temporary copy of the built candidate was first loaded with its original worker, then given byte-distinct v4/v5 test workers. The app displayed “A fresh version is ready”; clicking **Update now** activated the new controller and reloaded with the toast hidden. This validates the candidate's update-detection and `SKIP_WAITING` path.
- Manifest has standalone display, named 192/512 icons (512 maskable), versioned start URL, theme/background colors, and the product shell/offline page precached by the worker.

### Privacy, network, live identity, and size

- Fresh live load requested only the same-origin document, JS, CSS, and AVIF hero. There were no analytics, trackers, CDNs, audio uploads, or third-party requests. Source scan found the only runtime external request is optional Sociobot license verification after a stored/pasted license; the first-load free experience did not make it.
- All 12 deployed candidate files checked match the locally built candidate byte-for-byte by SHA-256: HTML, JS, CSS, service worker, manifest, offline page, both icons, and all four hero variants. The live page loads one `h1`, `main`, `lang=en`, title, image alt text, and the matching `index-qWTbj69E.js` / `index-BpVa3mVT.css` assets.
- Build budgets pass: initial JS **22.33 KB** raw / **9.01 KB gzip** (under 200 KB); CSS **14.62 KB** raw / **4.47 KB gzip** (under 50 KB); no font payload; mobile AVIF hero **51.3 KB** (under 300 KB).
- Lighthouse 12.6 against local `dist` generated: Performance **99**, Accessibility **100**, Best Practices **100**, SEO **100**; FCP **1.0 s**, LCP **1.4 s**, TBT **120 ms**, CLS **0**, transfer **91 KiB**. Chrome emitted a `TARGET_CRASHED` during Lighthouse's final post-audit screenshot/BFCache collection after the JSON report was written, so these are useful measurements rather than a clean Lighthouse process exit.

## Commands / environment

```sh
npm ci
npm test
npm run build
npm run test:e2e
npm run preview -- --port 4174
```

Browser QA used pinned Playwright 1.58.2 Chromium and the installed fake media device. The live check was made against the HTTPS URL above. Physical microphone hardware and a real paid-license purchase were not available in this disposable verification environment; neither was needed to reproduce the blocking local-import defect.

## Retest criteria

1. Add regression tests for an invalid item after a valid item, including a colliding take ID, and demonstrate no IndexedDB writes occur on a rejected import.
2. Re-run the complete command set and fake-microphone record → review → restore → WAV export → reload flow.
3. Deploy the corrected build, prove live hashes match it, and recheck immutable cache and security response headers.
