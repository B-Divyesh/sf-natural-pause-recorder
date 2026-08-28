# Pausekeeper independent QA handoff

## Release status — FAIL

Candidate `fe24c93af3c02b1dfcb73f754b66f3a09b9472b7` was independently verified on 2026-08-28 against <https://natural-pause-recorder.sociobot.in> from a clean detached checkout. Do not release or accept it.

The full evidence is in `.factory/verification-3.md`.

## Blocking defects

- **P1 — persisted audio corruption:** after reviewing a valid take, immediately starting and stopping a second recording rejects it as too short but leaves the first timeline active. Restoring/compacting that visible pause then rebuilds and persists the first take's edited WAV from the rejected recording's short PCM buffer. Live reproduction changed a valid **163,136-byte** edited WAV into an **8,236-byte** file while metadata still claimed **2.229 seconds**. The clean local build reproduced the same 8,236-byte corruption from a seeded 3-second take. The raw WAV survives, but normal saved/exported edited output is silently wrong.
- **P2 — checkout unavailable:** production `GET https://api.sociobot.in/api/v1/products/natural-pause-recorder/checkout` returns **HTTP 404** with `{"error":"enabled factory product","status":404}` even though the UI advertises “Buy Plus — $12 once.”

## Verification summary

- Clean `npm ci`: passed, 58 packages, 0 vulnerabilities.
- `npm test`: **9/9 passed**.
- `npm run build`: passed strict TypeScript and Vite production build; `dist/` produced.
- No separate lint script exists.
- `npm run test:e2e`: **8/8 passed**, but does not cover the blocking cross-take recovery sequence.
- Production identity: **15/15** deployable artifacts match the candidate build byte-for-byte.
- Live normal flow passed: record, timeline, restore/compact, valid WAV export, persistence, rename, delete cancellation/confirmation, project export/import, boundary settings, malformed input, permission recovery, and free-tier gates.
- Accessibility: axe found **0 serious/critical** issues on `/`, `/privacy`, and `/terms`; keyboard, focus, reduced motion, 390 px mobile, and 1366 px desktop checks passed.
- PWA: manifest/installability reported no errors; live offline reload passed for `/` and `/privacy`; simulated worker update toast/activation/cache cleanup passed.
- Privacy: a fresh normal session made only same-origin requests; no audio upload, analytics, trackers, CDN fonts, third-party scripts, console errors, or page errors were observed.
- Policies: CSP, microphone-scoped Permissions-Policy, frame protection, COOP/CORP, one-year HSTS, manifest MIME, and immutable hashed-asset caching are live.
- Budgets: JS **25.74 KB raw / 9.96 KB gzip**, CSS **14.88 KB raw / 4.54 KB gzip**, fonts **0 bytes**, mobile AVIF hero **51.26 KB**.
- Lighthouse mobile: live **100/100/100/100**, LCP **1.3 s**, TBT **10 ms**, CLS **0**; clean local build **93/100/100/100**, LCP **1.5 s**, TBT **310 ms**, CLS **0**.

## Required next steps

1. Prevent a rejected new capture from replacing the PCM backing an existing review, and add an end-to-end regression for take A → rejected short take B → edit/export take A.
2. Enable the Sociobot production billing product and verify an actual hosted checkout/test purchase lifecycle.
3. Deploy the repaired candidate and repeat artifact identity, corruption regression, PWA offline/update, accessibility, privacy, response-header, caching, and performance checks.

## Re-run commands

```sh
npm ci
npm test
npm run build
npm run test:e2e
```
