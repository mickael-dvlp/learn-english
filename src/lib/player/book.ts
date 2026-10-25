import { BOOK_START, type BookPosition } from "@/lib/content/book";
import type { Book } from "@/lib/content/schema";
import { compileItem } from "./compile";
import type { Pattern } from "./patterns";
import type { Segment } from "./types";

/**
 * A book in Listen, from a position (the bookmark) to its end: each chapter is read like a text
 * (its title, then sentence by sentence, with the chosen text pattern). Resuming in the middle of a
 * chapter says its title first. Sentences carry their place in the book, for the bookmark.
 */
export function bookSegments(book: Book, pattern: Pattern, from: BookPosition = BOOK_START): Segment[] {
  return book.chapters.flatMap((chapter, index) => {
    if (index < from.chapter) return [];
    const segments = compileItem({ id: book.id, title: chapter.title, sentences: chapter.sentences }, pattern);
    return segments
      .filter((segment) => index > from.chapter || !segment.part || segment.part.index >= from.sentence)
      // The chapter title is the context of its sentences. Not the progress of a text: the bookmark follows the book.
      .map(({ part, ...segment }): Segment => ({ ...segment, ...(part && { bookmark: { chapter: index, sentence: part.index } }) }));
  });
}
