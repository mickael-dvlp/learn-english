import assert from "node:assert/strict";
import { test } from "node:test";
import { bookProgress, clampPosition, isFinished, nextPosition, positionLabel } from "./book";
import type { Book } from "./schema";

const sentences = (n: number) => Array.from({ length: n }, (_, i) => ({ en: `Sentence ${i + 1}.` }));
const book: Book = {
  id: "book-test",
  type: "book",
  title: { en: "Test" },
  chapters: [
    { title: { en: "One" }, sentences: sentences(3) },
    { title: { en: "Two" }, sentences: sentences(2) },
  ],
};

test("the next sentence, then the next chapter, then the end of the book", () => {
  assert.deepEqual(nextPosition(book, { chapter: 0, sentence: 0 }), { chapter: 0, sentence: 1 });
  assert.deepEqual(nextPosition(book, { chapter: 0, sentence: 2 }), { chapter: 1, sentence: 0 });
  const end = nextPosition(book, { chapter: 1, sentence: 1 });
  assert.deepEqual(end, { chapter: 2, sentence: 0 });
  assert.equal(isFinished(book, end), true);
  assert.equal(positionLabel(book, end), "Livre terminé");
});

test("progress and label of a position", () => {
  assert.deepEqual(bookProgress(book, { chapter: 1, sentence: 1 }), { done: 4, total: 5 });
  assert.deepEqual(bookProgress(book, { chapter: 2, sentence: 0 }), { done: 5, total: 5 });
  assert.equal(positionLabel(book, { chapter: 0, sentence: 1 }), "Chapitre 1, phrase 2 sur 3");
});

test("a bookmark saved before the book was shortened stays inside it", () => {
  assert.deepEqual(clampPosition(book, { chapter: 0, sentence: 9 }), { chapter: 0, sentence: 2 });
  assert.deepEqual(clampPosition(book, { chapter: 7, sentence: 3 }), { chapter: 2, sentence: 0 }, "finished");
  assert.deepEqual(clampPosition(book, { chapter: 1, sentence: 1 }), { chapter: 1, sentence: 1 });
});
