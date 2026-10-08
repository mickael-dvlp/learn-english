import type { Player } from "./player";

/** Lock screen / notification controls. Returns a cleanup function. */
export function bindMediaSession(player: Player, album: string): () => void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return () => {};
  const session = navigator.mediaSession;

  const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
    ["play", player.play],
    ["pause", player.pause],
    ["nexttrack", player.next],
    ["previoustrack", player.previous],
    ["stop", player.stop],
  ];
  for (const [action, handler] of handlers) {
    try {
      session.setActionHandler(action, handler);
    } catch {
      // Action not supported by this browser.
    }
  }

  let lastLabel: string | undefined;
  const update = () => {
    const { status, segment } = player.getSnapshot();
    session.playbackState = status === "playing" ? "playing" : status === "paused" ? "paused" : "none";
    if (segment && segment.label !== lastLabel) {
      lastLabel = segment.label;
      session.metadata = new MediaMetadata({ title: segment.label, artist: "Anglais", album });
    }
  };
  const unsubscribe = player.subscribe(update);
  update();

  return () => {
    unsubscribe();
    for (const [action] of handlers) {
      try {
        session.setActionHandler(action, null);
      } catch {
        // Ignored, see above.
      }
    }
    session.metadata = null;
    session.playbackState = "none";
  };
}
