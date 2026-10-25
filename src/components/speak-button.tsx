"use client";

import type { Lang, Voice } from "@/lib/player/types";
import { stopSequence } from "@/lib/speech/sequence";
import { cancelSpeech, speak } from "@/lib/speech/speak";
import { preferencesStore } from "@/lib/storage/preferences";
import { focusRing } from "./ui";

type Props = { text: string; lang?: Lang; voice?: Voice; label?: string; className?: string; recording?: number };

/** Says a text on tap, at the speed chosen in the listening settings (`recording`: the slow recording of a book sentence). */
export function SpeakButton({ text, lang = "en", voice, label, className = "", recording }: Props) {
  return (
    <button
      type="button"
      aria-label={label ?? (lang === "en" ? "Écouter en anglais" : "Écouter en français")}
      onClick={(event) => {
        event.stopPropagation();
        stopSequence();
        cancelSpeech();
        void speak({ id: "study", [lang]: text }, lang, preferencesStore.get().rate, voice, recording);
      }}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-xl ${focusRing} ${className}`}
    >
      🔊
    </button>
  );
}
