import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export default function createDeterministicMicrophoneFixture() {
  const fixtureUrl = new URL('../../test-results/fake-microphone.wav', import.meta.url);
  mkdirSync(new URL('../../test-results/', import.meta.url), { recursive: true });
  const sampleRate = 48_000;
  const seconds = 6;
  const samples = sampleRate * seconds;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (offset, value) => { for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index)); };
  text(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, samples * 2, true);
  for (let index = 0; index < samples; index += 1) {
    const elapsed = index / sampleRate;
    const phase = elapsed % 3;
    const voice = phase < .6 || phase >= 1.5;
    const sample = voice ? Math.sin(2 * Math.PI * 220 * elapsed) * .35 : 0;
    view.setInt16(44 + index * 2, sample * 0x7fff, true);
  }
  writeFileSync(fileURLToPath(fixtureUrl), new Uint8Array(buffer));
}
