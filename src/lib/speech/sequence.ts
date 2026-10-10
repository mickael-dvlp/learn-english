"use client";

import { useEffect, useRef, useState } from "react";
import type { Voice } from "@/lib/player/types";
import { preferencesStore } from "@/lib/storage/preferences";
import { cancelSpeech, speak } from "./speak";

/** A line said in a sequence (study mode): a dialogue line, a word of a pair. */
export type SequenceLine = { text: string; voice?: Voice };

type Options = {
  gapMs?: number;
  /** Before each line. */
  onLine?: (index: number) => void;
  /** After each line said to its end (not when stopped). */
  onLineEnd?: (index: number) => void;
  /** At the end: `true` when every line was said, `false` when stopped. */
  onEnd?: (completed: boolean) => void;
};

let stopCurrent: (() => void) | undefined;

/** Stops the sequence being said, if any (a 🔊 button does it before speaking). */
export function stopSequence(): void {
  stopCurrent?.();
}

/**
 * Says lines one after another with `speak()`, in English, at the chosen speed.
 * Only one sequence at a time: starting one stops the previous one.
 */
export function speakSequence(lines: SequenceLine[], { gapMs = 500, onLine, onLineEnd, onEnd }: Options = {}): () => void {
  stopSequence();
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (stopCurrent === stop) stopCurrent = undefined;
    cancelSpeech();
    onEnd?.(false);
  };
  stopCurrent = stop;

  void (async () => {
    for (let index = 0; index < lines.length; index++) {
      if (stopped) return;
      onLine?.(index);
      const { text, voice } = lines[index];
      await speak({ id: "study", en: text }, "en", preferencesStore.get().rate, voice);
      if (stopped) return;
      onLineEnd?.(index);
      if (index < lines.length - 1) await new Promise((resolve) => setTimeout(resolve, gapMs));
    }
    if (stopped) return;
    stopped = true;
    if (stopCurrent === stop) stopCurrent = undefined;
    onEnd?.(true);
  })();
  return stop;
}

/** A sequence for a screen: the line being said (or null), start and stop. Stopped when leaving the screen. */
export function useSpeakSequence() {
  const [current, setCurrent] = useState<number | null>(null);
  const stopRef = useRef<() => void>(undefined);

  useEffect(() => () => stopRef.current?.(), []);

  const start = (lines: SequenceLine[], options: Omit<Options, "onLine"> = {}) => {
    stopRef.current = speakSequence(lines, {
      ...options,
      onLine: setCurrent,
      onEnd: (completed) => {
        setCurrent(null);
        options.onEnd?.(completed);
      },
    });
  };
  const stop = () => stopRef.current?.();
  return { current, playing: current !== null, start, stop };
}
