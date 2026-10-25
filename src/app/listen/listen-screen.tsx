"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Accordion } from "@/components/accordion";
import { FilterChips } from "@/components/filter-chips";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";
import { SelectCard } from "@/components/select-card";
import { Slider } from "@/components/slider";
import { cardClass, cardShape, focusRing, primaryButtonClass } from "@/components/ui";
import { familyCountLabel, familyTitle, itemsOf, type Collection, type FamilyHeading } from "@/lib/content/collections";
import { BOOK_START, clampPosition, isFinished, nextPosition, positionLabel } from "@/lib/content/book";
import type { Book, ContentType } from "@/lib/content/schema";
import { resolveSelection, selectionItems, selectionTitle, toggleSelection } from "@/lib/content/selection";
import { plural } from "@/lib/format";
import { bookSegments } from "@/lib/player/book";
import { createBrowserPlayer } from "@/lib/player/browser";
import { lapFactory } from "@/lib/player/compile";
import { choosePattern, patternsFor } from "@/lib/player/patterns";
import type { Player } from "@/lib/player/player";
import { playOnce, QUIZ_PATTERN_ID, quizSegments } from "@/lib/player/quiz";
import { buildQuiz, isQuizItem, QUIZ_MAX_QUESTIONS, QUIZ_MIN_QUESTIONS } from "@/lib/quiz/quiz";
import { preloadVoices } from "@/lib/speech/speak";
import { openAccordion, useAccordion } from "@/lib/storage/accordion";
import { bookmarksStore, setBookmark } from "@/lib/storage/bookmarks";
import { useLocalStore } from "@/lib/storage/local-store";
import { preferencesStore, setPreferences } from "@/lib/storage/preferences";
import { markListened, markPartListened } from "@/lib/storage/progress";
import { SessionView } from "./session-view";

const DURATIONS = [5, 10, 30];
const MAX_MINUTES = 600;

const SESSION_HASH = "#ecoute";

type Session = { player: Player; title: string; quiz: boolean };

export function ListenScreen({ families, sources }: { families: FamilyHeading[]; sources: Collection[] }) {
  const prefs = useLocalStore(preferencesStore);
  const bookmarks = useLocalStore(bookmarksStore);
  const [session, setSession] = useState<Session | null>(null);
  const [durationDraft, setDurationDraft] = useState<string | null>(null);
  // One or several collections of the same type (fruits and vegetables), in display order.
  const selection = resolveSelection(sources, prefs.sourceIds);
  const selectedFamilyId = selection[0]?.familyId;
  const [openFamilyId, setOpenFamilyId] = useAccordion("listen", selectedFamilyId ?? null);

  useEffect(preloadVoices, []);
  // Whatever gets focus or is scrolled to stays above the fixed start button.
  useEffect(() => {
    const root = document.documentElement;
    root.style.scrollPaddingBottom = "10rem";
    return () => {
      root.style.scrollPaddingBottom = "";
    };
  }, []);
  // The family of the selected content opens by itself. Closing it never changes the selection.
  useEffect(() => {
    if (selectedFamilyId) openAccordion("listen", selectedFamilyId);
  }, [selectedFamilyId]);

  // While listening, the address ends with #ecoute: the phone's back button closes the session
  // and comes back to these settings, instead of leaving the page.
  useEffect(() => {
    if (!session) {
      // Reloaded during a session: the session is gone, so is its history entry.
      if (window.location.hash === SESSION_HASH) {
        window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      }
      return;
    }
    if (window.location.hash !== SESSION_HASH) window.location.hash = SESSION_HASH;
    const onHashChange = () => {
      if (window.location.hash === SESSION_HASH) return;
      session.player.stop();
      setSession(null);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [session]);

  if (session) {
    const close = () => {
      // Going back removes the history entry; the hashchange above closes the session.
      if (window.location.hash === SESSION_HASH) window.history.back();
      else setSession(null);
    };
    return <SessionView player={session.player} title={session.title} quiz={session.quiz} onClose={close} />;
  }

  if (sources.length === 0) {
    return <p className="p-6">Aucun contenu à écouter pour l&apos;instant.</p>;
  }

  const type = selection[0].type;
  // Sub-themes and single rules: only when one collection is chosen.
  const single = selection.length === 1 ? selection[0] : undefined;
  const patterns = patternsFor(type);
  const pattern = choosePattern(type, prefs.patternId);
  const group = single?.groups?.find((g) => g.id === prefs.groupId);
  // Rules (and modals) can be listened to one by one.
  const ruleChoices = single?.type === "rule" ? itemsOf(single, group?.id).flatMap((i) => (i.type === "rule" ? [i] : [])) : [];
  const rule = ruleChoices.find((r) => r.id === prefs.itemId);
  const items = rule ? [rule] : selectionItems(selection, group?.id);
  // The quiz (words and verbs): a number of questions instead of a duration, always shuffled.
  const quizItems = items.filter(isQuizItem);
  const quiz = prefs.patternId === QUIZ_PATTERN_ID && quizItems.length > 0;
  // A book: from its bookmark (from the start once finished), or from the start of a chosen chapter.
  const book = single?.type === "book" ? single.items.find((item): item is Book => item.type === "book") : undefined;
  const saved = book && bookmarks[book.id] ? clampPosition(book, bookmarks[book.id]) : undefined;
  const bookStart =
    book && prefs.bookChapter !== undefined && prefs.bookChapter < book.chapters.length
      ? { chapter: prefs.bookChapter, sentence: 0 }
      : saved && book && !isFinished(book, saved)
        ? saved
        : BOOK_START;

  const createLap = () => {
    if (quiz) return playOnce(quizSegments(buildQuiz(quizItems, prefs.quizCount), prefs.quizAnswerSeconds * 1000));
    if (book) return playOnce(bookSegments(book, pattern, bookStart));
    return lapFactory(items, pattern, prefs.order);
  };

  const start = () => {
    const settings = { rate: prefs.rate, pauseFactor: prefs.pauseFactor };
    const player = createBrowserPlayer({
      // A quiz ends with its last question.
      durationMs: (quiz ? MAX_MINUTES : prefs.durationMinutes) * 60_000,
      settings,
      createLap: createLap(),
      onSegmentEnd: (segment) => {
        if (segment.bookmark && book) {
          // A sentence of the book heard to its end: the bookmark moves past it.
          const next = nextPosition(book, segment.bookmark);
          setBookmark(book.id, next);
          if (isFinished(book, next)) markListened(book.id);
        }
        // A sentence of a text counts on its own; the text is listened to once all of them are.
        else if (segment.part) markPartListened(segment.itemId, segment.part.index, segment.part.needed);
        else if (!segment.intro) markListened(segment.itemId);
      },
    });
    // Started from the click itself: browsers only allow audio after a user gesture.
    player.play();
    // A chosen chapter is for this session: the next one resumes from the bookmark.
    if (prefs.bookChapter !== undefined) setPreferences({ bookChapter: undefined });
    const part = rule?.title.fr ?? group?.label;
    const title = part && single ? `${single.label} · ${part}` : selectionTitle(selection);
    setSession({ player, title: quiz ? `🎯 Quiz · ${title}` : book ? `📚 ${title}` : title, quiz });
  };

  return (
    // Bottom space: the fixed start button (and its fade) never covers the last settings.
    <Page className="pb-44">
      <PageHeader title="Écouter" backHref="/" backLabel="Retour à l'accueil" />

      <div className="flex flex-col gap-8">
        <Section title="Quoi écouter ?">
          <p className="-mt-1 text-sm text-muted" aria-live="polite">
            {!single
              ? `${selection.length} choisis · ${countLabel(type, items.length)}`
              : book
                ? "Un livre s'écoute seul, à partir de ton marque-page."
                : "Touche d'autres thèmes du même genre pour les écouter ensemble."}
          </p>
          <Accordion
            idPrefix="listen"
            headingLevel={3}
            openId={openFamilyId}
            onOpenChange={setOpenFamilyId}
            sections={families
              .map((family) => ({ family, groupSources: sources.filter((s) => s.familyId === family.id) }))
              .filter(({ groupSources }) => groupSources.length > 0)
              .map(({ family, groupSources }) => {
                const chosenHere = selection.filter((s) => s.familyId === family.id).length;
                return {
                  id: family.id,
                  title: familyTitle(family),
                  meta: (
                    <>
                      {familyCountLabel(family, groupSources)}
                      {chosenHere > 0 && (
                        <>
                          <br />
                          <span className="text-xs text-accent">✓ {chosenHere > 1 ? `${chosenHere} sélectionnés` : "sélectionné"}</span>
                        </>
                      )}
                    </>
                  ),
                  content: groupSources.map((s) => (
                    <SelectCard
                      key={s.id}
                      selected={selection.includes(s)}
                      onClick={() => {
                        const sourceIds = toggleSelection(selection, s);
                        const unchanged = sourceIds.join() === selection.map((c) => c.id).join();
                        if (!unchanged) setPreferences({ sourceIds, groupId: undefined, itemId: undefined, bookChapter: undefined });
                      }}
                    >
                      {s.label}
                    </SelectCard>
                  )),
                };
              })}
          />
        </Section>

        {book && (
          <Section title="Où commencer ?">
            <SelectCard
              selected={prefs.bookChapter === undefined}
              description={saved && !isFinished(book, saved) ? positionLabel(book, saved) : saved ? "Livre terminé : il reprend au début" : "Au début du livre"}
              onClick={() => setPreferences({ bookChapter: undefined })}
            >
              🔖 Reprendre là où j&apos;en étais
            </SelectCard>
            <label
              className={`${cardShape} flex-col gap-2 ${prefs.bookChapter === undefined ? "bg-surface" : "bg-accent/15 ring-2 ring-inset ring-accent"}`}
            >
              <span className="text-lg">Au début d&apos;un chapitre</span>
              <select
                value={prefs.bookChapter ?? ""}
                onChange={(event) => setPreferences({ bookChapter: event.target.value === "" ? undefined : Number(event.target.value) })}
                className={`min-h-12 rounded-2xl bg-background px-3 text-base text-foreground ${focusRing}`}
              >
                <option value="">Choisir un chapitre…</option>
                {book.chapters.map((chapter, index) => (
                  <option key={index} value={index}>
                    {index + 1}. {chapter.title.en}
                  </option>
                ))}
              </select>
            </label>
          </Section>
        )}

        {single?.groups && single.groups.length > 1 && (
          <Section title="Quelle partie ?">
            <FilterChips
              label={`Sous-thèmes de ${single.label}`}
              options={single.groups}
              value={group?.id}
              onChange={(groupId) => setPreferences({ groupId, itemId: undefined })}
            />
          </Section>
        )}

        {ruleChoices.length > 1 && ruleChoices.length <= 15 && (
          <Section title="Quelle règle ?">
            <FilterChips
              label="Règle à écouter"
              options={ruleChoices.map((r) => ({ id: r.id, label: r.title.fr }))}
              value={rule?.id}
              onChange={(itemId) => setPreferences({ itemId })}
            />
          </Section>
        )}

        {(patterns.length > 1 || quizItems.length > 0) && (
          <Section title="Comment ?">
            {patterns.map((p) => (
              <SelectCard
                key={p.id}
                selected={!quiz && p.id === pattern.id}
                description={p.description}
                onClick={() => setPreferences({ patternId: p.id })}
              >
                {p.name}
              </SelectCard>
            ))}
            {quizItems.length > 0 && (
              <SelectCard
                selected={quiz}
                description="Le mot, un temps pour répondre à voix haute, puis la réponse. Une question en anglais, la suivante en français."
                onClick={() => setPreferences({ patternId: QUIZ_PATTERN_ID })}
              >
                🎯 Quiz
              </SelectCard>
            )}
          </Section>
        )}

        {quiz ? (
          <Section title="Combien de questions ?">
            <div className={`${cardClass} flex-col py-4`}>
              <Slider
                label="Nombre de questions"
                value={prefs.quizCount}
                min={QUIZ_MIN_QUESTIONS}
                max={QUIZ_MAX_QUESTIONS}
                step={5}
                display={`${prefs.quizCount} questions`}
                onChange={(quizCount) => setPreferences({ quizCount })}
              />
            </div>
          </Section>
        ) : (
          // A book is always heard in order.
          <DurationAndOrder draft={durationDraft} setDraft={setDurationDraft} showOrder={!book} />
        )}

        <Section title="Réglages">
          <div className={`${cardClass} flex-col gap-4 py-4`}>
            {quiz && (
              <Slider
                label="Temps pour répondre"
                value={prefs.quizAnswerSeconds}
                min={2}
                max={8}
                step={0.5}
                display={`${String(prefs.quizAnswerSeconds).replace(".", ",")} s`}
                onChange={(quizAnswerSeconds) => setPreferences({ quizAnswerSeconds })}
              />
            )}
            <Slider
              label="Vitesse de la voix"
              value={prefs.rate}
              min={0.6}
              max={1.2}
              step={0.05}
              display={`×${prefs.rate.toFixed(2).replace(".", ",")}`}
              onChange={(rate) => setPreferences({ rate })}
            />
            <Slider
              label="Longueur des pauses"
              value={prefs.pauseFactor}
              min={0.5}
              max={2.5}
              step={0.25}
              display={`×${prefs.pauseFactor.toFixed(2).replace(".", ",")}`}
              onChange={(pauseFactor) => setPreferences({ pauseFactor })}
            />
          </div>
        </Section>
      </div>

      {/* Same width as the page column; the fade lets clicks through, only the button catches them. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 bg-linear-to-t from-background via-background to-transparent pb-6 pt-8">
        <div className="mx-auto w-full max-w-md px-5">
          <button type="button" onClick={start} className={`${primaryButtonClass} pointer-events-auto`}>
            {quiz ? "Lancer le quiz" : "Lancer l'écoute"}
          </button>
        </div>
      </div>
    </Page>
  );
}

/** Session length and play order (not for a quiz: a number of questions, always shuffled). */
type DurationProps = { draft: string | null; setDraft: (draft: string | null) => void; showOrder: boolean };

function DurationAndOrder({ draft, setDraft, showOrder }: DurationProps) {
  const prefs = useLocalStore(preferencesStore);
  return (
    <>
      <Section title="Combien de temps ?">
        <div className="grid grid-cols-3 gap-2">
          {DURATIONS.map((minutes) => (
            <SelectCard
              key={minutes}
              compact
              selected={prefs.durationMinutes === minutes}
              onClick={() => setPreferences({ durationMinutes: minutes })}
            >
              {minutes} min
            </SelectCard>
          ))}
        </div>
        <label
          className={`${cardShape} items-center justify-between gap-3 ${
            DURATIONS.includes(prefs.durationMinutes) ? "bg-surface" : "bg-accent/15 ring-2 ring-inset ring-accent"
          }`}
        >
          <span className="text-lg">Autre durée</span>
          <span className="flex items-center gap-2 text-sm text-muted">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_MINUTES}
              // What is being typed (possibly empty) until the field is left; only valid values are kept.
              value={draft ?? prefs.durationMinutes}
              onChange={(event) => {
                setDraft(event.target.value);
                const minutes = Number(event.target.value);
                if (Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_MINUTES) setPreferences({ durationMinutes: minutes });
              }}
              onBlur={() => setDraft(null)}
              className={`w-20 rounded-2xl bg-background px-3 py-2 text-base text-foreground ${focusRing}`}
            />
            min
          </span>
        </label>
      </Section>

      {showOrder && (
        <Section title="Ordre">
          <div className="grid grid-cols-2 gap-2">
            <SelectCard compact selected={prefs.order === "sequential"} onClick={() => setPreferences({ order: "sequential" })}>
              Dans l&apos;ordre
            </SelectCard>
            <SelectCard compact selected={prefs.order === "random"} onClick={() => setPreferences({ order: "random" })}>
              Aléatoire
            </SelectCard>
          </div>
        </Section>
      )}
    </>
  );
}

const NOUNS: Record<ContentType, string> = { word: "mot", verb: "verbe", rule: "règle", text: "texte", pair: "exercice", book: "livre" };

/** "76 mots", "12 verbes". */
const countLabel = (type: ContentType, count: number) => plural(count, NOUNS[type]);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
