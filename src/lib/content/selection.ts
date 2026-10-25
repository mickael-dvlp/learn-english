import { itemsOf, type Collection } from "./collections";
import type { ContentItem } from "./schema";

/**
 * Several collections listened to together (fruits and vegetables), in Listen. They are of the
 * same type, so that one listening pattern applies to all of them.
 */

/**
 * The chosen collections, in display order: those of `ids` that still exist, of the type of the
 * first chosen one. The first collection when nothing is chosen (or nothing exists any more).
 */
export function resolveSelection(sources: readonly Collection[], ids: readonly string[] | undefined): Collection[] {
  const wanted = new Set(ids ?? []);
  const chosen = sources.filter((source) => wanted.has(source.id));
  if (chosen.length === 0) return sources.slice(0, 1);
  const type = (chosen.find((source) => source.id === ids?.[0]) ?? chosen[0]).type;
  return chosen.filter((source) => source.type === type);
}

/**
 * Tapping a collection: of the same type, it is added to the selection or removed from it (one
 * always stays chosen); of another type, it replaces the selection. A book is listened to on its
 * own (from its bookmark). Returns the chosen ids.
 */
export function toggleSelection(selection: readonly Collection[], tapped: Collection): string[] {
  const ids = selection.map((source) => source.id);
  if (ids.includes(tapped.id)) return ids.length === 1 ? ids : ids.filter((id) => id !== tapped.id);
  if (selection[0]?.type === tapped.type && tapped.type !== "book") return [...ids, tapped.id];
  return [tapped.id];
}

/**
 * Items of the selection, each once (all the verbs and the irregular ones share items), in display
 * order. The sub-theme only applies when a single collection is chosen.
 */
export function selectionItems(selection: readonly Collection[], groupId: string | undefined): ContentItem[] {
  const byId = new Map<string, ContentItem>();
  for (const source of selection) {
    for (const item of itemsOf(source, selection.length === 1 ? groupId : undefined)) {
      if (!byId.has(item.id)) byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}

/** "🍎 Fruits + 🥕 Légumes", "🍎 Fruits + 🥕 Légumes + 3 autres". */
export function selectionTitle(selection: readonly Collection[]): string {
  const labels = selection.map((source) => source.label);
  if (labels.length <= 3) return labels.join(" + ");
  return `${labels.slice(0, 2).join(" + ")} + ${labels.length - 2} autres`;
}
