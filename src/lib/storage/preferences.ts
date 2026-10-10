import { z } from "zod";
import { DEFAULT_SETTINGS } from "@/lib/player/pause";
import { createLocalStore } from "./local-store";

/** Listening preferences (also used for the voice speed in study mode). */

const PreferencesSchema = z.object({
  sourceId: z.string().optional(),
  /** Sub-theme of the source; all of it when absent. */
  groupId: z.string().optional(),
  /** One item of the source (a single rule); all of them when absent. */
  itemId: z.string().optional(),
  patternId: z.string().optional(),
  durationMinutes: z.number().positive().max(600).catch(10),
  order: z.enum(["sequential", "random"]).catch("sequential"),
  rate: z.number().min(0.5).max(1.5).catch(DEFAULT_SETTINGS.rate),
  pauseFactor: z.number().min(0.5).max(3).catch(DEFAULT_SETTINGS.pauseFactor),
});

export type ListenPreferences = z.infer<typeof PreferencesSchema>;

export const DEFAULT_PREFERENCES: ListenPreferences = PreferencesSchema.parse({});

export const preferencesStore = createLocalStore("listen-preferences", PreferencesSchema, DEFAULT_PREFERENCES);

export function setPreferences(patch: Partial<ListenPreferences>): void {
  preferencesStore.set({ ...preferencesStore.get(), ...patch });
}
