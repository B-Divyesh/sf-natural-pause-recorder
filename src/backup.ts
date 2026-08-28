import { decodeWav } from './audio';
import type { AudioSegment, PortableTake, Take } from './types';

type BackupEnvelope = {
  product?: unknown;
  version?: unknown;
  takes?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function wavDataUrlToBlob(value: unknown): Blob {
  if (typeof value !== 'string') throw new Error('missing WAV data');
  const match = /^data:audio\/(?:wav|x-wav);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match?.[1]) throw new Error('invalid WAV data URL');
  const binary = atob(match[1]);
  if (binary.length < 44) throw new Error('incomplete WAV data');
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const text = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  if (text(0, 4) !== 'RIFF' || text(8, 4) !== 'WAVE') throw new Error('invalid WAV header');
  return new Blob([bytes], { type: 'audio/wav' });
}

function parseSegment(value: unknown, sampleCount: number, previousEnd: number): AudioSegment {
  if (!isRecord(value)) throw new Error('invalid segment');
  const { id, type, start, end, originalDuration, outputDuration, restored } = value;
  if (typeof id !== 'string' || !id || id.length > 200) throw new Error('invalid segment ID');
  if (type !== 'voice' && type !== 'pause') throw new Error('invalid segment type');
  if (!Number.isInteger(start) || !Number.isInteger(end) || (start as number) !== previousEnd || (end as number) <= (start as number) || (end as number) > sampleCount) throw new Error('invalid segment range');
  if (!isFiniteNumber(originalDuration) || originalDuration <= 0 || !isFiniteNumber(outputDuration) || outputDuration <= 0 || outputDuration > originalDuration + .001) throw new Error('invalid segment duration');
  if (typeof restored !== 'boolean') throw new Error('invalid segment state');
  return { id, type, start: start as number, end: end as number, originalDuration, outputDuration, restored };
}

async function parseTake(value: unknown): Promise<Take> {
  if (!isRecord(value)) throw new Error('invalid take');
  const { id, name, createdAt, duration, editedDuration, sampleRate, minSilenceMs, thresholdDb, segments, rawWav, editedWav } = value;
  if (typeof id !== 'string' || !id.trim() || id.length > 200) throw new Error('invalid take ID');
  if (typeof name !== 'string' || !name.trim() || name.length > 80) throw new Error('invalid take name');
  if (!Number.isInteger(createdAt) || (createdAt as number) < 0) throw new Error('invalid creation time');
  if (!isFiniteNumber(duration) || duration <= 0 || !isFiniteNumber(editedDuration) || editedDuration <= 0 || editedDuration > duration + .001) throw new Error('invalid take duration');
  if (!Number.isInteger(sampleRate) || (sampleRate as number) < 8_000 || (sampleRate as number) > 384_000) throw new Error('invalid sample rate');
  if (!Number.isInteger(minSilenceMs) || (minSilenceMs as number) < 300 || (minSilenceMs as number) > 2_500) throw new Error('invalid pause setting');
  if (!isFiniteNumber(thresholdDb) || thresholdDb < -52 || thresholdDb > -30) throw new Error('invalid sensitivity');
  if (!Array.isArray(segments) || !segments.length) throw new Error('invalid segments');

  const rawBlob = wavDataUrlToBlob(rawWav);
  const editedBlob = wavDataUrlToBlob(editedWav);
  const [rawAudio, editedAudio] = await Promise.all([decodeWav(rawBlob), decodeWav(editedBlob)]);
  if (rawAudio.sampleRate !== sampleRate || editedAudio.sampleRate !== sampleRate) throw new Error('WAV sample rate mismatch');
  if (Math.abs(rawAudio.pcm.length / sampleRate - duration) > .05 || Math.abs(editedAudio.pcm.length / sampleRate - editedDuration) > .05) throw new Error('WAV duration mismatch');

  let previousEnd = 0;
  const parsedSegments = segments.map(segment => {
    const parsed = parseSegment(segment, rawAudio.pcm.length, previousEnd);
    previousEnd = parsed.end;
    const measuredDuration = (parsed.end - parsed.start) / sampleRate;
    if (Math.abs(measuredDuration - parsed.originalDuration) > .05) throw new Error('segment duration mismatch');
    return parsed;
  });
  if (previousEnd !== rawAudio.pcm.length) throw new Error('incomplete segment timeline');

  return { id, name, createdAt: createdAt as number, duration, editedDuration, sampleRate: sampleRate as number, minSilenceMs: minSilenceMs as number, thresholdDb, segments: parsedSegments, rawBlob, editedBlob };
}

export async function parseProjectBackup(text: string): Promise<Take[]> {
  let envelope: BackupEnvelope;
  try {
    envelope = JSON.parse(text) as BackupEnvelope;
  } catch {
    throw new Error('invalid JSON');
  }
  if (!isRecord(envelope) || envelope.product !== 'Pausekeeper' || envelope.version !== 1 || !Array.isArray(envelope.takes)) throw new Error('wrong backup format');
  if (envelope.takes.length > 10_000) throw new Error('too many takes');

  // Parse and validate the entire file before returning a single writable record.
  const parsed = await Promise.all(envelope.takes.map(parseTake));
  const ids = new Set<string>();
  for (const take of parsed) {
    if (ids.has(take.id)) throw new Error('duplicate take ID');
    ids.add(take.id);
  }
  return parsed;
}

export async function takeToPortable(take: Take, blobToDataUrl: (blob: Blob) => Promise<string>): Promise<PortableTake> {
  return {
    id: take.id,
    name: take.name,
    createdAt: take.createdAt,
    duration: take.duration,
    editedDuration: take.editedDuration,
    sampleRate: take.sampleRate,
    minSilenceMs: take.minSilenceMs,
    thresholdDb: take.thresholdDb,
    segments: take.segments,
    rawWav: await blobToDataUrl(take.rawBlob),
    editedWav: await blobToDataUrl(take.editedBlob),
  };
}
