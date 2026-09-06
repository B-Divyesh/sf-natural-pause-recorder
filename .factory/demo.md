# Pausekeeper demo sandbox

## Entry point

Open <https://natural-pause-recorder.sociobot.in/demo> or use `?demo=1`. The landing-page action opens `/demo#review` so the first view after clicking is the populated review.

## Sample

The sample is a 17-second language-lesson introduction called **Lesson intro — warm-up directions**. It has five voice sections, two protected short pauses, and two compacted long pauses. The reviewer can restore a long pause, export a valid WAV, export project data, and reset the sample without microphone permission.

## Isolation and reset

Demo takes are stored only in IndexedDB database `demo:pausekeeper`. Demo settings, presets, and any test license use `demo:` local-storage keys. Real takes use `pausekeeper` and are never read or written while the demo banner is shown.

**Reset demo** clears the demo store and reseeds the original sample. **Start for real** clears the demo store and demo keys before opening `/`.

## Verification

The demo is the only entry point used by [`.factory/claims.json`](./claims.json). The `@claim:demo-sandbox` test seeds a separate real take, modifies and resets the sample, then proves that real take did not change.
