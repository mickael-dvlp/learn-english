export type Lang = "en" | "fr";

/** The second voice of a language (second speaker of a dialogue); the usual voice when absent. */
export type Voice = "alt";

/** What `speak()` receives: the text to say, in one or both languages. */
export type PlayableUnit = {
  id: string;
  en?: string;
  fr?: string;
};

export type Step =
  | { kind: "speak"; unit: PlayableUnit; lang: Lang; rate: number; voice?: Voice }
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
  /** Name of the item the segment belongs to (dialogue title), for a segment of a list. */
  context?: string;
  /** Who is talking (dialogue line). */
  speaker?: string;
  /**
   * Position among the parts of the item (sentence 3 of 12): progress counts the parts heard,
   * and the item is listened to once `needed` of them are.
   */
  part?: { index: number; count: number; needed: number };
  /** Title segment of an item made of parts: hearing it alone does not count as listening. */
  intro?: boolean;
};

export type ListenSettings = {
  /** Speech rate multiplier (1 = normal). */
  rate: number;
  /** Pause length multiplier (1 = normal). */
  pauseFactor: number;
};
