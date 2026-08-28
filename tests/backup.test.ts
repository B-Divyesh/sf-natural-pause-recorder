import { describe, expect, it } from 'vitest';
import { encodeWav } from '../src/audio';
import { parseProjectBackup, takeToPortable } from '../src/backup';
import type { Take } from '../src/types';

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${blob.type};base64,${btoa(binary)}`;
}

function makeTake(id = 'take-1'): Take {
  const sampleRate = 8_000;
  const pcm = new Float32Array(sampleRate).fill(.2);
  const wav = encodeWav(pcm, sampleRate);
  return {
    id,
    name: 'Original irreplaceable take',
    createdAt: 1_787_897_600_000,
    duration: 1,
    editedDuration: 1,
    sampleRate,
    minSilenceMs: 700,
    thresholdDb: -42,
    segments: [{ id: '0-8000', type: 'voice', start: 0, end: 8_000, originalDuration: 1, outputDuration: 1, restored: true }],
    rawBlob: wav,
    editedBlob: wav,
  };
}

describe('project backup validation', () => {
  it('fully parses a valid exported backup', async () => {
    const portable = await takeToPortable(makeTake(), blobToDataUrl);
    const parsed = await parseProjectBackup(JSON.stringify({ product: 'Pausekeeper', version: 1, takes: [portable] }));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.name).toBe('Original irreplaceable take');
    expect(await parsed[0]?.rawBlob.arrayBuffer()).toHaveProperty('byteLength', 16_044);
  });

  it('rejects the whole backup when a later take is invalid', async () => {
    const portable = await takeToPortable(makeTake('colliding-id'), blobToDataUrl);
    const invalidLaterTake = { ...portable, id: 'invalid-later-take' } as Record<string, unknown>;
    delete invalidLaterTake.rawWav;
    const backup = JSON.stringify({ product: 'Pausekeeper', version: 1, takes: [{ ...portable, name: 'OVERWRITTEN BY REJECTED IMPORT' }, invalidLaterTake] });
    await expect(parseProjectBackup(backup)).rejects.toThrow('missing WAV data');
  });

  it('rejects duplicate IDs before import', async () => {
    const portable = await takeToPortable(makeTake('duplicate-id'), blobToDataUrl);
    await expect(parseProjectBackup(JSON.stringify({ product: 'Pausekeeper', version: 1, takes: [portable, portable] }))).rejects.toThrow('duplicate take ID');
  });
});
