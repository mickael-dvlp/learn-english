import { useSyncExternalStore } from "react";
import type { z } from "zod";

/**
 * A value persisted in localStorage, validated on read, exposed as an external store.
 * Falls back to memory when storage is unavailable (private mode, server rendering).
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
      for (const listener of listeners) listener();
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
