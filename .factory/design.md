# Pausekeeper visual thesis

## Direction: the humane instrument panel

Pausekeeper looks like a compact mid-century field recorder: purposeful controls, warm enamel, inked calibration marks, and one unmistakable recording lamp. The reference is the reassuring legibility of 1950s laboratory and broadcast instruments—not nostalgia as decoration. A narrator should read “ready / recording / held pause” in a glance while their attention stays on speaking.

The product is intentionally single-mode. The painted oatmeal chassis and dark walnut console are part of its equipment metaphor; a conventional dark theme would weaken state recognition. All surfaces are explicitly painted, with high-contrast controls and a darker recording bay.

## Tokens and palette

- `paper #F4EBD7`: warm enamel page background.
- `panel #FFF9EA`: raised control surface.
- `ink #242820`: primary text and outlines (13.1:1 on paper).
- `muted #5C6258`: secondary copy (5.5:1 on paper).
- `walnut #30352F`: recorder bay and footer.
- `cream #FFF9EA`: text on walnut (11.9:1).
- `signal #C83F2D`: record lamp and destructive emphasis; paired with labels, never used alone.
- `signal-dark #8F281C`: button depth and accessible signal text.
- `mint #2C7058`: voice/success state.
- `ochre #A66A17`: held-pause/warning state.
- `danger #A72E2A`: errors.

## Typography

Headings use **Fraunces** if a local subset is introduced later, with Georgia as the shipped no-request fallback. Controls and body use **Atkinson Hyperlegible**, if self-hosted later, falling back to the system UI stack. V1 deliberately makes no font network requests. The contrast between humanist serif titles and crisp, tabular instrument labels supports storytelling and precise timing. Type steps: 12, 14, 16, 20, 30, and clamp(40–64) px. Body remains at least 16 px.

## Geometry, spacing, and depth

An 8 px rhythm drives gaps (8/16/24/32/48/64), with 4 px only inside dense meter ticks. Corners are modest (4–16 px), never pill-shaped except for status indicators. Panels use a hard 3 px ink edge plus a 4 px offset shadow, like a portable instrument case. Groups are defined by proximity first; outlined panels are reserved for actual modules: recorder, session, and saved takes.

The mobile version stacks the recorder before settings, condenses supporting copy, turns take actions into two columns, and respects safe-area insets. Targets are at least 44 px.

## Interaction grammar

- The red lamp and explicit text are the canonical recording state.
- The live needle responds to input level; a segmented paper-tape timeline shows voice in green and silence as amber hatching.
- Physical button movement is a 2 px translate with shadow reduction.
- Post-record pauses are individual tape segments. “Restore” unrolls their full duration; “Compact” returns them to the protected minimum.
- Feedback is written into polite or assertive live regions, so sound and color are never required.

## Motion policy

State transitions last 180–240 ms and animate only opacity/transform. The recording lamp breathes slowly while actively recording; the meter needle tracks actual audio input. Under `prefers-reduced-motion`, the lamp is steady, the needle updates without interpolation, scrolling is instant, and all decorative entrances are removed. Nothing flashes.

## Original asset plan and provenance

Hero asset: a generated still life of a fictional, unbranded mid-century tabletop tape recorder with an unspooling paper waveform. It explains the core promise—speech is kept whole while extra tape can be gathered—without pretending to show the software UI. It is decorative/contextual and carries descriptive alt text. App icons and UI symbols are hand-authored SVG/CSS primitives.

Prompt sheet: “Editorial product still life of an entirely fictional unbranded 1950s field audio recorder, warm oatmeal enamel case, dark walnut faceplate, coral red record lamp, sage green waveform tape gently looping through brass guides, calm studio desk, tactile paper grain, soft directional morning light, three-quarter lens, restrained mid-century scientific illustration realism, palette of warm cream, charcoal, muted sage, burnt coral and ochre, spacious composition, no people, no text, no letters, no numbers, no watermark, no logos, no recognizable brand, no modern screens, no cables cut off awkwardly.”

Generated with the factory Azure image model (`factory-image`) on 2026-08-28. Original prompt and generation metadata are stored beside the source in `assets/src/hero-recorder.json`. The shipped derivative is WebP, optimized below 300 KB. Generated imagery is disclosed in the footer.
