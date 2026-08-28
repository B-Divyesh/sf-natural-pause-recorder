# Pausekeeper

Pausekeeper is an offline-capable, local-first speech recorder for solo narrators, game-stream commentators, and language teachers. It records continuously, finds sustained quiet sections, protects a configurable minimum pause, and lets you restore any compacted pause before exporting a standard mono WAV.

Live product: <https://natural-pause-recorder.sociobot.in>

## What it does

- Captures microphone PCM entirely in the browser; no audio upload or account.
- Shows a live level tape and a post-record voice/pause timeline.
- Compacts only silence longer than the selected 0.3–2.5 second minimum.
- Restores individual pauses non-destructively and previews the edited WAV.
- Persists raw and edited takes in IndexedDB across refreshes.
- Exports individual WAVs and a portable JSON project backup for free.
- Validates an entire project backup before one atomic IndexedDB import; ID collisions require explicit replacement confirmation.
- Installs as a PWA and keeps the app shell available offline.
- Offers an optional one-time Plus license for custom presets and batch ZIP export through the Sociobot billing API.

Pausekeeper uses a loudness threshold; it does not transcribe speech, isolate or identify a person, remove noise, or provide clinical voice analysis.

## Develop

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
```

Open the printed local URL. Microphone capture requires `localhost` or HTTPS.

## Verify

```sh
npm test
npm run build
npm run test:e2e
```

`npm run build` is the reproducible deployment command. It writes the static site to `./dist`, with `dist/index.html` at the deploy root. Playwright 1.58.2 is pinned; its Chromium browser must be installed or available through `PLAYWRIGHT_BROWSERS_PATH`.

The browser suite uses a generated deterministic microphone WAV and checks semantic structure, skip navigation, dialog focus, focus contrast, 44 px link targets, 390 px overflow, record/review/restore/export persistence, project round trips, malformed-import rollback, axe WCAG A/AA findings on all routes, and explicit offline navigation.

## Privacy and storage

Audio, names, settings, and pause decisions stay on the current device. Recordings live in IndexedDB; small preferences and an optional license token live in local storage. The only API request is an optional daily Sociobot license verification. See [`/privacy`](https://natural-pause-recorder.sociobot.in/privacy) and [`/terms`](https://natural-pause-recorder.sociobot.in/terms).

## Browser notes

Pausekeeper targets current evergreen browsers with `getUserMedia`, Web Audio, IndexedDB, and service worker support. Keep independent project backups of important material because browsers and operating systems can clear site storage. WAV is mono 16-bit PCM at the capture device’s native sample rate.

## Deployment

Deploy the contents of `dist/` as a static site with SPA navigation falling back to `index.html` for `/privacy` and `/terms`. The factory owns DNS, infrastructure, and release-time billing registration; this repository does not contain product IDs or secrets.

`public/staticwebapp.config.json` carries the Azure Static Web Apps response policy: restrictive microphone-aware CSP and Permissions-Policy, frame/origin isolation, one-year HSTS, the manifest MIME override, and immutable caching for Vite's content-hashed JS/CSS.

## License

MIT. See [LICENSE](./LICENSE).
