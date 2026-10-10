import assert from "node:assert/strict";
import { test } from "node:test";
import { markListened, markSeen, progressStore, summarize, textListening, withMark, withPart } from "./progress";

test("withMark keeps the other field and other ids", () => {
  const progress = withMark({ "word-a": { listened: 1 } }, "word-a", "seen", 2);
  assert.deepEqual(withMark(progress, "word-b", "seen", 3), {
    "word-a": { listened: 1, seen: 2 },
    "word-b": { seen: 3 },
  });
});

test("summarize counts seen and listened among the given ids only", () => {
  const progress = { "word-a": { seen: 1, listened: 1 }, "word-b": { seen: 1 }, "word-z": { seen: 1 } };
  assert.deepEqual(summarize(progress, ["word-a", "word-b", "word-c"]), { total: 3, seen: 2, listened: 1 });
});

test("marking twice keeps the first date and does not notify again", () => {
  let notifications = 0;
  const unsubscribe = progressStore.subscribe(() => notifications++);
  markSeen("word-x");
  const first = progressStore.get()["word-x"]?.seen;
  markSeen("word-x");
  markListened("word-x");
  unsubscribe();
  assert.equal(progressStore.get()["word-x"]?.seen, first);
  assert.equal(notifications, 2);
});

test("a text is listened to once every sentence has been heard, possibly over several sessions", () => {
  let progress = withPart({ "text-a": { seen: 1 } }, "text-a", 1, 3, 10);
  assert.deepEqual(progress["text-a"], { seen: 1, parts: [1] });
  assert.deepEqual(textListening(progress["text-a"], 3), { state: "partial", heard: 1 });
  assert.equal(withPart(progress, "text-a", 1, 3, 11), progress, "same sentence again: unchanged");
  progress = withPart(withPart(progress, "text-a", 2, 3, 12), "text-a", 0, 3, 13);
  assert.deepEqual(progress["text-a"], { seen: 1, parts: [0, 1, 2], listened: 13 });
  assert.deepEqual(textListening(progress["text-a"], 3), { state: "full", heard: 3 });
});

test("opened only, and a text listened to before sentences were counted", () => {
  assert.deepEqual(textListening({ seen: 1 }, 5), { state: "none", heard: 0 });
  assert.deepEqual(textListening(undefined, 5), { state: "none", heard: 0 });
  assert.deepEqual(textListening({ listened: 1 }, 5), { state: "full", heard: 5 });
});

test("a rule is listened to once enough of its sentences have been heard", () => {
  let progress = withPart({}, "rule-a", 0, 3, 1);
  progress = withPart(progress, "rule-a", 4, 3, 2);
  assert.equal(progress["rule-a"]?.listened, undefined);
  progress = withPart(progress, "rule-a", 2, 3, 3);
  assert.deepEqual(progress["rule-a"], { parts: [0, 2, 4], listened: 3 });
});
