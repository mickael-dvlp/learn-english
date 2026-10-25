import { z } from "zod";
import { BookmarksSchema, type Bookmarks } from "./bookmarks";
import { PreferencesSchema, type ListenPreferences } from "./preferences";
import { ProgressSchema, type Progress } from "./progress";

/**
 * Backup of what only lives in this browser: progress, listening preferences and book bookmarks,
 * as a JSON file. Importing merges into the current progress: nothing is ever lost (earliest dates
 * are kept). Files saved before bookmarks existed are still read.
 */

export const BACKUP_FORMAT = "learn-english-backup";

/** A real backup is a few hundred kilobytes; anything much bigger is not one. */
const MAX_BYTES = 5_000_000;

const BackupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(1),
  exportedAt: z.string().refine((date) => !Number.isNaN(Date.parse(date))),
  progress: ProgressSchema,
  preferences: z.unknown().optional(),
  bookmarks: z.unknown().optional(),
});

export type Backup = z.infer<typeof BackupSchema>;

export function createBackup(progress: Progress, preferences: ListenPreferences, bookmarks: Bookmarks, now: Date): Backup {
  return { format: BACKUP_FORMAT, version: 1, exportedAt: now.toISOString(), progress, preferences, bookmarks };
}

export type ParsedBackup =
  | { ok: true; exportedAt: Date; progress: Progress; preferences: ListenPreferences | undefined; bookmarks: Bookmarks }
  | { ok: false; error: string };

/** Reads a backup file. Validated field by field: a file from elsewhere cannot inject anything. */
export function parseBackup(text: string): ParsedBackup {
  if (text.length > MAX_BYTES) return { ok: false, error: "Ce fichier est bien trop gros pour être une sauvegarde." };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "Ce fichier n'est pas lisible (ce n'est pas du JSON)." };
  }
  const result = BackupSchema.safeParse(data);
  if (!result.success) return { ok: false, error: "Ce fichier n'est pas une sauvegarde de l'appli." };
  // Invalid preferences or bookmarks are left out: the progress is still imported.
  const preferences = PreferencesSchema.safeParse(result.data.preferences);
  const bookmarks = BookmarksSchema.safeParse(result.data.bookmarks ?? {});
  return {
    ok: true,
    exportedAt: new Date(result.data.exportedAt),
    progress: result.data.progress,
    preferences: preferences.success ? preferences.data : undefined,
    bookmarks: bookmarks.success ? bookmarks.data : {},
  };
}

/** Union of two progress records: for each id, the earliest dates and every part heard. */
export function mergeProgress(current: Progress, incoming: Progress): Progress {
  const merged: Progress = { ...current };
  for (const [id, entry] of Object.entries(incoming)) {
    const mine = merged[id];
    const earliest = (a?: number, b?: number) => (a === undefined ? b : b === undefined ? a : Math.min(a, b));
    const parts = [...new Set([...(mine?.parts ?? []), ...(entry.parts ?? [])])].sort((a, b) => a - b);
    const seen = earliest(mine?.seen, entry.seen);
    const listened = earliest(mine?.listened, entry.listened);
    merged[id] = {
      ...(seen !== undefined && { seen }),
      ...(listened !== undefined && { listened }),
      ...(parts.length > 0 && { parts }),
    };
  }
  return merged;
}

/** "anglais-progression-2026-10-10.json", with the date of the phone (not UTC: after midnight, the new day). */
export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `anglais-progression-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}
