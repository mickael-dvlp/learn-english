import type { ContentItem, Word } from "@/lib/content/schema";

export const POS_LABELS: Record<NonNullable<Word["pos"]>, string> = {
  noun: "nom",
  verb: "verbe",
  adjective: "adjectif",
  adverb: "adverbe",
  other: "autre",
};

/** Two lines describing an item in a list. */
export function itemSummary(item: ContentItem): { primary: string; secondary: string } {
  switch (item.type) {
    case "word":
      return { primary: item.en, secondary: item.fr };
    case "verb":
      return { primary: `${item.base} – ${item.past} – ${item.pastParticiple}`, secondary: item.fr };
    case "rule":
      return { primary: item.title.fr, secondary: item.title.en };
    case "text":
      return { primary: item.title.en, secondary: item.title.fr };
  }
}
