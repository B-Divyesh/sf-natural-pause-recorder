# Pausekeeper — Record speech with protected pauses

Pausekeeper is for narrators, stream commentators, and language teachers. Record speech in the browser, keep natural pauses, and export WAV audio.

Live site: <https://natural-pause-recorder.sociobot.in>

One-click sample: <https://natural-pause-recorder.sociobot.in/demo>

## Start with the sample

Open `/demo` or choose **Try it with sample data** on the first screen. It opens a lesson-intro take with voice and pause sections already shown. Restore a long pause, export the WAV, or reset the sample.

The demo uses the separate `demo:pausekeeper` IndexedDB database and `demo:` local-storage keys. It never reads or writes real takes. **Start for real** clears the demo records before returning home.

## What it does

- Records microphone audio in the browser.
- Keeps pauses shorter than the selected 0.3–2.5 second minimum.
- Restores a full held pause before WAV export.
- Keeps saved takes after refresh in browser storage.
- Exports free WAV files and portable project backups.
- Rejects an invalid project import without changing saved takes.
- Works offline after the first visit.

Audio stays in this browser during normal recording. Pausekeeper uses loudness to mark quiet sections. It does not create transcripts, identify people, or remove background noise.

## Plus

Pausekeeper Plus is a one-time $12 convenience unlock. It adds custom project presets and batch ZIP export. Recording, individual WAV export, project backup, privacy, and accessibility stay free.

Checkout and refunds are handled by Sociobot/Dodo. A returned license is stored in local storage and checked at most once per day. The app never sends audio to the license service.

## Run locally

Requires Node.js 20 or newer and the Playwright Chromium browser used by the pinned Playwright 1.58.2 package.

```sh
npm ci
npm run dev
```

Open the printed local URL. Microphone capture needs `localhost` or HTTPS.

## Verify

```sh
npm test
npm run build
npm run test:e2e
npm run test:claims
npm run test:pwa:update
```

Every visitor-facing claim is listed in [`.factory/claims.json`](./.factory/claims.json). `npm run test:claims` runs each tagged claim test from `/demo`; each registry entry also gives the exact single-claim command.

After deployment, run:

```sh
npm run test:live
npm run test:live:browser
```

`npm run build` runs strict TypeScript checks and writes the static deployment to `./dist`, with `dist/index.html` at its root. Browser checks use a deterministic microphone file and cover normal recording, recovery, keyboard use, responsive layout, legal routes, PWA updates, accessibility, privacy, and offline reload.

## Privacy and storage

Real recordings and pause decisions are stored in the current browser’s IndexedDB database. Settings and an optional license token use local storage. The free recorder makes no external request. The optional license check sends only its license token to Sociobot.

Read the live [privacy page](https://natural-pause-recorder.sociobot.in/privacy) and [terms](https://natural-pause-recorder.sociobot.in/terms).

## Deploy

Deploy `dist/` as a static site. `public/staticwebapp.config.json` supplies the security headers, immutable asset caching, manifest MIME type, SPA fallback, and designed 404 response. The service worker precaches the shell and the `/demo` route for offline use.

The factory owns DNS, infrastructure, and billing registration. This repository has no deployment or payment credentials.

## License

[MIT](./LICENSE)
