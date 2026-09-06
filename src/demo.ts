import { analyzePcm, encodeWav, renderSegments } from './audio';
import type { Take } from './types';

const sampleRate = 8_000;

function tone(seconds: number, frequency: number): Float32Array {
  const samples = Math.round(seconds * sampleRate);
  return Float32Array.from({ length: samples }, (_, index) => {
    const envelope = Math.min(1, index / 220, (samples - index) / 220);
    return Math.sin((Math.PI * 2 * frequency * index) / sampleRate) * 0.28 * envelope;
  });
}

function quiet(seconds: number): Float32Array {
  return new Float32Array(Math.round(seconds * sampleRate));
}

function join(parts: Float32Array[]): Float32Array {
  const output = new Float32Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

export function createDemoTake(): Take {
  // This is deliberately speech-like timing, not an empty fixture: a teaching
  // introduction has brief breaths plus two pauses worth reviewing.
  const pcm = join([
    tone(2.2, 182), quiet(.45), tone(2.7, 198), quiet(2.1),
    tone(2.35, 174), quiet(.55), tone(2.6, 206), quiet(1.8), tone(2.15, 190),
  ]);
  const minSilenceMs = 700;
  const segments = analyzePcm(pcm, sampleRate, -42, minSilenceMs);
  const rawBlob = encodeWav(pcm, sampleRate);
  const editedBlob = encodeWav(renderSegments(pcm, sampleRate, segments), sampleRate);
  const duration = pcm.length / sampleRate;
  const editedDuration = segments.reduce((total, segment) => total + (segment.restored ? segment.originalDuration : segment.outputDuration), 0);
  return {
    id: 'demo-lesson-intro',
    name: 'Lesson intro — warm-up directions',
    createdAt: Date.UTC(2026, 8, 5, 9, 30),
    duration,
    editedDuration,
    sampleRate,
    minSilenceMs,
    thresholdDb: -42,
    segments,
    rawBlob,
    editedBlob,
  };
}
