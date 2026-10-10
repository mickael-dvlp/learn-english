/**
 * Persistent storage: asks the browser not to clear this site's data (progress) when the device
 * runs low on space. Chrome grants it silently, more readily to an installed app.
 */

export type PersistState = "persisted" | "not-persisted" | "unsupported";

export async function persistState(): Promise<PersistState> {
  if (typeof navigator === "undefined" || !navigator.storage?.persisted) return "unsupported";
  return (await navigator.storage.persisted()) ? "persisted" : "not-persisted";
}

export async function requestPersistence(): Promise<PersistState> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return "unsupported";
  try {
    return (await navigator.storage.persist()) ? "persisted" : "not-persisted";
  } catch {
    return "not-persisted";
  }
}
