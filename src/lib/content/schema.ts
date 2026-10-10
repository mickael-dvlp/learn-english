import { z } from "zod";

/**
 * Content schemas. The TypeScript types used across the app are inferred
 * from these schemas, so the spec (CLAUDE.md §4) lives in a single place.
 */

const nonEmpty = z.string().trim().min(1);

const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Stable id of the form `<type>-<slug>`, e.g. `word-tractor`. */
const itemId = (type: string) =>
  z
    .string()
    .regex(
      new RegExp(`^${type}-[a-z0-9]+(?:-[a-z0-9]+)*$`),
      `l'id doit avoir la forme "${type}-<slug>" (minuscules, chiffres, tirets)`,
    );

export const BilingualSchema = z.strictObject({ en: nonEmpty, fr: nonEmpty });

/** No difficulty levels: personal app. `tags` are sub-categories (e.g. "cause" for a linking word). */
const common = {
  tags: z.array(nonEmpty).optional(),
};

/** Sections that are not word themes, placed in a family by `includes`. */
export const FAMILY_SECTIONS = ["verbs", "modals", "rules", "texts"] as const;

/** A family groups themes (and sections) on the study and listen screens. */
export const FamilySchema = z.strictObject({
  id: z.string().regex(slug, "l'id de famille doit être un slug (minuscules, chiffres, tirets)"),
  name: BilingualSchema,
  emoji: nonEmpty.optional(),
  includes: z.array(z.enum(FAMILY_SECTIONS)).optional(),
});

/** A sub-theme, shown as a filter inside a collection (never a third accordion level). */
export const GroupSchema = z.strictObject({
  id: z.string().regex(slug, "l'id de sous-thème doit être un slug (minuscules, chiffres, tirets)"),
  name: BilingualSchema,
  /** Ids of words of other themes also shown here: no copy, same id, so the same progress. */
  also: z.array(nonEmpty).optional(),
});

export const ThemeSchema = z.strictObject({
  id: z.string().regex(slug, "l'id de thème doit être un slug (minuscules, chiffres, tirets)"),
  name: BilingualSchema,
  emoji: nonEmpty.optional(),
  /** Id of a family of families.json. */
  family: nonEmpty,
  /** Sub-themes, in display order. When present, every item of the theme has a `group`. */
  groups: z.array(GroupSchema).optional(),
});

/** Sub-themes of the verbs (content/verb-groups.json) and of the rules and modals (content/rule-groups.json). */
export const VerbGroupSchema = GroupSchema.omit({ also: true });

export const WordSchema = z.strictObject({
  id: itemId("word"),
  type: z.literal("word"),
  theme: nonEmpty,
  en: nonEmpty,
  fr: nonEmpty,
  example: BilingualSchema.optional(),
  pos: z.enum(["noun", "verb", "adjective", "adverb", "other"]).optional(),
  speakEn: nonEmpty.optional(),
  /** Usage note shown on the card, never read aloud (« familier », « devant un adjectif »…). */
  note: nonEmpty.optional(),
  /** Sub-theme id, among the groups of its theme. */
  group: nonEmpty.optional(),
  ...common,
});

export const VerbSchema = z.strictObject({
  id: itemId("verb"),
  type: z.literal("verb"),
  base: nonEmpty,
  past: nonEmpty,
  pastParticiple: nonEmpty,
  fr: nonEmpty,
  regular: z.boolean(),
  /** Usage note shown on the card, never read aloud. */
  note: nonEmpty.optional(),
  /** What is said instead of the three written forms, when they read differently (« read, red, red »). */
  speak: nonEmpty.optional(),
  example: BilingualSchema.optional(),
  /** Sub-theme id, among content/verb-groups.json. */
  group: nonEmpty.optional(),
  ...common,
});

/** A sentence of a rule, labelled by its form: affirmative, negative or question. */
export const RuleFormSchema = z.strictObject({
  kind: z.enum(["affirmative", "negative", "question"]),
  en: nonEmpty,
  fr: nonEmpty,
});

export const RuleSchema = z
  .strictObject({
    id: itemId("rule"),
    type: z.literal("rule"),
    /** "modal": a modal or semi-modal verb, shown in its own section. */
    kind: z.enum(["conjugation", "special", "modal"]),
    title: BilingualSchema,
    /** Main use and its translation in context, e.g. "pouvoir, savoir (faire) : capacité". */
    meaning: nonEmpty.optional(),
    explanation: nonEmpty,
    /** Visual model, e.g. "sujet + can + verbe (base)". */
    structure: nonEmpty.optional(),
    /** Affirmative, negative and question forms, in this order. */
    forms: z.array(RuleFormSchema).optional(),
    examples: z.array(BilingualSchema).min(1),
    /** A frequent mistake: never read aloud, only the right form has a speak button. */
    mistake: z.strictObject({ wrong: nonEmpty, right: nonEmpty, note: nonEmpty.optional() }).optional(),
    tense: z.enum(["present", "past", "future", "other"]).optional(),
    /** Sub-theme id, among content/rule-groups.json. */
    group: nonEmpty.optional(),
    ...common,
  })
  .refine((rule) => rule.tense === undefined || rule.kind === "conjugation", {
    message: `"tense" n'est autorisé que pour kind = "conjugation"`,
    path: ["tense"],
  });

/** A sentence of a text; `speaker` names who talks in a dialogue (shown, not read aloud). */
export const SentenceSchema = z.strictObject({ en: nonEmpty, fr: nonEmpty, speaker: nonEmpty.optional() });

export const TextItemSchema = z
  .strictObject({
    id: itemId("text"),
    type: z.literal("text"),
    /** "story" by default; "dialogue": two speakers, every sentence names its speaker. */
    kind: z.enum(["story", "dialogue"]).optional(),
    title: BilingualSchema,
    /** The situation in a few words, in French. */
    situation: nonEmpty.optional(),
    theme: nonEmpty.optional(),
    sentences: z.array(SentenceSchema).min(1),
    /** Key expressions, shown after the text. */
    expressions: z.array(BilingualSchema).optional(),
    ...common,
  })
  .refine(
    (text) =>
      text.kind !== "dialogue" ||
      (text.sentences.every((sentence) => sentence.speaker) && new Set(text.sentences.map((s) => s.speaker)).size === 2),
    { message: "un dialogue a exactement deux interlocuteurs, et chaque réplique indique le sien (speaker)", path: ["sentences"] },
  );

/** One word of a pronunciation pair (or group of 3–4: -ed endings, word stress…). */
export const PairWordSchema = z.strictObject({
  /** What is said and shown: a word, or a short sentence for weak forms. */
  en: nonEmpty,
  fr: nonEmpty,
  /** British phonetic transcription, e.g. "/ʃɪp/". */
  ipa: nonEmpty.optional(),
  example: BilingualSchema.optional(),
});

/**
 * Words that sound alike, to be heard side by side (pronunciation theme). A future quiz plays
 * one of `words` and asks which one was heard.
 */
export const PairSchema = z.strictObject({
  id: itemId("pair"),
  type: z.literal("pair"),
  theme: nonEmpty,
  group: nonEmpty.optional(),
  words: z.array(PairWordSchema).min(2).max(4),
  /** What to listen for, in French. */
  explanation: nonEmpty,
  ...common,
});

export type Bilingual = z.infer<typeof BilingualSchema>;
export type Family = z.infer<typeof FamilySchema>;
export type FamilySection = (typeof FAMILY_SECTIONS)[number];
export type Group = z.infer<typeof GroupSchema>;
export type VerbGroup = z.infer<typeof VerbGroupSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type Word = z.infer<typeof WordSchema>;
export type Verb = z.infer<typeof VerbSchema>;
export type Rule = z.infer<typeof RuleSchema>;
export type RuleForm = z.infer<typeof RuleFormSchema>;
export type TextItem = z.infer<typeof TextItemSchema>;
export type Pair = z.infer<typeof PairSchema>;
export type PairWord = z.infer<typeof PairWordSchema>;
export type ContentItem = Word | Verb | Rule | TextItem | Pair;
export type ContentType = ContentItem["type"];
