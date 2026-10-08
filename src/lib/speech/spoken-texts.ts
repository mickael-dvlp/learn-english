import type { ContentLibrary } from "@/lib/content/validate";
import { compileItem } from "@/lib/player/compile";
import { PATTERNS } from "@/lib/player/patterns";
import type { Lang } from "@/lib/player/types";
import { audioPath } from "./audio-files";

export type SpokenText = { lang: Lang; text: string; rate: number; path: string };

/**
 * Every text the app can say, with its speed: what the listening patterns produce for each item,
 * plus what study mode reads aloud (examples, sentences at normal speed). One entry per audio file.
 */
export function listSpokenTexts(library: ContentLibrary): SpokenText[] {
  const byPath = new Map<string, SpokenText>();
  const add = (lang: Lang, text: string, rate = 1) => {
    const path = audioPath(lang, text, rate);
    if (!byPath.has(path)) byPath.set(path, { lang, text, rate, path });
  };

  const items = [...library.words, ...library.verbs, ...library.rules, ...library.texts];
  for (const item of items) {
    for (const pattern of PATTERNS.filter((p) => p.appliesTo.includes(item.type))) {
      for (const segment of compileItem(item, pattern)) {
        for (const step of segment.steps) {
          if (step.kind !== "speak") continue;
          const text = step.unit[step.lang];
          if (text) add(step.lang, text, step.rate);
        }
      }
    }
    // Study mode (speak buttons, normal speed).
    if ((item.type === "word" || item.type === "verb") && item.example) add("en", item.example.en);
    if (item.type === "text") for (const sentence of item.sentences) add("en", sentence.en);
  }
  return [...byPath.values()];
}
