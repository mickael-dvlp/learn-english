import { z } from "zod";
import {
  FAMILY_SECTIONS,
  FamilySchema,
  PairSchema,
  RuleSchema,
  TextItemSchema,
  ThemeSchema,
  VerbGroupSchema,
  VerbSchema,
  WordSchema,
  type Family,
  type Pair,
  type Rule,
  type TextItem,
  type Theme,
  type Verb,
  type VerbGroup,
  type Word,
} from "./schema";

z.config(z.locales.fr());

/** A content file already read from disk (or built in a test). */
export type RawFile = { path: string; data: unknown };

export type RawContent = {
  families: RawFile | undefined;
  themes: RawFile | undefined;
  words: RawFile[];
  verbs: RawFile[];
  rules: RawFile[];
  /** One text per file. */
  texts: RawFile[];
  /** pairs/<theme>.json: pronunciation pairs of a theme. */
  pairs: RawFile[];
  /** verb-groups.json (optional): sub-themes of the verbs. */
  verbGroups: RawFile | undefined;
  /** rule-groups.json (optional): sub-themes of the rules and modals. */
  ruleGroups: RawFile | undefined;
};

export type ContentLibrary = {
  families: Family[];
  themes: Theme[];
  words: Word[];
  verbs: Verb[];
  rules: Rule[];
  texts: TextItem[];
  pairs: Pair[];
  verbGroups: VerbGroup[];
  ruleGroups: VerbGroup[];
};

export type ValidationResult = { library: ContentLibrary; errors: string[] };

/**
 * Validates raw content files and assembles the library.
 * Pure: no file system access, so it can be tested in isolation.
 */
export function validateContent(raw: RawContent): ValidationResult {
  const errors: string[] = [];

  const families = raw.families
    ? parseArray(raw.families, FamilySchema, errors)
    : (errors.push("families.json est introuvable"), []);
  checkUniqueIds("de famille", families, errors);
  const familyIds = new Set(families.map((family) => family.id));
  // Verbs, rules and texts each appear in exactly one family.
  for (const section of FAMILY_SECTIONS) {
    const count = families.filter((family) => family.includes?.includes(section)).length;
    if (count !== 1) {
      errors.push(`families.json : la section "${section}" doit être incluse dans une seule famille (trouvée ${count} fois)`);
    }
  }

  const themes = raw.themes
    ? parseArray(raw.themes, ThemeSchema, errors)
    : (errors.push("themes.json est introuvable"), []);
  const themeIds = new Set(themes.map((theme) => theme.id));
  for (const theme of themes) {
    if (!familyIds.has(theme.family)) {
      errors.push(`themes.json › ${theme.id} : la famille "${theme.family}" n'existe pas dans families.json`);
    }
  }

  // words/<theme>.json and pairs/<theme>.json: the file name is a theme of themes.json,
  // and its items belong to that theme.
  const themed = <T extends { id: string; theme: string }>(files: RawFile[], schema: z.ZodType<T>) =>
    files.flatMap((file) => {
      const fileTheme = file.path.replace(/^.*\//, "").replace(/\.json$/, "");
      if (!themeIds.has(fileTheme)) {
        errors.push(`${file.path} : le thème "${fileTheme}" n'existe pas dans themes.json`);
      }
      const items = parseArray(file, schema, errors);
      for (const item of items) {
        if (item.theme !== fileTheme) {
          errors.push(`${file.path} › ${item.id} : thème "${item.theme}", attendu "${fileTheme}" (nom du fichier)`);
        }
      }
      return items;
    });
  const words = themed(raw.words, WordSchema);
  const pairs = themed(raw.pairs, PairSchema);
  const verbs = raw.verbs.flatMap((file) => parseArray(file, VerbSchema, errors));
  const rules = raw.rules.flatMap((file) => parseArray(file, RuleSchema, errors));
  const texts = raw.texts.flatMap((file) => parseOne(file, TextItemSchema, errors));
  const verbGroups = raw.verbGroups ? parseArray(raw.verbGroups, VerbGroupSchema, errors) : [];
  const ruleGroups = raw.ruleGroups ? parseArray(raw.ruleGroups, VerbGroupSchema, errors) : [];

  checkUniqueIds("de thème", themes, errors);
  checkUniqueIds("d'élément", [...words, ...verbs, ...rules, ...texts, ...pairs], errors);

  for (const item of [...words, ...texts]) {
    if (item.theme !== undefined && !themeIds.has(item.theme)) {
      errors.push(`${item.id} : le thème "${item.theme}" n'existe pas dans themes.json`);
    }
  }

  const wordIds = new Set(words.map((word) => word.id));
  for (const theme of themes) {
    const own = [...words, ...pairs].filter((item) => item.theme === theme.id);
    if (own.some((item) => item.type === "word") && own.some((item) => item.type === "pair")) {
      errors.push(`thème "${theme.id}" : des mots et des paires de prononciation ne peuvent pas être mélangés`);
    }
    checkGroups(`thème "${theme.id}"`, theme.groups, own, errors);
    // Words shown again in a sub-theme: they exist, belong to another theme and appear once.
    const seenAlso = new Set<string>();
    for (const id of (theme.groups ?? []).flatMap((group) => group.also ?? [])) {
      if (!wordIds.has(id)) errors.push(`thème "${theme.id}" › also : le mot "${id}" n'existe pas`);
      else if (own.some((item) => item.id === id)) errors.push(`thème "${theme.id}" › also : "${id}" est déjà dans ce thème`);
      if (seenAlso.has(id)) errors.push(`thème "${theme.id}" › also : "${id}" en double`);
      seenAlso.add(id);
    }
  }
  checkGroups("verbes", verbGroups.length > 0 ? verbGroups : undefined, verbs, errors);
  checkGroups("règles", ruleGroups.length > 0 ? ruleGroups : undefined, rules, errors);

  return { library: { families, themes, words, verbs, rules, texts, pairs, verbGroups, ruleGroups }, errors };
}

/** With sub-themes, every item has an existing one; without, none has one. */
function checkGroups(
  owner: string,
  groups: { id: string }[] | undefined,
  items: { id: string; group?: string }[],
  errors: string[],
) {
  if (!groups) {
    for (const item of items) {
      if (item.group !== undefined) errors.push(`${owner} › ${item.id} : sous-thème "${item.group}" sans liste de sous-thèmes`);
    }
    return;
  }
  checkUniqueIds(`de sous-thème (${owner})`, groups, errors);
  const ids = new Set(groups.map((group) => group.id));
  for (const item of items) {
    if (item.group === undefined) errors.push(`${owner} › ${item.id} : sous-thème manquant (group)`);
    else if (!ids.has(item.group)) errors.push(`${owner} › ${item.id} : le sous-thème "${item.group}" n'existe pas`);
  }
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
