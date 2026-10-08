import type { ContentItem, ContentType } from "@/lib/content/schema";
import type { ContentLibrary } from "@/lib/content/validate";

/** Something to listen to: a set of items of the same type. */
export type ListenSource = {
  id: string;
  type: ContentType;
  label: string;
  items: ContentItem[];
};

/** Every listenable source, derived from the content: new themes or texts show up automatically. */
export function listSources(library: ContentLibrary): ListenSource[] {
  const sources: ListenSource[] = [
    ...library.themes.map((theme) => ({
      id: `theme:${theme.id}`,
      type: "word" as const,
      label: `${theme.emoji ? `${theme.emoji} ` : ""}${theme.name.fr}`,
      items: library.words.filter((word) => word.theme === theme.id),
    })),
    { id: "verbs:all", type: "verb", label: "Tous les verbes", items: library.verbs },
    {
      id: "verbs:irregular",
      type: "verb",
      label: "Verbes irréguliers",
      items: library.verbs.filter((verb) => !verb.regular),
    },
    {
      id: "verbs:regular",
      type: "verb",
      label: "Verbes réguliers",
      items: library.verbs.filter((verb) => verb.regular),
    },
    { id: "rules:all", type: "rule", label: "Toutes les règles", items: library.rules },
    ...library.texts.map((text) => ({
      id: `text:${text.id}`,
      type: "text" as const,
      label: text.title.fr,
      items: [text],
    })),
  ];
  return sources.filter((source) => source.items.length > 0);
}
