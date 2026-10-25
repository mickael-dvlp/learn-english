import assert from "node:assert/strict";
import { test } from "node:test";
import { lastBookmark, mergeBookmarks, withBookmark } from "./bookmarks";

test("moving a bookmark keeps the other books; the same place changes nothing", () => {
  const bookmarks = withBookmark({ "book-a": { chapter: 1, sentence: 2, at: 1 } }, "book-b", { chapter: 0, sentence: 4 }, 5);
  assert.deepEqual(bookmarks, { "book-a": { chapter: 1, sentence: 2, at: 1 }, "book-b": { chapter: 0, sentence: 4, at: 5 } });
  assert.equal(withBookmark(bookmarks, "book-a", { chapter: 1, sentence: 2 }, 9), bookmarks);
});

test("merging a backup keeps the bookmark that moved last, book by book", () => {
  const mine = { "book-a": { chapter: 3, sentence: 0, at: 10 }, "book-b": { chapter: 1, sentence: 1, at: 2 } };
  const theirs = { "book-a": { chapter: 1, sentence: 0, at: 5 }, "book-b": { chapter: 2, sentence: 7, at: 8 }, "book-c": { chapter: 0, sentence: 3, at: 1 } };
  assert.deepEqual(mergeBookmarks(mine, theirs), {
    "book-a": { chapter: 3, sentence: 0, at: 10 },
    "book-b": { chapter: 2, sentence: 7, at: 8 },
    "book-c": { chapter: 0, sentence: 3, at: 1 },
  });
});

test("the book to continue: the most recent bookmark of a book that still exists", () => {
  const bookmarks = { "book-a": { chapter: 3, sentence: 0, at: 10 }, "book-gone": { chapter: 0, sentence: 0, at: 99 }, "book-b": { chapter: 1, sentence: 1, at: 2 } };
  assert.equal(lastBookmark(bookmarks, ["book-a", "book-b"])?.[0], "book-a");
  assert.equal(lastBookmark({}, ["book-a"]), undefined);
});
