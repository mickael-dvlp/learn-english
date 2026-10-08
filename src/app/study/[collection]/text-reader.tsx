"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SpeakButton } from "@/components/speak-button";
import type { TextItem } from "@/lib/content/schema";
import { setPreferences } from "@/lib/storage/preferences";
import { markSeen } from "@/lib/storage/progress";

export function TextReader({ text, collectionId }: { text: TextItem; collectionId: string }) {
  const [showTranslation, setShowTranslation] = useState(true);

  useEffect(() => markSeen(text.id), [text.id]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 pb-10 pt-6">
      <PageHeader title={text.title.en} backHref="/study" backLabel="Retour à Étudier" />
      <p className="-mt-3 text-muted">
        {text.title.fr} · {text.level}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={showTranslation}
          onClick={() => setShowTranslation(!showTranslation)}
          className="min-h-12 flex-1 rounded-2xl bg-surface px-4"
        >
          {showTranslation ? "Masquer la traduction" : "Afficher la traduction"}
        </button>
        <Link
          href="/listen"
          onClick={() => setPreferences({ sourceId: collectionId })}
          className="flex min-h-12 items-center rounded-2xl bg-accent px-4 font-semibold text-accent-foreground"
        >
          🎧 Écouter
        </Link>
      </div>

      <ol className="flex flex-col gap-3">
        {text.sentences.map((sentence) => (
          <li key={sentence.en} className="flex items-center gap-3 rounded-2xl bg-surface p-4">
            <div className="flex flex-1 flex-col gap-1">
              <p className="text-lg">{sentence.en}</p>
              {showTranslation && <p className="text-muted">{sentence.fr}</p>}
            </div>
            <SpeakButton text={sentence.en} className="bg-background" />
          </li>
        ))}
      </ol>
    </main>
  );
}
