import assert from "node:assert/strict";
import { test } from "node:test";
import { backupFileName, createBackup, mergeProgress, parseBackup } from "./backup";
import { DEFAULT_PREFERENCES } from "./preferences";

test("a backup survives the round trip, preferences included", () => {
  const now = new Date("2026-10-10T08:00:00Z");
  const backup = createBackup({ "word-a": { seen: 1, listened: 2 } }, { ...DEFAULT_PREFERENCES, rate: 1.2 }, now);
  const parsed = parseBackup(JSON.stringify(backup));
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.progress, { "word-a": { seen: 1, listened: 2 } });
  assert.equal(parsed.preferences?.rate, 1.2);
  assert.equal(parsed.exportedAt.toISOString(), now.toISOString());
  assert.equal(backupFileName(now), "anglais-progression-2026-10-10.json");
});

test("anything that is not a backup is refused, with a clear message", () => {
  assert.equal(parseBackup("not json").ok, false);
  assert.equal(parseBackup(JSON.stringify({ hello: "world" })).ok, false);
  const wrongEntry = { format: "learn-english-backup", version: 1, exportedAt: "x", progress: { "word-a": { seen: "yesterday" } } };
  assert.equal(parseBackup(JSON.stringify(wrongEntry)).ok, false);
  assert.equal(parseBackup("x".repeat(5_000_001)).ok, false);
  const result = parseBackup("{");
  assert.ok(!result.ok && result.error.length > 0);
});

test("invalid preferences are ignored, the progress is still imported", () => {
  const backup = { format: "learn-english-backup", version: 1, exportedAt: "2026-10-10", progress: { "word-a": { seen: 1 } }, preferences: { rate: "fast" } };
  const parsed = parseBackup(JSON.stringify(backup));
  assert.ok(parsed.ok);
  assert.equal(parsed.preferences?.rate, DEFAULT_PREFERENCES.rate, "invalid rate falls back to the default");
});

test("merging never loses anything: earliest dates, every part heard", () => {
  const current = { "word-a": { seen: 5 }, "text-b": { seen: 3, parts: [0, 2] }, "word-c": { listened: 9 } };
  const incoming = { "word-a": { seen: 2, listened: 7 }, "text-b": { parts: [1, 2] }, "word-d": { seen: 4 } };
  assert.deepEqual(mergeProgress(current, incoming), {
    "word-a": { seen: 2, listened: 7 },
    "text-b": { seen: 3, parts: [0, 1, 2] },
    "word-c": { listened: 9 },
    "word-d": { seen: 4 },
  });
});
