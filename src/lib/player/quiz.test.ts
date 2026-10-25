import assert from "node:assert/strict";
import { test } from "node:test";
import { buildQuiz } from "@/lib/quiz/quiz";
import { pauseMs } from "./pause";
import { playOnce, quizSegments } from "./quiz";

const words = [
  { id: "word-apple", type: "word", theme: "t", en: "apple", fr: "pomme" },
  { id: "word-pear", type: "word", theme: "t", en: "pear", fr: "poire" },
] as const;

test("a question: the word, the time to answer, the answer, a pause; numbered for the screen", () => {
  const [first, second] = quizSegments(buildQuiz([...words], 2), 4000);
  const said = first.steps.map((step) => (step.kind === "speak" ? `${step.lang}:${step.unit[step.lang]}` : `pause`));
  assert.equal(said.length, 4);
  assert.equal(first.steps[0].kind === "speak" && first.steps[0].lang, "en", "the first question is asked in English");
  assert.equal(second.steps[0].kind === "speak" && second.steps[0].lang, "fr", "the next one in French");
  assert.equal(first.label, first.steps[0].kind === "speak" ? first.steps[0].unit.en : "");
  assert.equal(first.context, "Question 1 / 2");
  assert.equal(second.context, "Question 2 / 2");
});

test("the time to answer keeps its length, whatever the pause setting", () => {
  const [segment] = quizSegments(buildQuiz([...words], 1), 3500);
  const wait = segment.steps[1];
  assert.ok(wait.kind === "pause");
  assert.equal(pauseMs(wait, { rate: 1, pauseFactor: 2.5 }), 3500);
  const after = segment.steps[3];
  assert.ok(after.kind === "pause");
  assert.ok(pauseMs(after, { rate: 1, pauseFactor: 2 }) > pauseMs(after, { rate: 1, pauseFactor: 1 }), "the last pause follows the setting");
});

test("a quiz is played once", () => {
  const lap = playOnce(quizSegments(buildQuiz([...words], 3), 4000));
  assert.equal(lap().length, 3);
  assert.deepEqual(lap(), []);
});
