import { useSyncExternalStore } from "react";

/**
 * The open card lives in the URL hash (#word-tractor): the phone's back button closes it,
 * and a single page per collection is enough (simpler to cache offline).
 */
export function useHash(): string {
  return useSyncExternalStore(subscribe, readHash, () => "");
}

function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

function readHash() {
  return decodeURIComponent(window.location.hash.slice(1));
}

let openedFromList = false;

/** Adds a history entry, so "back" returns to the list. */
export function openHash(id: string) {
  openedFromList = true;
  window.location.hash = id;
}

/** Moves to another card without stacking history entries. */
export function replaceHash(id: string) {
  window.location.replace(`#${id}`);
}

export function closeHash() {
  if (openedFromList) {
    openedFromList = false;
    window.history.back();
  } else {
    window.location.replace("#");
  }
}
