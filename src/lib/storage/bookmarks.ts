import { z } from "zod";
import type { BookPosition } from "@/lib/content/book";
import { createLocalStore } from "./local-store";

/**
 * One bookmark per book (by id), shared by reading (Study) and listening (Listen): « Reprendre »
 * starts again from it, and the home page offers to continue the book read last.
 */

const BookmarkSchema = z.object({
  chapter: z.number().int().min(0),
  sentence: z.number().int().min(0),
  /** When it last moved: the most recent bookmark wins when merging a backup. */
  at: z.number(),
});

export const BookmarksSchema = z.record(z.string(), BookmarkSchema);

export type Bookmark = z.infer<typeof BookmarkSchema>;
export type Bookmarks = z.infer<typeof BookmarksSchema>;

export const bookmarksStore = createLocalStore<Bookmarks>("book-bookmarks", BookmarksSchema, {});

/** Moves the bookmark of a book (no write when it is already there). */
export function setBookmark(bookId: string, position: BookPosition): void {
  const bookmarks = bookmarksStore.get();
  const next = withBookmark(bookmarks, bookId, position, Date.now());
  if (next !== bookmarks) bookmarksStore.set(next);
}

export function withBookmark(bookmarks: Bookmarks, bookId: string, { chapter, sentence }: BookPosition, at: number): Bookmarks {
  const current = bookmarks[bookId];
  if (current?.chapter === chapter && current.sentence === sentence) return bookmarks;
  return { ...bookmarks, [bookId]: { chapter, sentence, at } };
}

/** For each book, the bookmark that moved last. */
export function mergeBookmarks(current: Bookmarks, incoming: Bookmarks): Bookmarks {
  const merged: Bookmarks = { ...current };
  for (const [id, bookmark] of Object.entries(incoming)) {
    if (!merged[id] || bookmark.at > merged[id].at) merged[id] = bookmark;
  }
  return merged;
}

/** The book read or listened to last, among those that still exist. */
export function lastBookmark(bookmarks: Bookmarks, bookIds: readonly string[]): [string, Bookmark] | undefined {
  return Object.entries(bookmarks)
    .filter(([id]) => bookIds.includes(id))
    .sort(([, a], [, b]) => b.at - a.at)[0];
}
