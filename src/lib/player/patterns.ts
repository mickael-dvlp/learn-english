import type { ContentType } from "@/lib/content/schema";
import type { Lang } from "./types";

/**
 * Listening patterns, as data. Adding a pattern = adding an entry here; the player is untouched.
 *
 * Text templates use `{field}` placeholders resolved on the content item, e.g. `{en}`,
 * `{title.fr}`, `{example.en}`. `{a|b}` takes the first field that exists. On a list,
 * `{words.en}` joins the values with " / " ("ship / sheep").
 * If a placeholder is missing (optional field), the step is skipped, along with the pause after it.
 */
export type StepTemplate =
  /**
   * Say a text. `voiceFrom` names a field (`speaker`) whose values alternate between the usual
   * voice and the second one, in order of appearance: two speakers, two voices.
   */
  | {
      say: string;
      lang: Lang;
      rate?: number;
      voiceFrom?: string;
      /** Said instead of `say` when it resolves (a verb whose forms read differently: « read, red, red »). */
      prefer?: string;
    }
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
  /**
   * For an item made of parts (sentences, examples): share of them to hear for the item to count
   * as listened (1 = all, the default).
   */
  listenedRatio?: number;
};

/** English, French, English again: one sentence of a list. */
const EN_FR_EN: StepTemplate[] = [
  { say: "{en}", lang: "en" },
  { pause: 1 },
  { say: "{fr}", lang: "fr" },
  { pause: 1 },
  { say: "{en}", lang: "en" },
  { pause: 1.5 },
];

export const PATTERNS: Pattern[] = [
  {
    id: "en-fr-en",
    name: "Anglais → français → anglais",
    description: "Le mot en anglais, sa traduction, puis encore l'anglais.",
    appliesTo: ["word"],
    display: "{en} — {fr}",
    steps: [
      { say: "{speakEn|en}", lang: "en" },
      { pause: 1 },
      { say: "{fr}", lang: "fr" },
      { pause: 1 },
      { say: "{speakEn|en}", lang: "en" },
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
      { say: "{speakEn|en}", lang: "en" },
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
      { say: "{base}, {past}, {pastParticiple}", prefer: "{speak}", lang: "en" },
      { pause: 1 },
      { say: "{fr}", lang: "fr" },
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
          { say: "{en}", lang: "en", rate: 0.85, voiceFrom: "speaker" },
          { pause: 1 },
          { say: "{fr}", lang: "fr" },
          { pause: 1.5 },
        ],
      },
    ],
  },
  {
    id: "text-en-fr-en",
    name: "Anglais → français → anglais",
    description: "Chaque phrase ou réplique en anglais, sa traduction, puis encore l'anglais.",
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
          { say: "{en}", lang: "en", rate: 0.85, voiceFrom: "speaker" },
          { pause: 1 },
          { say: "{fr}", lang: "fr" },
          { pause: 1 },
          { say: "{en}", lang: "en", rate: 0.85, voiceFrom: "speaker" },
          { pause: 1.5 },
        ],
      },
    ],
  },
  {
    id: "text-en-only",
    name: "Anglais seulement",
    description: "Uniquement l'anglais, phrase après phrase, sans traduction.",
    appliesTo: ["text"],
    display: "{title.en}",
    steps: [
      { say: "{title.en}", lang: "en" },
      { pause: 1.5 },
      {
        each: "sentences",
        segment: { label: "{en}" },
        steps: [
          { say: "{en}", lang: "en", rate: 0.85, voiceFrom: "speaker" },
          { pause: 1.5 },
        ],
      },
    ],
  },
  {
    // Rules are heard through their sentences: the name of the rule, never its explanation.
    id: "rule",
    name: "Anglais → français → anglais",
    description: "Le nom de la règle et son sens, puis chaque phrase : anglais, français, anglais.",
    appliesTo: ["rule"],
    display: "{title.fr}",
    listenedRatio: 0.6,
    steps: [
      // English name, then what it is for in French (`meaning`, French only).
      { say: "{title.en}", lang: "en" },
      { pause: 0.5 },
      { say: "{meaning|title.fr}", lang: "fr" },
      { pause: 1 },
      { each: "forms", segment: { label: "{en}" }, steps: EN_FR_EN },
      { each: "examples", segment: { label: "{en}" }, steps: EN_FR_EN },
    ],
  },
  {
    id: "rule-en-only",
    name: "Anglais seulement",
    description: "Les phrases de la règle en anglais seulement.",
    appliesTo: ["rule"],
    display: "{title.fr}",
    listenedRatio: 0.6,
    steps: [
      { say: "{title.en}", lang: "en" },
      { pause: 1 },
      { each: "forms", segment: { label: "{en}" }, steps: [{ say: "{en}", lang: "en" }, { pause: 1.5 }] },
      { each: "examples", segment: { label: "{en}" }, steps: [{ say: "{en}", lang: "en" }, { pause: 1.5 }] },
    ],
  },
  {
    id: "pair-once",
    name: "Les mots l'un après l'autre",
    description: "Le premier mot, une courte pause, le second, puis une pause plus longue.",
    appliesTo: ["pair"],
    display: "{words.en}",
    steps: [{ each: "words", steps: [{ say: "{en}", lang: "en" }, { pause: 0.6 }] }, { pause: 2 }],
  },
  {
    id: "pair-twice",
    name: "Deux fois de suite",
    description: "Les mots l'un après l'autre, deux fois, pour bien entendre la différence.",
    appliesTo: ["pair"],
    display: "{words.en}",
    steps: [
      { each: "words", steps: [{ say: "{en}", lang: "en" }, { pause: 0.6 }] },
      { pause: 1 },
      { each: "words", steps: [{ say: "{en}", lang: "en" }, { pause: 0.6 }] },
      { pause: 2 },
    ],
  },
];

export function patternsFor(type: ContentType): Pattern[] {
  return PATTERNS.filter((pattern) => pattern.appliesTo.includes(type));
}

export function findPattern(id: string): Pattern | undefined {
  return PATTERNS.find((pattern) => pattern.id === id);
}

/**
 * The pattern to use for a type: the chosen one, or the one with the same name for this type
 * ("Anglais seulement" chosen for words also applies to dialogues), or the first one.
 */
export function choosePattern(type: ContentType, chosenId: string | undefined): Pattern {
  const patterns = patternsFor(type);
  const chosen = chosenId === undefined ? undefined : findPattern(chosenId);
  return (
    patterns.find((pattern) => pattern.id === chosen?.id) ??
    patterns.find((pattern) => pattern.name === chosen?.name) ??
    patterns[0]
  );
}
