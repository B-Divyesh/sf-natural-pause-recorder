# Verify recording speech with protected pauses — verification 6

**Verdict: FAIL — 2 findings; 2 untested public claims.**

**Implementation candidate:** `97780aedb84c6d2aa4885a3fc485efba92b32534` (`fix: open demo at populated review`)  
**Documentation commit reviewed:** `d91a140bdc332d55cbb108905bd54ba84afa00a2` (`docs: hand off repaired pausekeeper`)  
**Live URL:** <https://natural-pause-recorder.sociobot.in>  
**Verified:** 2026-09-06 UTC

`d91a140` changes only `.factory/handoff.md`; this verification exercised implementation `97780ae` and the matching live build.

## What the first screen says

Fresh desktop (1366×900) and phone (390×844) browser contexts opened the live home page at scroll position zero. Both showed:

- Job: **Record speech with protected pauses**.
- Audience: narrators, stream commentators, and language teachers.
- First action: **Try it with sample data**; it says that it opens a populated take to review and export.

Both first screens also show the local-audio, offline-after-first-visit, and free-recording/WAV facts. Neither view had horizontal overflow. Screenshots are in `/work/.evidence/natural-pause-recorder-verify-6/manual/`.

## Findings

| Severity | Finding | Evidence and required repair |
| --- | --- | --- |
| P2 | **The public Plus promise is not fully covered by a tagged claim test.** | The landing page, README, and terms promise that Plus saves custom presets and exports every take as one ZIP. `.factory/claims.json` has only `plus-convenience`: its exact `@claim:plus-convenience` command checks that batch export is gated while free single-WAV export works. It does not exercise a valid Plus license, custom-preset saving, or successful ZIP output. A manual browser check with a mocked valid license did produce `pausekeeper-takes-2026-09-06.zip` with `PK\x03\x04` and “Exported 1 WAV file in one ZIP,” so this is an **untested-claim contract gap**, not evidence that the feature is currently broken. Add separate, one-to-one tagged demo tests (or narrow/remove the public promise) and registry entries. |
| P2 | **The documented Start for real data-discard promise has no tagged claim test.** | README and `.factory/demo.md` say that **Start for real** clears demo records before returning home. The only demo registry test exercises Reset demo and real-data isolation; `rg 'Start for real' tests` finds no test. A manual live check renamed the sample, clicked Start for real, reached `/`, and read `0` demo takes from `demo:pausekeeper`; behavior is correct, but the public promise remains untested under the required claim scheme. Add an exact `@claim:` demo test that asserts the demo namespace is cleared and real data remains untouched. |

Because both are public promises without the required observable tagged claim coverage, this verification cannot declare PASS.

## Checks that passed

### Clean implementation checkout

Detached clean worktree: `/tmp/natural-pause-recorder-verify-6` at `97780ae`, after `npm ci` (60 packages, 0 vulnerabilities).

| Check | Result |
| --- | --- |
| `npm test` | Passed, 9/9 Vitest tests. |
| `npm run build` | Passed. `dist/index.html` produced; JS 30.11 kB raw / 11.25 kB gzip and CSS 17.45 kB raw / 5.03 kB gzip. |
| `CI=1 npm run test:e2e -- --workers=1` | Passed, 28/28 Playwright tests. Normal recording/review/restore/export/persistence, invalid import rollback, rejected short capture recovery, boundaries, keyboard, mobile, legal routes, 404, privacy, and license recovery are covered. |
| `npm run test:claims` | Passed, 15/15 tagged claim tests. |
| Every exact command in `.factory/claims.json` | Passed individually, 15/15. The registry itself is incomplete for the two findings above. |
| `npm run test:pwa:update` | Passed: update toast, activation, reload, and old-cache cleanup. |

### Live page and demo

- `npm run test:live` passed. The live artifact matches the candidate build byte-for-byte; security headers, immutable assets, manifest MIME, checkout redirect, and invalid-license response passed.
- `npm run test:live:browser` passed. Fresh desktop and 390 px mobile checks covered keyboard skip/focus and dialog return focus, axe WCAG 2 A/AA serious/critical scan for `/`, `/demo`, `/privacy`, `/terms`, and the not-found route, reduced motion, installability, same-origin normal use, and offline reload.
- `/opt/fleet/lib/verify-url.sh https://natural-pause-recorder.sociobot.in /work/.evidence/natural-pause-recorder-verify-6/verify-url` passed: HTTPS 200 in 768 ms; correct title/lang/one h1/main/alt text; no console errors.
- A fresh live demo showed its persistent **Demo — sample data, nothing is saved to your real takes** label, the realistic lesson sample, restore control, Reset demo, and Start for real. Restoring reported a full 1.9-second pause. Reset returned the name to `Lesson intro — warm-up directions`; a seeded real-database marker remained `Real take stays separate`.
- The manual Start for real check reached `/` and left zero records in the demo database. This confirms behavior but does not replace the missing tagged claim test.
- Same-origin link crawl found all internal product links returning 200. `/not-a-real-page` renders the designed SPA not-found page and `/404.html` has its own designed not-found document; neither is a broken route.
- The optional product-license API was also checked because verification 4 had a rate-limit finding. An 60-request concurrent invalid-license burst returned 23×200 and 37×429; every 429 carried `Retry-After: 3`. This static PWA has no product backend, tenant service, health endpoint, restart persistence, CLI, library, or desktop artifact.

## Earlier findings

| Earlier finding | Current disposition |
| --- | --- |
| Malformed import could overwrite a saved take | Resolved. The atomic-import tagged claim and full browser suite passed. |
| Asset caching, security headers, manifest MIME, and skip-link focus | Resolved. Live identity/header checks and keyboard browser checks passed. |
| Rejected short capture could damage an active review; checkout route failed | Resolved. Regression and live checkout checks passed. |
| License verification lacked demonstrated 429 handling | Resolved. This verification observed 37 responses with 429 and `Retry-After: 3` in a product-scoped burst. |
| Missing one-click isolated demo, claim registry, plain first screen, site structure, and designed 404 | Resolved in behavior. The demo/manual/live checks and route checks passed. Two narrower claim-registry gaps are recorded above. |
| Verification 5 reported no defects | Superseded only by the two claim-coverage findings above; no functional regression was found. |

## Evidence and limits

Evidence is in `/work/.evidence/natural-pause-recorder-verify-6`, including fresh first-screen desktop/phone screenshots and the URL-check output. Browser recording used the deterministic fake microphone; physical microphone hardware, a real paid purchase, and a refund were not performed. No product code was changed during this verification.

## Required next step

Add two explicit registry entries and demo-based `@claim:` tests: one for valid-Plus custom preset plus ZIP export, and one for Start for real clearing only the demo namespace. Re-run every registry command from a clean checkout and repeat this verification. Until then, the verdict is **FAIL**.
