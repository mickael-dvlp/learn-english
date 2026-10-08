import { z } from "zod";
import { createLocalStore } from "./local-store";

/** Minimal tracking per content id: first time seen (study) and first time listened to (player). */

const EntrySchema = z.object({
  seen: z.number().optional(),
  listened: z.number().optional(),
});

const ProgressSchema = z.record(z.string(), EntrySchema);

export type Progress = z.infer<typeof ProgressSchema>;

export const progressStore = createLocalStore<Progress>("progress", ProgressSchema, {});

export const markSeen = (id: string) => mark(id, "seen");

export const markListened = (id: string) => mark(id, "listened");

/** Only the first time is recorded: marking again is a no-op (no write, no re-render). */
function mark(id: string, field: keyof Progress[string]) {
  const progress = progressStore.get();
  if (progress[id]?.[field] !== undefined) return;
  progressStore.set(withMark(progress, id, field, Date.now()));
}

export function withMark(progress: Progress, id: string, field: keyof Progress[string], at: number): Progress {
  return { ...progress, [id]: { ...progress[id], [field]: at } };
}

export function summarize(progress: Progress, ids: readonly string[]) {
  return {
    total: ids.length,
    seen: ids.filter((id) => progress[id]?.seen !== undefined).length,
    listened: ids.filter((id) => progress[id]?.listened !== undefined).length,
  };
}
