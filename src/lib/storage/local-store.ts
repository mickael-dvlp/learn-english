import { useSyncExternalStore } from "react";
import type { z } from "zod";

/**
 * A value persisted in localStorage, validated on read, exposed as an external store.
 * Falls back to memory when storage is unavailable (private mode, server rendering).
 * Another tab or window of the app (installed app and a Chrome tab) writing the same key
 * refreshes the value here: a write never puts back an older copy.
 */
export type LocalStore<T> = {
  get: () => T;
  getServer: () => T;
  set: (value: T) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createLocalStore<T>(key: string, schema: z.ZodType<T>, fallback: T): LocalStore<T> {
  let cache: T | undefined;
  const listeners = new Set<() => void>();

  const read = (): T => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === null) return fallback;
      const result = schema.safeParse(JSON.parse(stored));
      return result.success ? result.data : fallback;
    } catch {
      return fallback;
    }
  };
  const notify = () => {
    for (const listener of listeners) listener();
  };

  // Only fired by the other tabs: the next read takes their value.
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key !== null && event.key !== key) return;
      cache = undefined;
      notify();
    });
  }

  return {
    get: () => (cache ??= read()),
    getServer: () => fallback,
    set: (value) => {
      cache = value;
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Storage unavailable: the value only lasts for this visit.
      }
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useLocalStore<T>(store: LocalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.getServer);
}
