import type { ContentItem, ContentType, Family, FamilySection, Group, VerbGroup } from "./schema";
import type { ContentLibrary } from "./validate";

/** A sub-theme of a collection: a filter in Study and Listen. */
export type CollectionGroup = { id: string; label: string; itemIds: string[] };

/**
 * A set of items of the same type, used by both modes: what you listen to, what you study.
 * The id is URL-safe (it is also the study page slug) and stable: progress and listening
 * preferences refer to it, so existing ids are never changed.
 */
export type Collection = {
  id: string;
  type: ContentType;
  label: string;
  /** Family it is shown under (families.json). */
  familyId: string;
  /** In display order: sub-theme by sub-theme when there are some. */
  items: ContentItem[];
  /** Sub-themes, when the theme (or the verbs) has some. */
  groups?: CollectionGroup[];
  /** Gathers items shown elsewhere (all the dialogues): not counted as a collection of its own. */
  aggregate?: true;
  /** For a single text: story or dialogue (family counts). */
  textKind?: "story" | "dialogue";
};

/** What the family counts need to know about a collection. */
export type CountedCollection = Pick<Collection, "aggregate" | "textKind">;

/** What the screens need to show a family heading. */
export type FamilyHeading = Pick<Family, "id" | "name" | "emoji" | "includes">;

/**
 * Every collection, in display order: family by family (families.json order); inside a family,
 * its sections (verbs, rules, texts) first, then its themes (themes.json order).
 * Derived from the content: new themes or texts show up automatically. Empty collections are left out.
 */
export function listCollections(library: ContentLibrary): Collection[] {
  const verbs = (id: string, label: string, familyId: string, items: ContentItem[]): Collection => ({
    id,
    type: "verb",
    label,
    familyId,
    ...grouped(items, library.verbGroups),
  });
  const dialogues = library.texts.filter((text) => text.kind === "dialogue");
  const textCollection = (text: (typeof library.texts)[number], familyId: string): Collection => ({
    id: text.id,
    type: "text",
    label: `${text.kind === "dialogue" ? "💬" : "📖"} ${text.title.fr}`,
    familyId,
    items: [text],
    textKind: text.kind ?? "story",
  });

  const sections: Record<FamilySection, (familyId: string) => Collection[]> = {
    verbs: (familyId) => [
      // Phrasal verbs are a theme of their own: this page holds the simple verbs.
      verbs("verbs-all", "⚡ Tous les verbes simples", familyId, library.verbs),
      verbs("verbs-irregular", "Verbes irréguliers", familyId, library.verbs.filter((verb) => !verb.regular)),
      verbs("verbs-regular", "Verbes réguliers", familyId, library.verbs.filter((verb) => verb.regular)),
    ],
    modals: (familyId) => [
      {
        id: "modals",
        type: "rule",
        label: "🧭 Verbes modaux et semi-modaux",
        familyId,
        ...grouped(library.rules.filter((rule) => rule.kind === "modal"), library.ruleGroups),
      },
    ],
    rules: (familyId) => [
      {
        id: "rules-all",
        type: "rule",
        label: "Toutes les règles",
        familyId,
        ...grouped(library.rules.filter((rule) => rule.kind !== "modal"), library.ruleGroups),
      },
    ],
    texts: (familyId) => [
      ...library.texts.filter((text) => text.kind !== "dialogue").map((text) => textCollection(text, familyId)),
      // Every dialogue in one session: random order shuffles the dialogues, never their lines.
      ...(dialogues.length > 1
        ? [{ id: "dialogues-all", type: "text" as const, label: "💬 Tous les dialogues", familyId, items: dialogues, aggregate: true as const }]
        : []),
      ...dialogues.map((text) => textCollection(text, familyId)),
    ],
  };

  const byId = new Map<string, ContentItem>(library.words.map((word) => [word.id, word]));
  return library.families
    .flatMap((family) => [
      ...(family.includes ?? []).flatMap((section) => sections[section](family.id)),
      ...library.themes
        .filter((theme) => theme.family === family.id)
        .map((theme): Collection => {
          const own = [...library.words, ...library.pairs].filter((item) => item.theme === theme.id);
          return {
            id: `theme-${theme.id}`,
            type: own[0]?.type ?? "word",
            label: `${theme.emoji ? `${theme.emoji} ` : ""}${theme.name.fr}`,
            familyId: family.id,
            ...grouped(own, theme.groups, byId),
          };
        }),
    ])
    .filter((collection) => collection.items.length > 0);
}

/**
 * Orders items sub-theme by sub-theme, each followed by the words it borrows from other themes (`also`).
 * Without sub-themes, items keep their order. Empty sub-themes are left out.
 */
function grouped(
  items: ContentItem[],
  groups: (Group | VerbGroup)[] | undefined,
  byId: Map<string, ContentItem> = new Map(),
): Pick<Collection, "items" | "groups"> {
  if (!groups || groups.length === 0) return { items };
  const result = groups
    .map((group) => {
      const own = items.filter((item) => "group" in item && item.group === group.id);
      const borrowed = ("also" in group ? (group.also ?? []) : []).flatMap((id) => byId.get(id) ?? []);
      return { group, items: [...own, ...borrowed] };
    })
    .filter((entry) => entry.items.length > 0);
  return {
    items: result.flatMap((entry) => entry.items),
    groups: result.map(({ group, items: groupItems }) => ({
      id: group.id,
      label: group.name.fr,
      itemIds: groupItems.map((item) => item.id),
    })),
  };
}

/** Items of a collection, restricted to one sub-theme (all of them when there is none or it is unknown). */
export function itemsOf(collection: Collection, groupId: string | undefined): ContentItem[] {
  const group = collection.groups?.find((g) => g.id === groupId);
  if (!group) return collection.items;
  const ids = new Set(group.itemIds);
  return collection.items.filter((item) => ids.has(item.id));
}

export function familyHeadings(library: ContentLibrary): FamilyHeading[] {
  return library.families.map(({ id, name, emoji, includes }) => ({ id, name, emoji, includes }));
}

/** "🧱 Fondations" */
export function familyTitle(family: FamilyHeading): string {
  return `${family.emoji ? `${family.emoji} ` : ""}${family.name.fr}`;
}

/**
 * "6 thèmes", "7 rubriques" (a family mixing themes and sections), "1 texte · 12 dialogues".
 * Aggregates (all the dialogues) are not counted: their items are already counted one by one.
 */
export function familyCountLabel(family: FamilyHeading, collections: CountedCollection[]): string {
  const counted = collections.filter((collection) => !collection.aggregate);
  const sections = family.includes ?? [];
  if (sections.length === 1 && sections[0] === "texts") {
    const dialogues = counted.filter((collection) => collection.textKind === "dialogue").length;
    const texts = counted.length - dialogues;
    return [texts > 0 && count(texts, "texte"), dialogues > 0 && count(dialogues, "dialogue")].filter(Boolean).join(" · ");
  }
  return count(counted.length, sections.length === 0 ? "thème" : "rubrique");
}

const count = (n: number, noun: string) => `${n} ${noun}${n > 1 ? "s" : ""}`;
