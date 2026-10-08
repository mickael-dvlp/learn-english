"use client";

import type { Lang } from "@/lib/player/types";
import { cancelSpeech, speak } from "@/lib/speech/speak";
import { preferencesStore } from "@/lib/storage/preferences";

type Props = { text: string; lang?: Lang; className?: string };

/** Says a text on tap, at the speed chosen in the listening settings. */
export function SpeakButton({ text, lang = "en", className = "" }: Props) {
  return (
    <button
      type="button"
      aria-label={lang === "en" ? "Écouter en anglais" : "Écouter en français"}
      onClick={(event) => {
        event.stopPropagation();
        cancelSpeech();
        void speak({ id: "study", [lang]: text }, lang, preferencesStore.get().rate);
      }}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-xl ${className}`}
    >
      🔊
    </button>
  );
}
