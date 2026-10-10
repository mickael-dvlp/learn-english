/** Classes shared by the study and listen pages, so that both look like the same app. */

/** Keyboard focus, same on every button and link. */
export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Shape of a list card (collections in Study, contents and options in Listen), without its background. */
export const cardShape = `flex min-h-16 rounded-3xl px-5 py-3 ${focusRing}`;

/** A list card on its usual background. */
export const cardClass = `${cardShape} bg-surface`;

/** Main orange action (start a session, play). */
export const primaryButtonClass = `flex min-h-16 w-full items-center justify-center rounded-3xl bg-accent text-xl font-semibold text-accent-foreground ${focusRing}`;
