import assert from "node:assert/strict";
import { test } from "node:test";
import { markListened, markSeen, progressStore, summarize, withMark } from "./progress";

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
