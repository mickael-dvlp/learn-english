import type { QuizQuestion, QuizSide } from "@/lib/quiz/quiz";
import { countWords } from "./compile";
import type { Segment, Step } from "./types";

/** Chosen in Listen like a pattern (« Comment ? »), for words and verbs. */
export const QUIZ_PATTERN_ID = "quiz";

/**
 * A quiz in Listen: the word, a set time to answer aloud, the answer, then the next question by
 * itself. One segment per question; the session ends after the last one.
 */
export function quizSegments(questions: readonly QuizQuestion[], answerMs: number): Segment[] {
  return questions.map((question, index) => {
    const say = (side: QuizSide, n: number): Step => ({
      kind: "speak",
      unit: { id: `${question.itemId}:quiz:${n}`, [side.lang]: side.spoken },
      lang: side.lang,
      rate: 1,
    });
    return {
      itemId: question.itemId,
      label: question.prompt.text,
      context: `Question ${index + 1} / ${questions.length}`,
      steps: [
        say(question.prompt, 0),
        { kind: "pause", words: 0, scale: 1, ms: answerMs },
        say(question.answer, 1),
        { kind: "pause", words: countWords(question.answer.spoken), scale: 1.5 },
      ],
    };
  });
}

/** A `createLap` that plays the segments once: nothing comes after them (the session ends). */
export function playOnce(segments: Segment[]): () => Segment[] {
  let played = false;
  return () => {
    if (played) return [];
    played = true;
    return segments;
  };
}
