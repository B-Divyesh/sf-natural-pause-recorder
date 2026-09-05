# Pausekeeper review 1 — Record speech while keeping natural pauses

**Verdict: FAIL — 5 findings; 14 untested public-claim categories.**

**Reviewed:** 2026-09-05 UTC  
**Live URL:** <https://natural-pause-recorder.sociobot.in>  
**Implementation candidate:** `fa2e72f7228581c2fb0772701f38aab4ab71baf2` (`test: lock release and live verification gates`)  
**Documentation SHA:** `99c8d844d2903dc38e7db099eed1564e0b5a8905` (`docs: record verification 5 pass`)

`99c8d84` only changes `.factory` handoff/verification documents after the implementation candidate. The live byte-for-byte verification therefore reviewed `fa2e72f`.

## What a visitor sees first

Fresh 1366×900 desktop and iPhone 13 sessions opened at scroll position zero before interaction. The apparent job is recording speech while shortening long quiet stretches. The audience is not named on the first screen; the researched audience is solo narrators, game-stream commentators, and language teachers. The available first action is **Open the recorder**, which scrolls to a microphone-permission-dependent recorder.

The required sample action is absent. There is no **Try it with sample data** action, no first-screen sample result, and no real-data-safe demo alternative.

## Findings

| Severity | Finding | Evidence and required outcome |
| --- | --- | --- |
| **P1** | **The required one-click demo sandbox does not exist.** | Fresh desktop and phone sessions found no `Try it with sample data` control. Both `/demo` and `/?demo=1` return the ordinary empty landing page: no realistic populated take/timeline, `Demo — sample data, nothing is saved` banner, Reset demo, Start for real, or demo storage namespace. This prevents evaluating the product without a microphone and does not prove that sample activity cannot touch real data. Implement the documented isolated demo, including a visible first-screen entry and `.factory/demo.md`. |
| **P1** | **The claims contract is missing, leaving public claims untested under the required scheme.** | `.factory/claims.json` is absent and `rg '@claim:'` found no tagged tests. Therefore there are no declared claim commands to run from a clean checkout. At least **14 public-claim categories** are unlisted and lack their required one-to-one sandbox test: local/no-account privacy; continuous capture; long-silence-only compaction; 0.3–2.5 s setting range; pause restoration; waveform/timeline; saved-take persistence; WAV export; JSON project backup; atomic import/collision handling; install/offline shell; Plus price/features; daily license verification; and no transcription/identification/noise-removal claim. Existing ordinary tests are valuable but do not satisfy the required claim registry and `@claim:<id>` test contract. Add the registry, exact commands, and observable demo-based tests for every retained public claim. |
| **P2** | **The first screen does not state the job, audience, and required sample action in plain words.** | The h1 is “Keep the pauses that sound human.” This is a slogan rather than the user’s job. Its following sentence does not identify narrators, stream commentators, or language teachers. The title repeats the slogan (“Pausekeeper — Keep the pauses that sound human”) instead of naming what the product does. The screen has no three short privacy/offline/price facts and uses decorative phrases such as “Continuous capture. Deliberate edits.” Rewrite the first screen and route title to meet the plain-words contract. |
| **P2** | **Unknown URLs do not show a designed 404 page.** | Fresh navigation to `/not-a-real-page` returned HTTP 200 and the normal home title/h1, with no not-found message or way back. The static configuration sends all navigation requests to `index.html`, but the SPA has no 404 route. Add the specified styled 404 response/route, title, h1, and home action. An intentional HTTP 404 is acceptable; this misleading successful landing page is not. |
| **P2** | **Required site structure and supporting audit documents are incomplete.** | The consistent header has Recorder/Takes/Plus but no Demo. The landing page has no “How it works” three-step section and no dedicated plain-language “What it does not do / privacy” section. The footer lacks “Built by Param Factory” and a version/build id. `.factory/demo.md` and `.factory/copy-audit.md` are absent. Add the missing standard-skeleton elements and required documentation. |

## Current disposition of earlier findings

All previously reported product and deployment defects are currently resolved:

| Earlier review | Prior issue | Current evidence |
| --- | --- | --- |
| Initial / verification 2 | Non-atomic malformed import; flaky e2e pause; focus contrast; security/caching/manifest; skip focus; small links | `npm run test:e2e` passed 11/11, including invalid-import rollback and rejected-capture isolation. Live/browser and live-policy suites passed. Keyboard, axe, mobile targets, offline, response headers, immutable assets, and manifest checks passed. |
| Verification 3 | Rejected short capture could corrupt an active reviewed take; checkout returned 404 | The regression is included in the 11/11 e2e pass. `npm run test:live` confirmed the checkout redirect and invalid-license response. |
| Verification 4 | License verification had no observed rate limit | After a 4.5-second quiet period seven sequential invalid requests returned 200, but a subsequent 60-request concurrent burst returned **24×200 and 36×429**, each 429 with `Retry-After: 4`. The required 429/Retry-After behavior is present. |
| Verification 5 | No defects recorded | Its implementation/policy/PWA/accessibility evidence was reproduced below. This review adds contract checks that its report did not cover: the required demo, claim registry, first-screen wording, 404, and skeleton/document requirements. |

## Commands and live evidence

This review began on a clean checkout at documentation SHA `99c8d84`; no product source was changed.

| Command/check | Result |
| --- | --- |
| `npm ci` | Passed; 58 packages installed, 0 vulnerabilities. |
| `npm test` | Passed, 9/9 Vitest tests. |
| `npm run build` | Passed; strict TypeScript and Vite build produced `dist/`. |
| `npm run test:e2e` | Passed, 11/11. Covers normal record/review/restore/WAV/persistence, invalid import, rejected short capture, boundary/mobile, keyboard, privacy/client license, offline, and axe integration. |
| `npm run test:pwa:update` | Passed: update toast, activation, reload, and old-cache cleanup. |
| `npm run test:live` | Passed: all 15 live deployable files match the candidate build byte-for-byte; headers, immutable assets, manifest MIME, checkout redirect, and invalid-license response pass. |
| `npm run test:live:browser` | Passed: live desktop/390px mobile, keyboard, axe serious/critical scan, reduced motion, PWA installability, same-origin normal flow, and offline reload. |
| `/opt/fleet/lib/verify-url.sh https://natural-pause-recorder.sociobot.in /work/.evidence/natural-pause-recorder-review-1` | Passed: HTTP 200, title/lang/h1/main/alt checks, desktop/mobile screenshots, no console errors. |
| `npx @axe-core/cli …` | Could not start Selenium Chrome in this container. The repository’s pinned Playwright `@axe-core/playwright` integration did run in the e2e and live-browser suites and passed with no serious or critical findings on `/`, `/privacy`, and `/terms`. |
| Claims command inventory | **Failed contract check:** no `.factory/claims.json`, no declared claim commands, and no `@claim:` tests. |

Live product checks also confirmed normal recording/review/export/persistence via the deterministic microphone suite; invalid import and rejected-capture recovery; 300/2500 ms and −52/−30 dB boundary coverage; keyboard focus/dialog handling; reduced motion; legal pages; local-first normal request behavior; service-worker offline reload/update; existing route links; and the optional billing rate response. This static PWA has no product server, tenants, health endpoint, CLI/library artifact, or backend restart persistence to test. Physical microphone hardware and a paid purchase/refund were not performed.

Evidence is stored in `/work/.evidence/natural-pause-recorder-review-1`, including fresh first-screen desktop and phone screenshots, the URL verification report, headers, and axe invocation output. The direct Playwright check showed that `/demo`, `/?demo=1`, and `/not-a-real-page` all return the ordinary landing experience.

## Retest requirements

1. Build the isolated, realistic one-click sample flow and document its storage namespace/reset behavior.
2. Add every public claim to `.factory/claims.json` with one exact `@claim:` sandbox test; remove any promise that cannot be proved.
3. Rewrite the first screen/title in plain words, add the required standard landing sections/footer metadata, and ship a designed 404 route.
4. Re-run all declared commands plus every claim command from a clean checkout, then re-audit live desktop, phone, demo, and 404 routes.
