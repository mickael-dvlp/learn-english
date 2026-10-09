import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { validateContent, type ContentLibrary, type RawContent, type RawFile } from "./validate";

/**
 * Reads /content from disk. Server-only (build time, scripts).
 * Synchronous on purpose: Next.js includes sync file reads in the static shell.
 */

const DEFAULT_ROOT = path.join(process.cwd(), "content");

export function readRawContent(root: string = DEFAULT_ROOT): { raw: RawContent; errors: string[] } {
  const errors: string[] = [];
  // Content is only read at build time: keep Turbopack from tracing the whole project.
  const resolve = (relativePath: string) => path.join(/*turbopackIgnore: true*/ root, relativePath);

  const readJson = (relativePath: string): RawFile | undefined => {
    try {
      const text = readFileSync(resolve(relativePath), "utf-8");
      return { path: relativePath, data: JSON.parse(text) as unknown };
    } catch (error) {
      errors.push(`${relativePath} : JSON illisible (${(error as Error).message})`);
      return undefined;
    }
  };

  const readDir = (dir: string): RawFile[] => {
    const absolute = resolve(dir);
    if (!existsSync(absolute)) return [];
    return readdirSync(absolute)
      .filter((name) => name.endsWith(".json"))
      .sort()
      .flatMap((name) => readJson(`${dir}/${name}`) ?? []);
  };

  const raw: RawContent = {
    themes: existsSync(resolve("themes.json")) ? readJson("themes.json") : undefined,
    words: readDir("words"),
    verbs: readDir("verbs"),
    rules: readDir("rules"),
    texts: readDir("texts"),
  };
  return { raw, errors };
}

export function loadContent(root?: string): { library: ContentLibrary; errors: string[] } {
  const { raw, errors: readErrors } = readRawContent(root);
  const { library, errors } = validateContent(raw);
  return { library, errors: [...readErrors, ...errors] };
}

let cached: ContentLibrary | undefined;

/**
 * Validated library for the app. Throws if the content is invalid, which fails the build.
 * Kept in memory in production (content is fixed at build time); re-read on every request
 * in development, so that edited JSON files show up without restarting `npm run dev`.
 */
export function getContent(): ContentLibrary {
  if (cached && process.env.NODE_ENV === "production") return cached;
  const { library, errors } = loadContent();
  if (errors.length > 0) {
    throw new Error(`Contenu invalide :\n- ${errors.join("\n- ")}`);
  }
  cached = library;
  return library;
}
