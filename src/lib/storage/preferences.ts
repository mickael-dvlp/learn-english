import { z } from "zod";
import { DEFAULT_SETTINGS } from "@/lib/player/pause";
import { QUIZ_MAX_QUESTIONS, QUIZ_MIN_QUESTIONS } from "@/lib/quiz/quiz";
import { createLocalStore } from "./local-store";

/** Listening preferences (also used for the voice speed in study mode). */

/** Before several collections could be chosen, one was kept in `sourceId`: it becomes the selection. */
function withSourceIds(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || "sourceIds" in raw) return raw;
  const { sourceId, ...rest } = raw as { sourceId?: unknown };
  return typeof sourceId === "string" ? { ...rest, sourceIds: [sourceId] } : rest;
}

export const PreferencesSchema = z.preprocess(
  withSourceIds,
  z.object({
    /** Collections listened to together (same type); the first collection when absent. */
    sourceIds: z.array(z.string()).optional(),
    /** Sub-theme of the source (a single collection chosen); all of it when absent. */
    groupId: z.string().optional(),
    /** One item of the source (a single rule); all of them when absent. */
    itemId: z.string().optional(),
    /** A book: start at this chapter (index) for the next session; from the bookmark when absent. */
    bookChapter: z.number().int().min(0).optional(),
    patternId: z.string().optional(),
    durationMinutes: z.number().positive().max(600).catch(10),
    order: z.enum(["sequential", "random"]).catch("sequential"),
    rate: z.number().min(0.5).max(1.5).catch(DEFAULT_SETTINGS.rate),
    pauseFactor: z.number().min(0.5).max(3).catch(DEFAULT_SETTINGS.pauseFactor),
    /** Number of quiz questions (Study and Listen). */
    quizCount: z.number().int().min(QUIZ_MIN_QUESTIONS).max(QUIZ_MAX_QUESTIONS).catch(20),
    /** Listen quiz: time left to answer aloud before the answer is said. */
    quizAnswerSeconds: z.number().min(2).max(8).catch(4),
  }),
);

export type ListenPreferences = z.infer<typeof PreferencesSchema>;

export const DEFAULT_PREFERENCES: ListenPreferences = PreferencesSchema.parse({});

export const preferencesStore = createLocalStore("listen-preferences", PreferencesSchema, DEFAULT_PREFERENCES);

export function setPreferences(patch: Partial<ListenPreferences>): void {
  preferencesStore.set({ ...preferencesStore.get(), ...patch });
}

/** Listen to one collection (from a study page): it becomes the whole selection. */
export function listenTo(collectionId: string, patch: Pick<ListenPreferences, "groupId" | "itemId"> = {}): void {
  setPreferences({ sourceIds: [collectionId], groupId: patch.groupId, itemId: patch.itemId });
}
