/**
 * Small diagnostic log kept in localStorage (last entries only), readable on the phone at /debug.
 * Used to understand what happens while the screen is locked, where no dev tools are available.
 */

const KEY = "debug-log";
const MAX_ENTRIES = 300;

export function debugLog(event: string): void {
  if (typeof window === "undefined") return;
  try {
    const time = new Date().toISOString().slice(11, 23);
    const locked = document.visibilityState === "hidden" ? "🔒" : "··";
    const entries = readDebugLog();
    entries.push(`${time} ${locked} ${event}`);
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // Diagnostics must never break the app.
  }
}

export function readDebugLog(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

export function clearDebugLog(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Ignored.
  }
}
