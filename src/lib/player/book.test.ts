import assert from "node:assert/strict";
import { test } from "node:test";
import type { Book } from "@/lib/content/schema";
import { bookSegments } from "./book";
import { findPattern } from "./patterns";

const book: Book = {
  id: "book-test",
  type: "book",
  title: { en: "Test" },
  chapters: [
    { title: { en: "One", fr: "Un" }, sentences: [{ en: "A.", fr: "a." }, { en: "B.", fr: "b." }, { en: "C." }] },
    { title: { en: "Two" }, sentences: [{ en: "D.", fr: "d." }] },
  ],
};
const pattern = findPattern("text")!;
const labels = (segments: ReturnType<typeof bookSegments>) => segments.map((s) => (s.intro ? `[${s.label}]` : s.label));

test("the whole book: each chapter title, then its sentences, each with its place for the bookmark", () => {
  const segments = bookSegments(book, pattern);
  assert.deepEqual(labels(segments), ["[One]", "A.", "B.", "C.", "[Two]", "D."]);
  assert.deepEqual(segments[2].bookmark, { chapter: 0, sentence: 1 });
  assert.deepEqual(segments[5].bookmark, { chapter: 1, sentence: 0 });
  assert.equal(segments[1].context, "One");
  assert.ok(segments.every((s) => s.part === undefined), "the progress of a text is not used");
});

test("resuming in the middle of a chapter: its title first, then from the bookmark", () => {
  assert.deepEqual(labels(bookSegments(book, pattern, { chapter: 0, sentence: 2 })), ["[One]", "C.", "[Two]", "D."]);
  assert.deepEqual(labels(bookSegments(book, pattern, { chapter: 1, sentence: 0 })), ["[Two]", "D."]);
  assert.deepEqual(bookSegments(book, pattern, { chapter: 2, sentence: 0 }), [], "finished: nothing left");
});

test("a sentence without translation is said in English only", () => {
  const [, , , c] = bookSegments(book, pattern);
  const said = c.steps.flatMap((step) => (step.kind === "speak" ? [step.lang] : []));
  assert.deepEqual(said, ["en"]);
});
