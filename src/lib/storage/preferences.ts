import { z } from "zod";
import { DEFAULT_SETTINGS } from "@/lib/player/pause";

/**
 * Listening preferences, remembered in localStorage.
 * Exposed as a tiny external store (subscribe / get) for React's useSyncExternalStore.
 */

const KEY = "listen-preferences";

const PreferencesSchema = z.object({
  sourceId: z.string().optional(),
  patternId: z.string().optional(),
  durationMinutes: z.number().positive().max(600).catch(10),
  order: z.enum(["sequential", "random"]).catch("sequential"),
  rate: z.number().min(0.5).max(1.5).catch(DEFAULT_SETTINGS.rate),
  pauseFactor: z.number().min(0.5).max(3).catch(DEFAULT_SETTINGS.pauseFactor),
});

export type ListenPreferences = z.infer<typeof PreferencesSchema>;

export const DEFAULT_PREFERENCES: ListenPreferences = PreferencesSchema.parse({});

let cache: ListenPreferences | undefined;
const listeners = new Set<() => void>();

function read(): ListenPreferences {
  try {
    const stored = window.localStorage.getItem(KEY);
    const result = PreferencesSchema.safeParse(stored ? JSON.parse(stored) : {});
    return result.success ? result.data : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function getPreferences(): ListenPreferences {
  cache ??= read();
  return cache;
}

export function getServerPreferences(): ListenPreferences {
  return DEFAULT_PREFERENCES;
}

export function setPreferences(patch: Partial<ListenPreferences>): void {
  cache = { ...getPreferences(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage unavailable (private mode…): preferences only last for this visit.
  }
  for (const listener of listeners) listener();
}

export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
