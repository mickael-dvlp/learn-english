import assert from "node:assert/strict";
import { test } from "node:test";
import type { Verb, Word } from "@/lib/content/schema";
import { buildQuiz, clampQuestionCount, quizSides } from "./quiz";

const word = (en: string, fr: string, extra: Partial<Word> = {}): Word => ({ id: `word-${en}`, type: "word", theme: "t", en, fr, ...extra });
const go: Verb = { id: "verb-go", type: "verb", base: "go", past: "went", pastParticiple: "gone", fr: "aller", regular: false };

/** Deterministic random numbers. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const fruits = ["apple", "pear", "plum", "cherry", "grape"].map((en) => word(en, `fr-${en}`));

test("questions alternate: from English first, then from French", () => {
  const quiz = buildQuiz(fruits, 4, seeded(1));
  assert.deepEqual(
    quiz.map((q) => `${q.prompt.lang}>${q.answer.lang}`),
    ["en>fr", "fr>en", "en>fr", "fr>en"],
  );
  const first = quiz[0];
  assert.equal(first.answer.text, `fr-${first.prompt.text}`);
});

test("every word is asked once before any comes back, never twice in a row", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const quiz = buildQuiz(fruits, 23, seeded(seed));
    assert.equal(quiz.length, 23);
    assert.equal(new Set(quiz.slice(0, 5).map((q) => q.itemId)).size, 5, "the first five are all different");
    assert.equal(new Set(quiz.slice(5, 10).map((q) => q.itemId)).size, 5);
    for (let i = 1; i < quiz.length; i++) assert.notEqual(quiz[i].itemId, quiz[i - 1].itemId, `seed ${seed}, question ${i}`);
  }
});

test("more words than questions: no word is asked twice", () => {
  const many = Array.from({ length: 40 }, (_, i) => word(`w${i}`, `m${i}`));
  const quiz = buildQuiz(many, 10, seeded(3));
  assert.equal(new Set(quiz.map((q) => q.itemId)).size, 10);
});

test("what is shown and what is said: pronunciation fix, three forms of a verb, usage note", () => {
  const much = word("much", "beaucoup de", { note: "avec un nom indénombrable" });
  const letter = word("E", "la lettre E", { speakEn: "E." });
  assert.deepEqual(quizSides(much).fr, { lang: "fr", text: "beaucoup de", spoken: "beaucoup de", note: "avec un nom indénombrable" });
  assert.deepEqual(quizSides(letter).en, { lang: "en", text: "E", spoken: "E." });
  assert.deepEqual(quizSides(go).en, { lang: "en", text: "go – went – gone", spoken: "go, went, gone" });
  assert.equal(quizSides({ ...go, speak: "read, red, red" }).en.spoken, "read, red, red");
});

test("no words, no questions; the count stays between 10 and 100, in steps of 5", () => {
  assert.deepEqual(buildQuiz([], 20), []);
  assert.equal(clampQuestionCount(3), 10);
  assert.equal(clampQuestionCount(42), 40);
  assert.equal(clampQuestionCount(43), 45);
  assert.equal(clampQuestionCount(500), 100);
});
