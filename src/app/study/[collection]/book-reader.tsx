"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";
import { SpeakButton } from "@/components/speak-button";
import { cardClass, focusRing, primaryButtonClass } from "@/components/ui";
import { BOOK_START, bookProgress, clampPosition, isFinished, nextPosition, positionLabel, type BookPosition } from "@/lib/content/book";
import type { Book } from "@/lib/content/schema";
import { plural } from "@/lib/format";
import { SLOW_RATE } from "@/lib/player/patterns";
import { useSpeakSequence } from "@/lib/speech/sequence";
import { openAccordion } from "@/lib/storage/accordion";
import { bookmarksStore, setBookmark } from "@/lib/storage/bookmarks";
import { useLocalStore } from "@/lib/storage/local-store";
import { listenTo } from "@/lib/storage/preferences";
import { markSeen } from "@/lib/storage/progress";
import { closeHash, openHash, replaceHash, useHash } from "./use-hash";

type Props = { book: Book; collectionId: string; familyId: string };

/** « #chapitre-3 », « #chapitre-3-phrase-12 » (numbers from 1, as shown). */
const chapterHash = (chapter: number, sentence?: number) =>
  `chapitre-${chapter + 1}${sentence === undefined ? "" : `-phrase-${sentence + 1}`}`;

function parseChapterHash(hash: string, book: Book): { chapter: number; sentence?: number } | undefined {
  const match = /^chapitre-(\d+)(?:-phrase-(\d+))?$/.exec(hash);
  if (!match) return undefined;
  const chapter = Number(match[1]) - 1;
  if (chapter < 0 || chapter >= book.chapters.length) return undefined;
  const sentence = match[2] === undefined ? undefined : clampPosition(book, { chapter, sentence: Number(match[2]) - 1 }).sentence;
  return { chapter, sentence };
}

/**
 * A book: its bookmark (shared with Listen) and « Reprendre », its chapters; a chapter opened by
 * the address (#chapitre-3), so that the phone's back button comes back to the contents.
 */
export function BookReader({ book, collectionId, familyId }: Props) {
  const hash = useHash();
  const bookmarks = useLocalStore(bookmarksStore);
  const saved = bookmarks[book.id] ? clampPosition(book, bookmarks[book.id]) : undefined;

  useEffect(() => markSeen(book.id), [book.id]);
  // Back on the study page, the family of this book is the open one.
  useEffect(() => openAccordion("study", familyId), [familyId]);

  const target = parseChapterHash(hash, book);
  if (target) return <ChapterView key={target.chapter} book={book} index={target.chapter} focus={target.sentence} saved={saved} />;
  return <BookHome book={book} collectionId={collectionId} saved={saved} />;
}

function BookHome({ book, collectionId, saved }: { book: Book; collectionId: string; saved: BookPosition | undefined }) {
  const finished = saved !== undefined && isFinished(book, saved);
  const started = saved !== undefined && !finished;
  const { done, total } = bookProgress(book, saved ?? BOOK_START);

  const read = () => {
    if (started) return openHash(chapterHash(saved.chapter, saved.sentence));
    // Not started, or finished: from the start (the bookmark goes back there).
    setBookmark(book.id, BOOK_START);
    openHash(chapterHash(0));
  };

  return (
    <Page>
      <PageHeader title={book.title.en} backHref="/study" backLabel="Retour à Étudier" />
      <div className="-mt-3 flex flex-col gap-1">
        {book.title.fr && <p className="text-muted">{book.title.fr}</p>}
        {book.author && <p className="text-sm text-muted">{book.author}</p>}
      </div>
      {book.description && <p className="leading-relaxed">{book.description}</p>}

      <section aria-label="Marque-page" className={`${cardClass} flex-col gap-3 py-4`}>
        <p className="text-lg">
          <span aria-hidden>🔖 </span>
          {saved ? positionLabel(book, saved) : "Pas encore commencé"}
        </p>
        <span className="flex flex-col gap-1.5 text-sm text-muted">
          {done} / {plural(total, "phrase")}
          <span className="h-1 overflow-hidden rounded-full bg-background">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${(done / total) * 100}%` }} />
          </span>
        </span>
        <button type="button" onClick={read} className={primaryButtonClass}>
          {started ? "Reprendre la lecture" : finished ? "Relire depuis le début" : "Commencer la lecture"}
        </button>
        <Link
          href="/listen"
          onClick={() => listenTo(collectionId)}
          className={`flex min-h-14 items-center justify-center rounded-3xl bg-background text-lg font-semibold ${focusRing}`}
        >
          🎧 {started ? "Reprendre en écoutant" : "Écouter le livre"}
        </Link>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Chapitres</h2>
        <ol className="flex flex-col gap-2">
          {book.chapters.map((chapter, index) => {
            const state =
              saved && (finished || index < saved.chapter)
                ? "lu"
                : saved?.chapter === index
                  ? `en cours, phrase ${saved.sentence + 1} sur ${chapter.sentences.length}`
                  : plural(chapter.sentences.length, "phrase");
            return (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => openHash(chapterHash(index))}
                  className={`${cardClass} w-full items-center gap-3 text-left`}
                >
                  <span className="w-6 shrink-0 text-muted tabular-nums">{index + 1}</span>
                  <span className="flex flex-1 flex-col">
                    <span lang="en" className="text-lg">
                      {chapter.title.en}
                    </span>
                    <span className="text-sm text-muted">{chapter.title.fr ? `${chapter.title.fr} · ${state}` : state}</span>
                  </span>
                  {state === "lu" && (
                    <span aria-hidden className="text-accent">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </Page>
  );
}

type ChapterProps = { book: Book; index: number; focus: number | undefined; saved: BookPosition | undefined };

/**
 * One chapter, sentence by sentence (translation that can be hidden, 🔊 each, the chapter read in a
 * row). The bookmark follows the reading: the sentence at the top of the screen once the reader
 * scrolls, the sentence after the one just heard, the next chapter when moving on.
 */
function ChapterView({ book, index, focus, saved }: ChapterProps) {
  const chapter = book.chapters[index];
  const [showTranslation, setShowTranslation] = useState(true);
  const sequence = useSpeakSequence();
  // First sentence of the reading in a row (the bookmark moves meanwhile).
  const [readFrom, setReadFrom] = useState(0);
  const lines = useRef<(HTMLLIElement | null)[]>([]);
  const reading = useRef(false);
  useEffect(() => {
    reading.current = sequence.playing;
  }, [sequence.playing]);
  const bookmarkHere = saved?.chapter === index ? saved.sentence : undefined;
  const hasTranslation = chapter.sentences.some((sentence) => sentence.fr);
  const last = index === book.chapters.length - 1;

  // Opened on a sentence (« Reprendre »): it comes to the top of the screen; otherwise the chapter starts at the top.
  useEffect(() => {
    if (focus !== undefined) lines.current[focus]?.scrollIntoView({ block: "start" });
    else window.scrollTo(0, 0);
  }, [focus]);

  useEffect(() => {
    // Only the reader's own scrolling moves the bookmark (not opening the chapter, not « Reprendre »).
    let byReader = false;
    let frame = 0;
    const reader = () => {
      byReader = true;
    };
    const onScroll = () => {
      if (!byReader || reading.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = window.innerHeight * 0.25;
        const first = lines.current.findIndex((line) => line !== null && line.getBoundingClientRect().bottom > top);
        if (first >= 0) setBookmark(book.id, { chapter: index, sentence: first });
      });
    };
    const events = ["touchmove", "wheel", "keydown"] as const;
    for (const event of events) window.addEventListener(event, reader, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      for (const event of events) window.removeEventListener(event, reader);
      window.removeEventListener("scroll", onScroll);
    };
  }, [book.id, index]);

  const playFrom = (from: number) => {
    setReadFrom(from);
    sequence.start(
      chapter.sentences.slice(from).map((sentence) => ({ text: sentence.en, recording: SLOW_RATE })),
      {
        gapMs: 700,
        onLineEnd: (line) => {
          setBookmark(book.id, nextPosition(book, { chapter: index, sentence: from + line }));
          lines.current[from + line + 1]?.scrollIntoView({ block: "center", behavior: "smooth" });
        },
      },
    );
  };
  // The chapter read in a row: from the bookmark when it is in this chapter.
  const start = bookmarkHere ?? 0;
  const playing = sequence.current === null ? undefined : readFrom + sequence.current;

  const goTo = (chapterIndex: number) => {
    if (chapterIndex > index) setBookmark(book.id, { chapter: chapterIndex, sentence: 0 });
    replaceHash(chapterHash(chapterIndex));
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 pb-10 pt-6">
      <header className="flex items-center justify-between">
        <button type="button" onClick={closeHash} className={`-ml-2 rounded-full px-3 py-2 text-2xl ${focusRing}`} aria-label="Retour aux chapitres">
          ←
        </button>
        <span className="text-muted tabular-nums">
          Chapitre {index + 1} / {book.chapters.length}
        </span>
      </header>

      <div className="flex flex-col gap-1">
        <h1 lang="en" className="text-2xl font-semibold">
          {chapter.title.en}
        </h1>
        {chapter.title.fr && <p className="text-muted">{chapter.title.fr}</p>}
      </div>

      <button
        type="button"
        onClick={() => (sequence.playing ? sequence.stop() : playFrom(start))}
        className={`flex min-h-14 items-center justify-center rounded-3xl bg-accent text-lg font-semibold text-accent-foreground ${focusRing}`}
      >
        {sequence.playing ? "■ Arrêter la lecture" : start > 0 ? "▶ Écouter depuis le marque-page" : "▶ Écouter le chapitre"}
      </button>
      {hasTranslation && (
        <button
          type="button"
          aria-pressed={showTranslation}
          onClick={() => setShowTranslation(!showTranslation)}
          className={`min-h-12 rounded-2xl bg-surface px-4 ${focusRing}`}
        >
          {showTranslation ? "Masquer la traduction" : "Afficher la traduction"}
        </button>
      )}

      <ol className="flex flex-col gap-3">
        {chapter.sentences.map((sentence, line) => {
          const marked = bookmarkHere === line;
          return (
            <li
              key={line}
              ref={(element) => {
                lines.current[line] = element;
              }}
              aria-current={playing === line || undefined}
              className={`flex scroll-mt-4 items-center gap-3 rounded-2xl p-4 ${marked ? "bg-accent/10" : "bg-surface"} ${
                playing === line ? "ring-2 ring-inset ring-accent" : ""
              }`}
            >
              <div className="flex flex-1 flex-col gap-1">
                {marked && <p className="text-xs font-semibold text-accent">🔖 Marque-page</p>}
                <p lang="en" className="text-lg">
                  {sentence.en}
                </p>
                {showTranslation && sentence.fr && <p className="text-muted">{sentence.fr}</p>}
              </div>
              <SpeakButton text={sentence.en} recording={SLOW_RATE} label="Écouter la phrase" className="bg-background" />
            </li>
          );
        })}
      </ol>

      <nav className="flex gap-3">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => goTo(index - 1)}
          className={`min-h-16 flex-1 rounded-3xl bg-surface text-lg disabled:opacity-40 ${focusRing}`}
        >
          ← Précédent
        </button>
        <button
          type="button"
          onClick={() => {
            if (!last) return goTo(index + 1);
            // The end of the book: the bookmark says it is finished.
            setBookmark(book.id, nextPosition(book, { chapter: index, sentence: chapter.sentences.length - 1 }));
            closeHash();
          }}
          className={`min-h-16 flex-1 rounded-3xl bg-accent text-lg font-semibold text-accent-foreground ${focusRing}`}
        >
          {last ? "Terminer le livre" : "Chapitre suivant →"}
        </button>
      </nav>
    </main>
  );
}
