import type { ContentLibrary } from "@/lib/content/validate";
import { bookSegments } from "@/lib/player/book";
import { compileItem, voicePicker } from "@/lib/player/compile";
import { PATTERNS } from "@/lib/player/patterns";
import type { Lang, Segment, Voice } from "@/lib/player/types";
import { audioPath } from "./audio-files";

export type SpokenText = { lang: Lang; text: string; rate: number; voice?: Voice; path: string };

/**
 * Every text the app can say, with its speed and voice: what the listening patterns produce for
 * each item, plus what study mode reads aloud (examples, sentences at normal speed). One entry per audio file.
 * A book is read in Study with its slow recordings: no third file per sentence.
 */
export function listSpokenTexts(library: ContentLibrary): SpokenText[] {
  const byPath = new Map<string, SpokenText>();
  const add = (lang: Lang, text: string, rate = 1, voice?: Voice) => {
    const path = audioPath(lang, text, rate, voice);
    if (!byPath.has(path)) byPath.set(path, { lang, text, rate, ...(voice && { voice }), path });
  };
  const addSegments = (segments: Segment[]) => {
    for (const segment of segments) {
      for (const step of segment.steps) {
        if (step.kind !== "speak") continue;
        const text = step.unit[step.lang];
        if (text) add(step.lang, text, step.rate, step.voice);
      }
    }
  };

  const items = [...library.words, ...library.verbs, ...library.rules, ...library.texts, ...library.pairs];
  for (const item of items) {
    for (const pattern of PATTERNS.filter((p) => p.appliesTo.includes(item.type))) addSegments(compileItem(item, pattern));
    // Study mode (speak buttons, normal speed).
    if ((item.type === "word" || item.type === "verb") && item.example) add("en", item.example.en);
    if (item.type === "text") {
      const voiceOf = voicePicker();
      for (const sentence of item.sentences) add("en", sentence.en, 1, voiceOf(sentence.speaker));
      for (const expression of item.expressions ?? []) add("en", expression.en);
    }
    if (item.type === "pair") for (const word of item.words) if (word.example) add("en", word.example.en);
    if (item.type === "rule" && item.mistake) add("en", item.mistake.right);
  }
  for (const book of library.books) {
    for (const pattern of PATTERNS.filter((p) => p.appliesTo.includes("book"))) addSegments(bookSegments(book, pattern));
  }
  return [...byPath.values()];
}
