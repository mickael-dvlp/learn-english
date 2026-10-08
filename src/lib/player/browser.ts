import { cancelSpeech, speak, waitSilently } from "@/lib/speech/speak";
import { Player, type PlayerOptions } from "./player";

/** A player wired to the real voice and clock. */
export function createBrowserPlayer(options: PlayerOptions): Player {
  return new Player(options, {
    speak,
    cancel: cancelSpeech,
    // Pauses are silence played by the voice element, not timers: see waitSilently.
    wait: waitSilently,
    now: () => performance.now(),
  });
}
