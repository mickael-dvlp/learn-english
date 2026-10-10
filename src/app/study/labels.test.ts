import assert from "node:assert/strict";
import { test } from "node:test";
import type { Word } from "@/lib/content/schema";
import { wordBadges } from "./labels";

const word = (fields: Partial<Word>): Word => ({ id: "word-x", type: "word", theme: "t", en: "x", fr: "x", ...fields });

test("card labels: part of speech and categories, never a level nor 'autre'", () => {
  assert.deepEqual(wordBadges(word({ pos: "noun" })), ["nom"]);
  assert.deepEqual(wordBadges(word({ pos: "other" })), []);
  assert.deepEqual(wordBadges(word({ pos: "other", tags: ["coordination", "cause"] })), ["coordination", "cause et conséquence"]);
  assert.deepEqual(wordBadges(word({ pos: "other", tags: ["autre"] })), []);
});
