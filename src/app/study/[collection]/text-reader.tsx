"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";
import { SpeakButton } from "@/components/speak-button";
import { focusRing } from "@/components/ui";
import type { TextItem } from "@/lib/content/schema";
import { voicePicker } from "@/lib/player/compile";
import { useSpeakSequence } from "@/lib/speech/sequence";
import { useLocalStore } from "@/lib/storage/local-store";
import { setPreferences } from "@/lib/storage/preferences";
import { openAccordion } from "@/lib/storage/accordion";
import { markPartListened, markSeen, progressStore, textListening } from "@/lib/storage/progress";

type Props = { text: TextItem; collectionId: string; familyId: string };

/**
 * A text or a dialogue, in full: lines in order, speakers told apart, translation that can be
 * hidden, 🔊 per line (second speaker with the second voice) and the whole text read in a row.
 */
export function TextReader({ text, collectionId, familyId }: Props) {
  const [showTranslation, setShowTranslation] = useState(true);
  const progress = useLocalStore(progressStore);
  const sequence = useSpeakSequence();
  const isDialogue = text.kind === "dialogue";
  const voiceOf = voicePicker();
  const lines = text.sentences.map((sentence) => ({ ...sentence, voice: voiceOf(sentence.speaker) }));
  const { state, heard } = textListening(progress[text.id], lines.length);

  useEffect(() => markSeen(text.id), [text.id]);
  // Back on the study page, the family of this text is the open one.
  useEffect(() => openAccordion("study", familyId), [familyId]);

  const playAll = () =>
    sequence.start(
      lines.map((line) => ({ text: line.en, voice: line.voice })),
      // Each line heard to its end counts, as in the player.
      { gapMs: 700, onLineEnd: (index) => markPartListened(text.id, index, lines.length) },
    );

  return (
    <Page>
      <PageHeader title={text.title.en} backHref="/study" backLabel="Retour à Étudier" />
      <div className="-mt-3 flex flex-col gap-1">
        <p className="text-muted">{text.title.fr}</p>
        <p className="text-sm text-muted">
          {state === "full"
            ? "Écouté en entier"
            : state === "partial"
              ? `Écouté en partie : ${heard} / ${lines.length} ${isDialogue ? "répliques" : "phrases"}`
              : `${lines.length} ${isDialogue ? "répliques" : "phrases"}`}
        </p>
      </div>

      {text.situation && (
        <p className="rounded-2xl bg-surface px-4 py-3">
          <span className="font-semibold">Situation : </span>
          {text.situation}
        </p>
      )}

      <button
        type="button"
        onClick={() => (sequence.playing ? sequence.stop() : playAll())}
        className={`flex min-h-14 items-center justify-center rounded-3xl bg-accent text-lg font-semibold text-accent-foreground ${focusRing}`}
      >
        {sequence.playing ? "■ Arrêter la lecture" : `▶ Écouter ${isDialogue ? "le dialogue" : "le texte"} complet`}
      </button>

      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={showTranslation}
          onClick={() => setShowTranslation(!showTranslation)}
          className={`min-h-12 flex-1 rounded-2xl bg-surface px-4 ${focusRing}`}
        >
          {showTranslation ? "Masquer la traduction" : "Afficher la traduction"}
        </button>
        <Link
          href="/listen"
          onClick={() => setPreferences({ sourceId: collectionId, groupId: undefined, itemId: undefined })}
          className={`flex min-h-12 items-center rounded-2xl bg-surface px-4 font-semibold ${focusRing}`}
        >
          🎧 Mode Écouter
        </Link>
      </div>

      <ol className="flex flex-col gap-3">
        {lines.map((line, index) => {
          const second = line.voice === "alt";
          const playing = sequence.current === index;
          return (
            <li
              key={index}
              aria-current={playing || undefined}
              className={`flex items-center gap-3 rounded-2xl p-4 ${isDialogue ? (second ? "ml-6" : "mr-6") : ""} ${
                second ? "bg-accent/10" : "bg-surface"
              } ${playing ? "ring-2 ring-inset ring-accent" : ""}`}
            >
              <div className="flex flex-1 flex-col gap-1">
                {line.speaker && (
                  <p className={`text-sm font-semibold ${second ? "text-foreground" : "text-accent"}`}>{line.speaker}</p>
                )}
                <p className="text-lg">{line.en}</p>
                {showTranslation && <p className="text-muted">{line.fr}</p>}
              </div>
              <SpeakButton
                text={line.en}
                voice={line.voice}
                label={line.speaker ? `Écouter la réplique de ${line.speaker}` : "Écouter la phrase"}
                className="bg-background"
              />
            </li>
          );
        })}
      </ol>

      {text.expressions && text.expressions.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="mt-2 text-xl font-semibold">Expressions importantes</h2>
          <ul className="flex flex-col gap-2">
            {text.expressions.map((expression) => (
              <li key={expression.en} className="flex items-center gap-3 rounded-2xl bg-surface p-4">
                <div className="flex flex-1 flex-col gap-1">
                  <p className="text-lg">{expression.en}</p>
                  <p className="text-muted">{expression.fr}</p>
                </div>
                <SpeakButton text={expression.en} className="bg-background" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}
