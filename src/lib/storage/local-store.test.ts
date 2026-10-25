import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { createLocalStore } from "./local-store";

// A minimal browser: localStorage, and the "storage" event fired by the other tabs.
const stored = new Map<string, string>();
const storageHandlers: ((event: { key: string | null }) => void)[] = [];
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    },
    addEventListener: (type: string, handler: (event: { key: string | null }) => void) => {
      if (type === "storage") storageHandlers.push(handler);
    },
  },
});
/** Another tab writes a key. */
const writeFromOtherTab = (key: string, value: unknown) => {
  stored.set(key, JSON.stringify(value));
  for (const handler of storageHandlers) handler({ key });
};

test("a value written by another tab replaces the copy kept in memory, and is never overwritten by it", () => {
  const store = createLocalStore("counts", z.record(z.string(), z.number()), {});
  store.set({ a: 1 });
  let notifications = 0;
  store.subscribe(() => notifications++);

  writeFromOtherTab("counts", { a: 1, b: 2 });
  assert.deepEqual(store.get(), { a: 1, b: 2 });
  assert.equal(notifications, 1, "the screens showing it re-render");

  // This tab adds to what the other one wrote, instead of putting back its old copy.
  store.set({ ...store.get(), c: 3 });
  assert.deepEqual(JSON.parse(stored.get("counts")!), { a: 1, b: 2, c: 3 });
});

test("other keys written by another tab are ignored", () => {
  const store = createLocalStore("mine", z.number(), 0);
  store.set(5);
  let notifications = 0;
  store.subscribe(() => notifications++);
  writeFromOtherTab("theirs", 9);
  assert.equal(store.get(), 5);
  assert.equal(notifications, 0);
});
