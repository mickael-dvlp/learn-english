import assert from "node:assert/strict";
import { test } from "node:test";
import { silentWav } from "./silence";

test("silentWav: a valid 8 kHz mono 8-bit WAV of the requested length", () => {
  const wav = silentWav(1500);
  const view = new DataView(wav.buffer);
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), "RIFF");
  assert.equal(String.fromCharCode(...wav.slice(8, 12)), "WAVE");
  assert.equal(view.getUint32(40, true), 12_000); // 1.5 s × 8000 samples
  assert.equal(wav.length, 44 + 12_000);
  assert.ok(wav.slice(44).every((sample) => sample === 128));
});
