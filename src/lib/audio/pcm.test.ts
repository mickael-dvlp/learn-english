import assert from "node:assert/strict";
import { test } from "node:test";
import { concat, encodeWav, trimSilence } from "./pcm";

test("encodeWav: 16-bit mono PCM with a valid header", () => {
  const wav = encodeWav(new Float32Array([0, 1, -1, 0.5]), 24_000);
  const view = new DataView(wav.buffer);
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), "RIFF");
  assert.equal(String.fromCharCode(...wav.slice(8, 12)), "WAVE");
  assert.equal(view.getUint32(24, true), 24_000);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 8);
  assert.deepEqual([0, 1, 2, 3].map((i) => view.getInt16(44 + i * 2, true)), [0, 32767, -32768, 16383]);
});

test("trimSilence keeps the sound plus a small margin", () => {
  const sampleRate = 1000; // 1 sample = 1 ms
  const samples = new Float32Array(1000);
  samples.fill(0.5, 400, 600);
  const trimmed = trimSilence(samples, { marginMs: 50, sampleRate });
  assert.equal(trimmed.length, 200 + 2 * 50);
  assert.equal(trimSilence(new Float32Array(100), { sampleRate }).length, 0);
});

test("concat joins parts in order", () => {
  assert.deepEqual([...concat([new Float32Array([1, 2]), new Float32Array([3])])], [1, 2, 3]);
});
