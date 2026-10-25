"use client";

import Link from "next/link";
import { bookmarksStore, lastBookmark } from "@/lib/storage/bookmarks";
import { useLocalStore } from "@/lib/storage/local-store";

/** What the home page needs to know about a book. */
export type BookOutline = { id: string; title: string; chapters: number };

/**
 * « Continuer où j'en étais »: back to the book read or listened to last, at its bookmark
 * (or the first book, not started yet). Without any book, still to come.
 */
export function ContinueCard({ books, className }: { books: BookOutline[]; className: string }) {
  const bookmarks = useLocalStore(bookmarksStore);
  const last = lastBookmark(
    bookmarks,
    books.map((book) => book.id),
  );

  if (books.length === 0) {
    return (
      <button type="button" disabled className={`${className} bg-surface opacity-60`}>
        <span className="text-xl font-semibold">Continuer où j&apos;en étais</span>
        <span className="text-sm opacity-80">Reprendre un livre · bientôt</span>
      </button>
    );
  }

  const book = books.find((b) => b.id === last?.[0]) ?? books[0];
  const mark = last?.[1];
  const finished = mark !== undefined && mark.chapter >= book.chapters;
  const href = mark && !finished ? `/study/${book.id}#chapitre-${mark.chapter + 1}-phrase-${mark.sentence + 1}` : `/study/${book.id}`;
  const where = !mark ? "pas encore commencé" : finished ? "livre terminé" : `chapitre ${mark.chapter + 1}, phrase ${mark.sentence + 1}`;

  return (
    <Link href={href} className={`${className} bg-surface`}>
      <span className="text-xl font-semibold">{mark ? "Continuer où j'en étais" : "Commencer un livre"}</span>
      <span className="text-sm opacity-80">
        📚 {book.title} · {where}
      </span>
    </Link>
  );
}
