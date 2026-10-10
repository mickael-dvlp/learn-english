import { z } from "zod";
import { createLocalStore, useLocalStore, type LocalStore } from "./local-store";

/**
 * Which family is open in an accordion, remembered in localStorage per screen.
 * `undefined` = never chosen (the default section opens); `null` = the user closed everything.
 * Opening or closing a section never touches progress or the listening selection.
 */

export type AccordionKey = "study" | "listen";

const OpenIdSchema = z.string().nullable().optional();

const stores = new Map<AccordionKey, LocalStore<string | null | undefined>>();

function accordionStore(key: AccordionKey): LocalStore<string | null | undefined> {
  let store = stores.get(key);
  if (!store) {
    store = createLocalStore<string | null | undefined>(`accordion-${key}`, OpenIdSchema, undefined);
    stores.set(key, store);
  }
  return store;
}

export function useAccordion(key: AccordionKey, defaultId: string | null): [string | null, (id: string | null) => void] {
  const store = accordionStore(key);
  const value = useLocalStore(store);
  return [value === undefined ? defaultId : value, store.set];
}

/** Opens a section from outside the accordion (e.g. the family of the collection being viewed). */
export function openAccordion(key: AccordionKey, id: string): void {
  accordionStore(key).set(id);
}
