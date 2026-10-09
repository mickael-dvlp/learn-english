import { z } from "zod";
import {
  RuleSchema,
  TextItemSchema,
  ThemeSchema,
  VerbSchema,
  WordSchema,
  type Rule,
  type TextItem,
  type Theme,
  type Verb,
  type Word,
} from "./schema";

z.config(z.locales.fr());

/** A content file already read from disk (or built in a test). */
export type RawFile = { path: string; data: unknown };

export type RawContent = {
  themes: RawFile | undefined;
  words: RawFile[];
  verbs: RawFile[];
  rules: RawFile[];
  /** One text per file. */
  texts: RawFile[];
};

export type ContentLibrary = {
  themes: Theme[];
  words: Word[];
  verbs: Verb[];
  rules: Rule[];
  texts: TextItem[];
};

export type ValidationResult = { library: ContentLibrary; errors: string[] };

/**
 * Validates raw content files and assembles the library.
 * Pure: no file system access, so it can be tested in isolation.
 */
export function validateContent(raw: RawContent): ValidationResult {
  const errors: string[] = [];

  const themes = raw.themes
    ? parseArray(raw.themes, ThemeSchema, errors)
    : (errors.push("themes.json est introuvable"), []);
  const themeIds = new Set(themes.map((theme) => theme.id));

  // words/<theme>.json: the file name is a theme of themes.json, and its words belong to that theme.
  const words = raw.words.flatMap((file) => {
    const fileTheme = file.path.replace(/^.*\//, "").replace(/\.json$/, "");
    if (!themeIds.has(fileTheme)) {
      errors.push(`${file.path} : le thème "${fileTheme}" n'existe pas dans themes.json`);
    }
    const fileWords = parseArray(file, WordSchema, errors);
    for (const word of fileWords) {
      if (word.theme !== fileTheme) {
        errors.push(`${file.path} › ${word.id} : thème "${word.theme}", attendu "${fileTheme}" (nom du fichier)`);
      }
    }
    return fileWords;
  });
  const verbs = raw.verbs.flatMap((file) => parseArray(file, VerbSchema, errors));
  const rules = raw.rules.flatMap((file) => parseArray(file, RuleSchema, errors));
  const texts = raw.texts.flatMap((file) => parseOne(file, TextItemSchema, errors));

  checkUniqueIds("de thème", themes, errors);
  checkUniqueIds("d'élément", [...words, ...verbs, ...rules, ...texts], errors);

  for (const item of [...words, ...texts]) {
    if (item.theme !== undefined && !themeIds.has(item.theme)) {
      errors.push(`${item.id} : le thème "${item.theme}" n'existe pas dans themes.json`);
    }
  }

  return { library: { themes, words, verbs, rules, texts }, errors };
}

function parseArray<T>(file: RawFile, schema: z.ZodType<T>, errors: string[]): T[] {
  if (!Array.isArray(file.data)) {
    errors.push(`${file.path} : le fichier doit contenir un tableau`);
    return [];
  }
  const items: T[] = [];
  file.data.forEach((entry: unknown, index) => {
    const label = `${file.path} › [${index}]${describeId(entry)}`;
    const result = schema.safeParse(entry);
    if (result.success) items.push(result.data);
    else errors.push(...formatIssues(label, result.error));
  });
  return items;
}

function parseOne<T>(file: RawFile, schema: z.ZodType<T>, errors: string[]): T[] {
  const result = schema.safeParse(file.data);
  if (result.success) return [result.data];
  errors.push(...formatIssues(`${file.path}${describeId(file.data)}`, result.error));
  return [];
}

function checkUniqueIds(kind: string, items: { id: string }[], errors: string[]) {
  const seen = new Set<string>();
  for (const { id } of items) {
    if (seen.has(id)) errors.push(`id ${kind} en double : "${id}"`);
    seen.add(id);
  }
}

function describeId(entry: unknown): string {
  if (typeof entry === "object" && entry !== null && "id" in entry) {
    const id = (entry as { id: unknown }).id;
    if (typeof id === "string") return ` (${id})`;
  }
  return "";
}

function formatIssues(label: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const field = issue.path.length > 0 ? ` › ${issue.path.join(".")}` : "";
    return `${label}${field} : ${issue.message}`;
  });
}
