import type { ContentItem } from "@/lib/content/schema";
import type { Pattern, StepTemplate } from "./patterns";
import type { Segment } from "./types";

type Scope = Record<string, unknown>;

/** Resolves `{a.b}` / `{a|b}` placeholders. Returns undefined if one of them is missing. */
export function fillTemplate(template: string, scope: Scope): string | undefined {
  let missing = false;
  const text = template.replace(/\{([^}]+)\}/g, (_, expression: string) => {
    for (const path of expression.split("|")) {
      const value = lookup(scope, path.trim());
      if (typeof value === "string" && value.trim() !== "") return value;
    }
    missing = true;
    return "";
  });
  return missing ? undefined : text;
}

function lookup(scope: Scope, path: string): unknown {
  let value: unknown = scope;
  for (const key of path.split(".")) {
    if (typeof value !== "object" || value === null) return undefined;
    value = (value as Scope)[key];
  }
  return value;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Turns one content item into playable segments, following a pattern. */
export function compileItem(item: ContentItem, pattern: Pattern): Segment[] {
  const root = item as Scope;
  let current: Segment = { itemId: item.id, label: fillTemplate(pattern.display, root) ?? item.id, steps: [] };
  const segments: Segment[] = [current];
  let unitCount = 0;
  let lastWords: number | undefined;

  const walk = (templates: StepTemplate[], scope: Scope) => {
    for (const template of templates) {
      if ("say" in template) {
        const text = fillTemplate(template.say, scope);
        if (text === undefined) {
          lastWords = undefined;
          continue;
        }
        const file = template.audio ? item.audio?.[template.lang] : undefined;
        current.steps.push({
          kind: "speak",
          unit: {
            id: `${item.id}:${unitCount++}`,
            [template.lang]: text,
            ...(file ? { audio: { [template.lang]: file } } : {}),
          },
          lang: template.lang,
          rate: template.rate ?? 1,
        });
        lastWords = countWords(text);
      } else if ("pause" in template) {
        if (lastWords !== undefined) {
          current.steps.push({ kind: "pause", words: lastWords, scale: template.pause });
        }
      } else {
        for (const element of toList(scope[template.each])) {
          if (template.segment) {
            current = {
              itemId: item.id,
              label: fillTemplate(template.segment.label, element) ?? current.label,
              steps: [],
            };
            segments.push(current);
          }
          walk(template.steps, element);
        }
      }
    }
  };

  walk(pattern.steps, root);
  return segments.filter((segment) => segment.steps.length > 0);
}

function toList(value: unknown): Scope[] {
  const list = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return list.filter((entry): entry is Scope => typeof entry === "object" && entry !== null);
}

export type PlayOrder = "sequential" | "random";

export function shuffle<T>(list: readonly T[], random: () => number = Math.random): T[] {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Shuffles a new lap so that the items played at the end of the previous lap
 * (the last half) cannot come back at its start: at least half of the other items play in between.
 */
export function shuffleAfter<T>(
  items: readonly T[],
  previous: readonly T[],
  random: () => number = Math.random,
): T[] {
  if (previous.length === 0) return shuffle(items, random);
  const gap = Math.floor(items.length / 2);
  const recent = new Set(previous.slice(previous.length - gap));
  const others = shuffle(
    items.filter((item) => !recent.has(item)),
    random,
  );
  const head = others.slice(0, gap);
  const tail = shuffle([...others.slice(gap), ...items.filter((item) => recent.has(item))], random);
  return [...head, ...tail];
}

/**
 * Returns the `createLap` of a session: each call is one pass over all the items.
 * Random order shuffles items (never the sentences inside a text), each item once per lap.
 */
export function lapFactory(
  items: readonly ContentItem[],
  pattern: Pattern,
  order: PlayOrder,
  random: () => number = Math.random,
): () => Segment[] {
  let previous: readonly ContentItem[] = [];
  return () => {
    const ordered = order === "random" ? shuffleAfter(items, previous, random) : items;
    previous = ordered;
    return ordered.flatMap((item) => compileItem(item, pattern));
  };
}
