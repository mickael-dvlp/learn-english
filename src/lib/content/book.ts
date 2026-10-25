import type { Book } from "./schema";

/**
 * Where reading or listening stands in a book: a sentence of a chapter (both from 0). Past the
 * last chapter, the book is finished. One bookmark per book, shared by Study and Listen.
 */
export type BookPosition = { chapter: number; sentence: number };

export const BOOK_START: BookPosition = { chapter: 0, sentence: 0 };

export function isFinished(book: Book, position: BookPosition): boolean {
  return position.chapter >= book.chapters.length;
}

/** The sentence after this one: the start of the next chapter after the last one of a chapter. */
export function nextPosition(book: Book, { chapter, sentence }: BookPosition): BookPosition {
  const length = book.chapters[chapter]?.sentences.length ?? 0;
  return sentence + 1 < length ? { chapter, sentence: sentence + 1 } : { chapter: chapter + 1, sentence: 0 };
}

/** A position saved earlier, within the book as it is now (it may have been edited since). */
export function clampPosition(book: Book, position: BookPosition): BookPosition {
  if (position.chapter >= book.chapters.length) return { chapter: book.chapters.length, sentence: 0 };
  const chapter = Math.max(0, position.chapter);
  const length = book.chapters[chapter].sentences.length;
  return { chapter, sentence: Math.min(Math.max(0, position.sentence), length - 1) };
}

/** Sentences before the position, out of all of them. */
export function bookProgress(book: Book, position: BookPosition): { done: number; total: number } {
  const lengths = book.chapters.map((chapter) => chapter.sentences.length);
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (isFinished(book, position)) return { done: total, total };
  const done = lengths.slice(0, position.chapter).reduce((sum, length) => sum + length, 0) + position.sentence;
  return { done, total };
}

/** « Chapitre 3, phrase 12 sur 40 », « Livre terminé ». */
export function positionLabel(book: Book, position: BookPosition): string {
  if (isFinished(book, position)) return "Livre terminé";
  const length = book.chapters[position.chapter].sentences.length;
  return `Chapitre ${position.chapter + 1}, phrase ${position.sentence + 1} sur ${length}`;
}
