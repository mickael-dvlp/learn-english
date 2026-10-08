import type { ContentItem, ContentType } from "./schema";
import type { ContentLibrary } from "./validate";

/**
 * A set of items of the same type, used by both modes: what you listen to, what you study.
 * The id is URL-safe (it is also the study page slug).
 */
export type Collection = {
  id: string;
  type: ContentType;
  label: string;
  items: ContentItem[];
};

export const COLLECTION_GROUPS: { type: ContentType; label: string }[] = [
  { type: "word", label: "Mots" },
  { type: "verb", label: "Verbes" },
  { type: "rule", label: "Règles" },
  { type: "text", label: "Textes" },
];

/** Derived from the content: new themes or texts show up automatically. Empty collections are left out. */
export function listCollections(library: ContentLibrary): Collection[] {
  const collections: Collection[] = [
    ...library.themes.map((theme) => ({
      id: `theme-${theme.id}`,
      type: "word" as const,
      label: `${theme.emoji ? `${theme.emoji} ` : ""}${theme.name.fr}`,
      items: library.words.filter((word) => word.theme === theme.id),
    })),
    { id: "verbs-all", type: "verb", label: "Tous les verbes", items: library.verbs },
    {
      id: "verbs-irregular",
      type: "verb",
      label: "Verbes irréguliers",
      items: library.verbs.filter((verb) => !verb.regular),
    },
    {
      id: "verbs-regular",
      type: "verb",
      label: "Verbes réguliers",
      items: library.verbs.filter((verb) => verb.regular),
    },
    { id: "rules-all", type: "rule", label: "Toutes les règles", items: library.rules },
    ...library.texts.map((text) => ({
      id: text.id,
      type: "text" as const,
      label: text.title.fr,
      items: [text],
    })),
  ];
  return collections.filter((collection) => collection.items.length > 0);
}
