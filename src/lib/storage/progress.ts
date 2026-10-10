import { z } from "zod";
import { createLocalStore } from "./local-store";

/** Minimal tracking per content id: first time seen (study) and first time listened to (player). */

const EntrySchema = z.object({
  seen: z.number().optional(),
  /** Listened to in full (for a text or dialogue: every sentence heard, possibly over several sessions). */
  listened: z.number().optional(),
  /** Sentences of a text or dialogue heard to the end (indexes). */
  parts: z.array(z.number()).optional(),
});

const ProgressSchema = z.record(z.string(), EntrySchema);

export type Progress = z.infer<typeof ProgressSchema>;

export const progressStore = createLocalStore<Progress>("progress", ProgressSchema, {});

export const markSeen = (id: string) => mark(id, "seen");

export const markListened = (id: string) => mark(id, "listened");

/** Only the first time is recorded: marking again is a no-op (no write, no re-render). */
function mark(id: string, field: "seen" | "listened") {
  const progress = progressStore.get();
  if (progress[id]?.[field] !== undefined) return;
  progressStore.set(withMark(progress, id, field, Date.now()));
}

export function withMark(progress: Progress, id: string, field: "seen" | "listened", at: number): Progress {
  return { ...progress, [id]: { ...progress[id], [field]: at } };
}

/**
 * One part of an item (sentence of a text, example of a rule) heard to the end; once `needed` of
 * them are (all the sentences of a text, most examples of a rule), the item is listened to.
 */
export function markPartListened(id: string, index: number, needed: number) {
  const progress = progressStore.get();
  const next = withPart(progress, id, index, needed, Date.now());
  if (next !== progress) progressStore.set(next);
}

export function withPart(progress: Progress, id: string, index: number, needed: number, at: number): Progress {
  const entry = progress[id];
  if (entry?.parts?.includes(index)) return progress;
  const parts = [...(entry?.parts ?? []), index].sort((a, b) => a - b);
  const complete = entry?.listened === undefined && parts.length >= needed;
  return { ...progress, [id]: { ...entry, parts, ...(complete && { listened: at }) } };
}

/** Listening state of a text: "full" (every sentence), "partial" (some), or nothing yet. */
export function textListening(entry: Progress[string] | undefined, count: number) {
  const heard = Math.min(entry?.parts?.length ?? 0, count);
  // `listened` alone: recorded before sentences were counted, kept as is.
  if (entry?.listened !== undefined || heard >= count) return { state: "full" as const, heard: count };
  return { state: heard > 0 ? ("partial" as const) : ("none" as const), heard };
}

export function summarize(progress: Progress, ids: readonly string[]) {
  return {
    total: ids.length,
    seen: ids.filter((id) => progress[id]?.seen !== undefined).length,
    listened: ids.filter((id) => progress[id]?.listened !== undefined).length,
  };
}
