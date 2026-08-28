import type { AudioSegment } from './types';

export function mergeChunks(chunks: Float32Array[]): Float32Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function rmsDb(samples: Float32Array): number {
  if (!samples.length) return -100;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.max(-100, 20 * Math.log10(Math.sqrt(sum / samples.length) || 1e-5));
}

export function analyzePcm(pcm: Float32Array, sampleRate: number, thresholdDb: number, minSilenceMs: number): AudioSegment[] {
  if (!pcm.length || sampleRate <= 0) return [];
  const frameSamples = Math.max(1, Math.round(sampleRate * .02));
  const frames = Math.ceil(pcm.length / frameSamples);
  const voiced = new Array<boolean>(frames).fill(false);
  for (let i = 0; i < frames; i += 1) voiced[i] = rmsDb(pcm.subarray(i * frameSamples, Math.min(pcm.length, (i + 1) * frameSamples))) >= thresholdDb;

  // Bridge tiny internal dips (plosives and word boundaries), then add a short speech hangover.
  const bridgeFrames = 10;
  for (let i = 0; i < frames;) {
    if (voiced[i]) { i += 1; continue; }
    const start = i;
    while (i < frames && !voiced[i]) i += 1;
    if (start > 0 && i < frames && i - start <= bridgeFrames) voiced.fill(true, start, i);
  }
  const hangover = 5;
  const expanded = voiced.slice();
  for (let i = 0; i < frames; i += 1) {
    if (!voiced[i]) continue;
    for (let j = Math.max(0, i - hangover); j <= Math.min(frames - 1, i + hangover); j += 1) expanded[j] = true;
  }

  const segments: AudioSegment[] = [];
  let startFrame = 0;
  for (let frame = 1; frame <= frames; frame += 1) {
    if (frame < frames && expanded[frame] === expanded[startFrame]) continue;
    const start = startFrame * frameSamples;
    const end = Math.min(pcm.length, frame * frameSamples);
    const originalDuration = (end - start) / sampleRate;
    const type = expanded[startFrame] ? 'voice' : 'pause';
    const canCompact = type === 'pause' && originalDuration * 1000 > minSilenceMs;
    segments.push({
      id: `${start}-${end}`,
      type,
      start,
      end,
      originalDuration,
      outputDuration: canCompact ? minSilenceMs / 1000 : originalDuration,
      restored: !canCompact,
    });
    startFrame = frame;
  }
  return segments;
}

export function renderSegments(pcm: Float32Array, sampleRate: number, segments: AudioSegment[]): Float32Array {
  const pieces: Float32Array[] = [];
  for (const segment of segments) {
    const source = pcm.subarray(segment.start, segment.end);
    if (segment.type === 'voice' || segment.restored || segment.outputDuration >= segment.originalDuration) {
      pieces.push(source);
      continue;
    }
    const keep = Math.max(1, Math.round(segment.outputDuration * sampleRate));
    const leading = Math.floor(keep / 2);
    pieces.push(source.slice(0, leading), source.slice(Math.max(leading, source.length - (keep - leading))));
  }
  return mergeChunks(pieces);
}

export function encodeWav(pcm: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, pcm[i] ?? 0));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export async function decodeWav(blob: Blob): Promise<{ pcm: Float32Array; sampleRate: number }> {
  const buffer = await blob.arrayBuffer();
  const view = new DataView(buffer);
  const sampleRate = view.getUint32(24, true);
  const bits = view.getUint16(34, true);
  if (bits !== 16 || String.fromCharCode(...new Uint8Array(buffer, 0, 4)) !== 'RIFF') throw new Error('This project contains an unsupported WAV format.');
  let offset = 12;
  while (offset + 8 < buffer.byteLength) {
    const name = String.fromCharCode(...new Uint8Array(buffer, offset, 4));
    const size = view.getUint32(offset + 4, true);
    if (name === 'data') {
      const pcm = new Float32Array(Math.floor(size / 2));
      for (let i = 0; i < pcm.length; i += 1) pcm[i] = view.getInt16(offset + 8 + i * 2, true) / 0x8000;
      return { pcm, sampleRate };
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error('The WAV data chunk is missing.');
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function safeFilename(name: string): string {
  return (name.trim() || 'Pausekeeper take').replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '-').slice(0, 64).toLowerCase();
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export async function makeZip(files: Array<{ name: string; blob: Blob }>): Promise<Blob> {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const set16 = (view: DataView, at: number, value: number) => view.setUint16(at, value, true);
  const set32 = (view: DataView, at: number, value: number) => view.setUint32(at, value, true);
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const localView = new DataView(local.buffer);
    set32(localView, 0, 0x04034b50); set16(localView, 4, 20); set16(localView, 8, 0); set32(localView, 14, crc); set32(localView, 18, data.length); set32(localView, 22, data.length); set16(localView, 26, name.length);
    local.set(name, 30); local.set(data, 30 + name.length); locals.push(local);
    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    set32(centralView, 0, 0x02014b50); set16(centralView, 4, 20); set16(centralView, 6, 20); set32(centralView, 16, crc); set32(centralView, 20, data.length); set32(centralView, 24, data.length); set16(centralView, 28, name.length); set32(centralView, 42, offset);
    central.set(name, 46); centrals.push(central); offset += local.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  set32(endView, 0, 0x06054b50); set16(endView, 8, files.length); set16(endView, 10, files.length); set32(endView, 12, centralSize); set32(endView, 16, offset);
  const all = [...locals, ...centrals, end];
  const output = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let outputOffset = 0;
  for (const part of all) { output.set(part, outputOffset); outputOffset += part.length; }
  return new Blob([output.buffer], { type: 'application/zip' });
}
