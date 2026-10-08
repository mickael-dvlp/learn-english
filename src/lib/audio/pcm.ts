/** Raw audio helpers: mono PCM as Float32Array (-1…1). Pure, no browser API. */

/** Edge TTS files are 24 kHz: keeping that rate avoids any loss. */
export const SAMPLE_RATE = 24_000;

export function msToSamples(ms: number, sampleRate = SAMPLE_RATE): number {
  return Math.max(0, Math.round((ms * sampleRate) / 1000));
}

export function samplesToMs(samples: number, sampleRate = SAMPLE_RATE): number {
  return (samples * 1000) / sampleRate;
}

export function concat(parts: readonly Float32Array[]): Float32Array {
  const result = new Float32Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

/**
 * Removes the silence the voice engine leaves before and after the words,
 * keeping a short margin so that nothing is clipped.
 */
export function trimSilence(
  samples: Float32Array,
  { threshold = 0.01, marginMs = 60, sampleRate = SAMPLE_RATE } = {},
): Float32Array {
  let start = 0;
  while (start < samples.length && Math.abs(samples[start]) < threshold) start++;
  let end = samples.length;
  while (end > start && Math.abs(samples[end - 1]) < threshold) end--;
  if (start >= end) return samples.subarray(0, 0);
  const margin = msToSamples(marginMs, sampleRate);
  return samples.subarray(Math.max(0, start - margin), Math.min(samples.length, end + margin));
}

/** 16-bit PCM mono WAV file. */
export function encodeWav(samples: Float32Array, sampleRate = SAMPLE_RATE): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return bytes;
}
