"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";
import { Slider } from "@/components/slider";
import { SpeakButton } from "@/components/speak-button";
import { cardClass, focusRing, primaryButtonClass } from "@/components/ui";
import { plural } from "@/lib/format";
import { buildQuiz, QUIZ_MAX_QUESTIONS, QUIZ_MIN_QUESTIONS, type QuizItem, type QuizQuestion, type QuizSide } from "@/lib/quiz/quiz";
import { useLocalStore } from "@/lib/storage/local-store";
import { preferencesStore, setPreferences } from "@/lib/storage/preferences";
import { markSeen } from "@/lib/storage/progress";

type Props = { collectionId: string; label: string; items: QuizItem[] };

/**
 * Written quiz of a theme: the number of questions first, then one word at a time (from English,
 * then from French), « Réponse » shows its translation, « Suivant » moves on.
 */
export function QuizScreen({ collectionId, label, items }: Props) {
  const prefs = useLocalStore(preferencesStore);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const backHref = `/study/${collectionId}`;

  const start = () => {
    setQuestions(buildQuiz(items, prefs.quizCount));
    setIndex(0);
    setRevealed(false);
  };

  if (!questions) {
    const noun = items[0]?.type === "verb" ? "verbe" : "mot";
    return (
      <Page>
        <PageHeader title="🎯 Quiz" backHref={backHref} backLabel="Retour au thème" />
        <div className="-mt-3 flex flex-col gap-1">
          <p className="text-lg">{label}</p>
          <p className="text-sm text-muted">{plural(items.length, noun)}</p>
        </div>
        <p className="leading-relaxed">
          Une question en anglais, la suivante en français. Cherche la traduction, puis touche « Réponse » pour la voir.
        </p>
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Combien de questions ?</h2>
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
          {prefs.quizCount > items.length && (
            <p className="text-sm text-muted">
              Le thème a {plural(items.length, noun)} : ils reviendront, remélangés, dans l&apos;autre sens aussi.
            </p>
          )}
        </section>
        <button type="button" onClick={start} className={`${primaryButtonClass} mt-auto`}>
          Commencer
        </button>
      </Page>
    );
  }

  if (index >= questions.length) {
    return (
      <Page className="items-center justify-center pb-10 text-center">
        <p className="text-5xl">🎯</p>
        <p className="text-2xl font-semibold">Quiz terminé</p>
        <p className="text-muted">
          {plural(questions.length, "question")} · {label}
        </p>
        <button type="button" onClick={start} className={`${primaryButtonClass} mt-3`}>
          Recommencer
        </button>
        <Link href={backHref} className={`${cardClass} w-full items-center justify-center text-lg`}>
          Retour au thème
        </Link>
      </Page>
    );
  }

  return (
    <QuestionView
      question={questions[index]}
      number={index + 1}
      total={questions.length}
      revealed={revealed}
      onReveal={() => {
        setRevealed(true);
        markSeen(questions[index].itemId);
      }}
      onNext={() => {
        setIndex(index + 1);
        setRevealed(false);
      }}
      onQuit={() => setQuestions(null)}
    />
  );
}

type QuestionProps = {
  question: QuizQuestion;
  number: number;
  total: number;
  revealed: boolean;
  onReveal: () => void;
  onNext: () => void;
  onQuit: () => void;
};

function QuestionView({ question, number, total, revealed, onReveal, onNext, onQuit }: QuestionProps) {
  const action = useRef<HTMLButtonElement>(null);
  // The button that replaces the previous one takes the focus: Enter, Enter… with a keyboard.
  useEffect(() => action.current?.focus({ preventScroll: true }), [number, revealed]);

  return (
    <Page>
      <header className="flex min-h-12 items-center justify-between gap-3">
        <button type="button" onClick={onQuit} aria-label="Arrêter le quiz" className={`-ml-2 rounded-full px-3 py-2 text-2xl ${focusRing}`}>
          ←
        </button>
        <span className="text-muted tabular-nums" aria-label={`Question ${number} sur ${total}`}>
          {number} / {total}
        </span>
      </header>

      <div className="flex flex-1 flex-col justify-center gap-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          {question.prompt.lang === "en" ? "Traduis en français" : "Traduis en anglais"}
        </p>
        <Side side={question.prompt} big />
        <div aria-live="polite">
          {revealed && (
            <div className="flex flex-col gap-2 rounded-3xl bg-surface p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Réponse</p>
              <Side side={question.answer} />
            </div>
          )}
        </div>
      </div>

      <button ref={action} type="button" onClick={revealed ? onNext : onReveal} className={primaryButtonClass}>
        {revealed ? (number === total ? "Terminer" : "Suivant") : "Réponse"}
      </button>
    </Page>
  );
}

/** A word and, for the English side, its 🔊 (heard only on demand). A usage note goes with the French side. */
function Side({ side, big = false }: { side: QuizSide; big?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-1">
        <p lang={side.lang} className={big ? "text-4xl font-semibold wrap-break-word" : "text-2xl"}>
          {side.text}
        </p>
        {side.note && (
          <p className="text-sm text-muted">
            <span aria-hidden>ⓘ </span>
            {side.note}
          </p>
        )}
      </div>
      {side.lang === "en" && <SpeakButton text={side.spoken} className={big ? "" : "bg-background"} />}
    </div>
  );
}
