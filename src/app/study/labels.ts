import type { ContentItem, Word } from "@/lib/content/schema";

/** Part of speech shown on a card; "other" says nothing useful, so it is not shown. */
const POS_LABELS: Record<NonNullable<Word["pos"]>, string | undefined> = {
  noun: "nom",
  verb: "verbe",
  adjective: "adjectif",
  adverb: "adverbe",
  other: undefined,
};

/** Categories (tags) shown on a card. Unknown tags are shown as they are; "autre" is hidden. */
const TAG_LABELS: Record<string, string | undefined> = {
  cause: "cause et conséquence",
  autre: undefined,
};

/** Small labels of a word card: its part of speech, then its useful categories. */
export function wordBadges(word: Word): string[] {
  const tags = (word.tags ?? []).map((tag) => (tag in TAG_LABELS ? TAG_LABELS[tag] : tag));
  return [word.pos && POS_LABELS[word.pos], ...tags].filter((label): label is string => Boolean(label));
}

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
    case "pair":
      return { primary: item.words.map((word) => word.en).join(" / "), secondary: item.words.map((word) => word.fr).join(" / ") };
  }
}
