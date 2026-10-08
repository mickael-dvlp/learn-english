import { cancelSpeech, speak } from "@/lib/speech/speak";
import { Player, type PlayerOptions } from "./player";

/** A player wired to the real voice and clock. */
export function createBrowserPlayer(options: PlayerOptions): Player {
  return new Player(options, {
    speak,
    cancel: cancelSpeech,
    // Timers are not throttled in background tabs while audio plays (see keep-alive).
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => performance.now(),
  });
}
