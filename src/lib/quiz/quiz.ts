import type { ContentItem, ContentType, Verb, Word } from "@/lib/content/schema";
import { shuffle, shuffleAfter } from "@/lib/player/compile";
import type { Lang } from "@/lib/player/types";

/**
 * Translation quiz on the words (or verbs) of a theme: a word is given, its translation is to be
 * found. Questions alternate: from English, then from French, and so on. Shared by Study
 * (written, answer shown on demand) and Listen (said, time to answer, answer said).
 */

/** Content that can be asked: something with one translation. */
export const QUIZ_TYPES: readonly ContentType[] = ["word", "verb"];

export const QUIZ_MIN_QUESTIONS = 10;
export const QUIZ_MAX_QUESTIONS = 100;

export type QuizItem = Word | Verb;

export function isQuizItem(item: ContentItem): item is QuizItem {
  return QUIZ_TYPES.includes(item.type);
}

/** One side of a question: what is shown, what is said (a verb is said with its three forms). */
export type QuizSide = { lang: Lang; text: string; spoken: string; note?: string };

export type QuizQuestion = { itemId: string; prompt: QuizSide; answer: QuizSide };

export function quizSides(item: QuizItem): Record<Lang, QuizSide> {
  const fr: QuizSide = { lang: "fr", text: item.fr, spoken: item.fr, ...(item.note && { note: item.note }) };
  if (item.type === "word") return { en: { lang: "en", text: item.en, spoken: item.speakEn ?? item.en }, fr };
  return {
    en: { lang: "en", text: `${item.base} – ${item.past} – ${item.pastParticiple}`, spoken: item.speak ?? `${item.base}, ${item.past}, ${item.pastParticiple}` },
    fr,
  };
}

/**
 * `count` questions on the items, in random order: every item once before any comes back
 * (a theme smaller than the quiz), never the same one twice in a row. The first question is
 * asked from English, the next one from French, and so on.
 */
export function buildQuiz(items: readonly QuizItem[], count: number, random: () => number = Math.random): QuizQuestion[] {
  if (items.length === 0) return [];
  const order: QuizItem[] = [];
  let lap: QuizItem[] = [];
  while (order.length < count) {
    lap = lap.length === 0 ? shuffle(items, random) : shuffleAfter(items, lap, random);
    order.push(...lap);
  }
  return order.slice(0, count).map((item, index) => {
    const sides = quizSides(item);
    const fromEnglish = index % 2 === 0;
    return { itemId: item.id, prompt: fromEnglish ? sides.en : sides.fr, answer: fromEnglish ? sides.fr : sides.en };
  });
}

/** A number of questions within the allowed range, in steps of 5. */
export function clampQuestionCount(count: number): number {
  const rounded = Math.round(count / 5) * 5;
  return Math.min(QUIZ_MAX_QUESTIONS, Math.max(QUIZ_MIN_QUESTIONS, rounded));
}
