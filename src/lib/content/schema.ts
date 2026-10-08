import { z } from "zod";

/**
 * Content schemas. The TypeScript types used across the app are inferred
 * from these schemas, so the spec (CLAUDE.md §4) lives in a single place.
 */

export const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
export const LevelSchema = z.enum(LEVELS);

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

/** Paths relative to /public/audio. */
export const AudioRefsSchema = z.strictObject({
  en: nonEmpty.optional(),
  fr: nonEmpty.optional(),
});

const common = {
  level: LevelSchema,
  tags: z.array(nonEmpty).optional(),
  audio: AudioRefsSchema.optional(),
};

export const ThemeSchema = z.strictObject({
  id: z.string().regex(slug, "l'id de thème doit être un slug (minuscules, chiffres, tirets)"),
  name: BilingualSchema,
  emoji: nonEmpty.optional(),
});

export const WordSchema = z.strictObject({
  id: itemId("word"),
  type: z.literal("word"),
  theme: nonEmpty,
  en: nonEmpty,
  fr: nonEmpty,
  example: BilingualSchema.optional(),
  pos: z.enum(["noun", "verb", "adjective", "adverb", "other"]).optional(),
  speakEn: nonEmpty.optional(),
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
  example: BilingualSchema.optional(),
  ...common,
});

export const RuleSchema = z
  .strictObject({
    id: itemId("rule"),
    type: z.literal("rule"),
    kind: z.enum(["conjugation", "special"]),
    title: BilingualSchema,
    explanation: nonEmpty,
    examples: z.array(BilingualSchema).min(1),
    tense: z.enum(["present", "past", "future", "other"]).optional(),
    ...common,
  })
  .refine((rule) => rule.tense === undefined || rule.kind === "conjugation", {
    message: `"tense" n'est autorisé que pour kind = "conjugation"`,
    path: ["tense"],
  });

export const TextItemSchema = z.strictObject({
  id: itemId("text"),
  type: z.literal("text"),
  title: BilingualSchema,
  theme: nonEmpty.optional(),
  sentences: z.array(BilingualSchema).min(1),
  ...common,
});

export type Level = z.infer<typeof LevelSchema>;
export type Bilingual = z.infer<typeof BilingualSchema>;
export type AudioRefs = z.infer<typeof AudioRefsSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type Word = z.infer<typeof WordSchema>;
export type Verb = z.infer<typeof VerbSchema>;
export type Rule = z.infer<typeof RuleSchema>;
export type TextItem = z.infer<typeof TextItemSchema>;
export type ContentItem = Word | Verb | Rule | TextItem;
export type ContentType = ContentItem["type"];
