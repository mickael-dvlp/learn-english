import type { ContentLibrary } from "@/lib/content/validate";
import { compileItem } from "@/lib/player/compile";
import { PATTERNS } from "@/lib/player/patterns";
import type { Lang } from "@/lib/player/types";
import { audioPath } from "./audio-files";

export type SpokenText = { lang: Lang; text: string; path: string };

/**
 * Every text the app can say: what the listening patterns produce for each item,
 * plus the examples read aloud in study mode. One entry per audio file.
 */
export function listSpokenTexts(library: ContentLibrary): SpokenText[] {
  const byPath = new Map<string, SpokenText>();
  const add = (lang: Lang, text: string) => {
    const path = audioPath(lang, text);
    if (!byPath.has(path)) byPath.set(path, { lang, text, path });
  };

  const items = [...library.words, ...library.verbs, ...library.rules, ...library.texts];
  for (const item of items) {
    for (const pattern of PATTERNS.filter((p) => p.appliesTo.includes(item.type))) {
      for (const segment of compileItem(item, pattern)) {
        for (const step of segment.steps) {
          if (step.kind !== "speak") continue;
          const text = step.unit[step.lang];
          if (text) add(step.lang, text);
        }
      }
    }
    if ((item.type === "word" || item.type === "verb") && item.example) add("en", item.example.en);
  }
  return [...byPath.values()];
}
