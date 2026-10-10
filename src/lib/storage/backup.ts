import { z } from "zod";
import { PreferencesSchema, type ListenPreferences } from "./preferences";
import { ProgressSchema, type Progress } from "./progress";

/**
 * Backup of what only lives in this browser: progress and listening preferences, as a JSON file.
 * Importing merges into the current progress: nothing is ever lost (earliest dates are kept).
 */

export const BACKUP_FORMAT = "learn-english-backup";

/** A real backup is a few hundred kilobytes; anything much bigger is not one. */
const MAX_BYTES = 5_000_000;

const BackupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(1),
  exportedAt: z.string(),
  progress: ProgressSchema,
  preferences: z.unknown().optional(),
});

export type Backup = z.infer<typeof BackupSchema>;

export function createBackup(progress: Progress, preferences: ListenPreferences, now: Date): Backup {
  return { format: BACKUP_FORMAT, version: 1, exportedAt: now.toISOString(), progress, preferences };
}

export type ParsedBackup =
  | { ok: true; exportedAt: Date; progress: Progress; preferences: ListenPreferences | undefined }
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
  const preferences = PreferencesSchema.safeParse(result.data.preferences);
  return {
    ok: true,
    exportedAt: new Date(result.data.exportedAt),
    progress: result.data.progress,
    preferences: preferences.success ? preferences.data : undefined,
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

/** "anglais-progression-2026-10-10.json" */
export function backupFileName(now: Date): string {
  return `anglais-progression-${now.toISOString().slice(0, 10)}.json`;
}
