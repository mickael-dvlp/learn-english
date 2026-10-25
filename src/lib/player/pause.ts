import type { ListenSettings, Step } from "./types";

export const PAUSE_BASE_MS = 500;
export const PAUSE_PER_WORD_MS = 350;

export const DEFAULT_SETTINGS: ListenSettings = { rate: 0.9, pauseFactor: 1 };

/** Base duration + duration per word, scaled by the pattern and by the user setting; or the set length. */
export function pauseMs(step: Extract<Step, { kind: "pause" }>, settings: ListenSettings): number {
  if (step.ms !== undefined) return step.ms;
  return Math.round((PAUSE_BASE_MS + PAUSE_PER_WORD_MS * step.words) * step.scale * settings.pauseFactor);
}
