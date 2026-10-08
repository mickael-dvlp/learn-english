import type { ContentType } from "@/lib/content/schema";
import type { Lang } from "./types";

/**
 * Listening patterns, as data. Adding a pattern = adding an entry here; the player is untouched.
 *
 * Text templates use `{field}` placeholders resolved on the content item, e.g. `{en}`,
 * `{title.fr}`, `{example.en}`. `{a|b}` takes the first field that exists.
 * If a placeholder is missing (optional field), the step is skipped, along with the pause after it.
 */
export type StepTemplate =
  /** Say a text. `audio: true` uses the item's audio file for that language when it exists. */
  | { say: string; lang: Lang; rate?: number; audio?: boolean }
  /** Pause proportional to the last spoken text; the number scales it (1 = normal). */
  | { pause: number }
  /** Repeat steps for each element of a list field (`examples`, `sentences`…). */
  | {
      each: string;
      /** Each element becomes its own segment (navigation, end of timer), with this label. */
      segment?: { label: string };
      steps: StepTemplate[];
    };

export type Pattern = {
  id: string;
  name: string;
  description: string;
  appliesTo: ContentType[];
  /** Label shown while the item plays. */
  display: string;
  steps: StepTemplate[];
};

export const PATTERNS: Pattern[] = [
  {
    id: "en-fr-en",
    name: "Anglais → français → anglais",
    description: "Le mot en anglais, sa traduction, puis encore l'anglais.",
    appliesTo: ["word"],
    display: "{en} — {fr}",
    steps: [
      { say: "{speakEn|en}", lang: "en", audio: true },
      { pause: 1 },
      { say: "{fr}", lang: "fr", audio: true },
      { pause: 1 },
      { say: "{speakEn|en}", lang: "en", audio: true },
      { pause: 1.5 },
    ],
  },
  {
    id: "en-only-loop",
    name: "Anglais seulement",
    description: "Uniquement les mots anglais, en boucle.",
    appliesTo: ["word"],
    display: "{en}",
    steps: [
      { say: "{speakEn|en}", lang: "en", audio: true },
      { pause: 1.5 },
    ],
  },
  {
    id: "verb-forms",
    name: "Les trois formes",
    description: "« go, went, gone », puis la traduction.",
    appliesTo: ["verb"],
    display: "{base} – {past} – {pastParticiple}",
    steps: [
      { say: "{base}, {past}, {pastParticiple}", lang: "en", audio: true },
      { pause: 1 },
      { say: "{fr}", lang: "fr", audio: true },
      { pause: 1.5 },
    ],
  },
  {
    id: "text",
    name: "Phrase par phrase",
    description: "Chaque phrase lentement en anglais, puis sa traduction.",
    appliesTo: ["text"],
    display: "{title.en}",
    steps: [
      { say: "{title.en}", lang: "en" },
      { pause: 1 },
      { say: "{title.fr}", lang: "fr" },
      { pause: 1.5 },
      {
        each: "sentences",
        segment: { label: "{en}" },
        steps: [
          { say: "{en}", lang: "en", rate: 0.85 },
          { pause: 1 },
          { say: "{fr}", lang: "fr" },
          { pause: 1.5 },
        ],
      },
    ],
  },
  {
    id: "rule",
    name: "Règle et exemples",
    description: "Le titre et l'explication en français, puis les exemples.",
    appliesTo: ["rule"],
    display: "{title.fr}",
    steps: [
      { say: "{title.fr}", lang: "fr" },
      { pause: 0.5 },
      { say: "{explanation}", lang: "fr" },
      { pause: 0.5 },
      {
        each: "examples",
        steps: [
          { say: "{en}", lang: "en" },
          { pause: 1 },
          { say: "{fr}", lang: "fr" },
          { pause: 1 },
        ],
      },
      { pause: 1 },
    ],
  },
];

export function patternsFor(type: ContentType): Pattern[] {
  return PATTERNS.filter((pattern) => pattern.appliesTo.includes(type));
}

export function findPattern(id: string): Pattern | undefined {
  return PATTERNS.find((pattern) => pattern.id === id);
}
