import { describe, expect, it } from 'vitest';
import { analyzePcm, decodeWav, encodeWav, formatTime, makeZip, renderSegments, safeFilename } from '../src/audio';

const rate = 1000;
const tone = (seconds: number, amplitude = .4) => Float32Array.from({ length: seconds * rate }, (_, i) => amplitude * Math.sin(i / 3));
const quiet = (seconds: number) => new Float32Array(seconds * rate);
const join = (...parts: Float32Array[]) => {
  const output = new Float32Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; } return output;
};

describe('pause analysis', () => {
  it('keeps short natural pauses at full length', () => {
    const pcm = join(tone(1), quiet(.4), tone(1));
    const segments = analyzePcm(pcm, rate, -35, 700);
    const pause = segments.find(segment => segment.type === 'pause');
    expect(pause?.restored).toBe(true);
    expect(renderSegments(pcm, rate, segments).length).toBe(pcm.length);
  });

  it('compacts only sustained silence to the configured minimum', () => {
    const pcm = join(tone(1), quiet(2), tone(1));
    const segments = analyzePcm(pcm, rate, -35, 700);
    const pause = segments.find(segment => segment.type === 'pause' && !segment.restored);
    expect(pause).toBeDefined();
    expect(pause?.outputDuration).toBe(.7);
    expect(renderSegments(pcm, rate, segments).length).toBeLessThan(pcm.length);
  });

  it('restores the full original pause non-destructively', () => {
    const pcm = join(tone(1), quiet(2), tone(1));
    const segments = analyzePcm(pcm, rate, -35, 700);
    const pause = segments.find(segment => segment.type === 'pause' && !segment.restored);
    if (!pause) throw new Error('Expected a compactable pause');
    pause.restored = true;
    expect(renderSegments(pcm, rate, segments).length).toBe(pcm.length);
  });
});

describe('portable output', () => {
  it('encodes and decodes mono 16-bit WAV', async () => {
    const source = tone(1);
    const decoded = await decodeWav(encodeWav(source, rate));
    expect(decoded.sampleRate).toBe(rate);
    expect(decoded.pcm.length).toBe(source.length);
    expect(decoded.pcm[20]).toBeCloseTo(source[20] ?? 0, 3);
  });

  it('creates a standards-shaped ZIP archive', async () => {
    const zip = await makeZip([{ name: 'take.wav', blob: encodeWav(tone(1), rate) }]);
    const bytes = new Uint8Array(await zip.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(zip.type).toBe('application/zip');
  });

  it('formats labels and safe filenames', () => {
    expect(formatTime(65)).toBe('01:05');
    expect(safeFilename('My Take: 01!')).toBe('my-take-01');
  });
});
