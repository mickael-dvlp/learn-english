export type Lang = "en" | "fr";

/** What `speak()` receives: the text to say, in one or both languages. */
export type PlayableUnit = {
  id: string;
  en?: string;
  fr?: string;
};

export type Step =
  | { kind: "speak"; unit: PlayableUnit; lang: Lang; rate: number }
  /** Pause proportional to the length of the text just spoken. */
  | { kind: "pause"; words: number; scale: number };

/**
 * Smallest unit for navigation (next / previous) and for the end of the session timer:
 * one word, one verb, one rule, one sentence of a text…
 */
export type Segment = {
  itemId: string;
  label: string;
  steps: Step[];
};

export type ListenSettings = {
  /** Speech rate multiplier (1 = normal). */
  rate: number;
  /** Pause length multiplier (1 = normal). */
  pauseFactor: number;
};
