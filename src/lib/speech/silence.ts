/** Silent WAV files of a given duration, built in memory (no binary file in the repo). */

const SAMPLE_RATE = 8000; // 8 kHz mono 8-bit: 8 bytes per millisecond
const STEP_MS = 50;

const cache = new Map<number, string>();

/** Object URL of `ms` milliseconds of silence (rounded to 50 ms, cached). */
export function silenceUrl(ms: number): string {
  const rounded = Math.max(STEP_MS, Math.round(ms / STEP_MS) * STEP_MS);
  let url = cache.get(rounded);
  if (!url) {
    url = URL.createObjectURL(new Blob([silentWav(rounded)], { type: "audio/wav" }));
    cache.set(rounded, url);
  }
  return url;
}

export function silentWav(ms: number): Uint8Array<ArrayBuffer> {
  const samples = Math.round((SAMPLE_RATE * ms) / 1000);
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE, true); // byte rate
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  text(36, "data");
  view.setUint32(40, samples, true);
  bytes.fill(128, 44); // 8-bit PCM silence is 128
  return bytes;
}
