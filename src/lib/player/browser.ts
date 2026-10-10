import { SAMPLE_RATE, encodeWav, trimSilence } from "@/lib/audio/pcm";
import { debugLog } from "@/lib/debug/log";
import { audioCandidates } from "@/lib/speech/audio-files";
import { Player, type AudioOutput, type PlayerOptions } from "./player";
import type { Chunk, ClipLoader } from "./timeline";

/** A player wired to the generated audio files and a real <audio> element. */
export function createBrowserPlayer(options: PlayerOptions): Player {
  return new Player(options, { loadClip, output: getOutput(), now: () => performance.now() });
}

// --- Clips: generated MP3 files, decoded to PCM -------------------------------------------

const MAX_CACHED_CLIPS = 200;
const clips = new Map<string, Promise<Float32Array | undefined>>();
let decoder: OfflineAudioContext | undefined;

/** The slow version of a sentence when it exists, the normal one otherwise; the usual voice if the second one is missing. */
const loadClip: ClipLoader = async (step) => {
  const text = step.unit[step.lang];
  if (!text) return undefined;
  for (const path of audioCandidates(step.lang, text, step.rate, step.voice)) {
    const clip = await loadFile(`/${path}`);
    if (clip) return clip;
  }
  debugLog(`✗ audio manquant : ${text}`);
  return undefined;
};

function loadFile(src: string): Promise<Float32Array | undefined> {
  let clip = clips.get(src);
  if (!clip) {
    clip = fetchAndDecode(src);
    clips.set(src, clip);
    const oldest = clips.keys().next().value;
    if (clips.size > MAX_CACHED_CLIPS && oldest !== undefined) clips.delete(oldest);
  }
  return clip;
}

async function fetchAndDecode(src: string): Promise<Float32Array | undefined> {
  try {
    const response = await fetch(src);
    if (!response.ok) return undefined;
    // Decoding resamples to the context rate: every clip ends up at SAMPLE_RATE.
    decoder ??= new OfflineAudioContext(1, 1, SAMPLE_RATE);
    const buffer = await decoder.decodeAudioData(await response.arrayBuffer());
    return trimSilence(buffer.getChannelData(0));
  } catch (error) {
    debugLog(`✗ ${src} : ${(error as Error).message}`);
    return undefined;
  }
}

// --- Output: one <audio> element playing the assembled tracks ------------------------------

let output: AudioOutput | undefined;

function getOutput(): AudioOutput {
  return (output ??= createOutput());
}

function createOutput(): AudioOutput {
  const audio = new Audio();
  let url: string | undefined;
  let expectedPause = false;
  let handlers: Parameters<AudioOutput["listen"]>[0] | undefined;

  audio.addEventListener("timeupdate", () => handlers?.time());
  audio.addEventListener("ended", () => {
    debugLog("fin de piste");
    handlers?.ended();
  });
  // "pause" also fires right before "ended": only a pause we did not ask for is an interruption.
  audio.addEventListener("pause", () => {
    if (expectedPause || audio.ended) {
      expectedPause = false;
      return;
    }
    debugLog("⏸ mis en pause par le système");
    handlers?.interrupted();
  });
  for (const event of ["waiting", "stalled"] as const) {
    audio.addEventListener(event, () => debugLog(`(audio : ${event})`));
  }

  return {
    load(chunk: Chunk) {
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(new Blob([encodeWav(chunk.samples)], { type: "audio/wav" }));
      expectedPause = false;
      audio.src = url;
      const seconds = Math.round(chunk.durationMs / 1000);
      debugLog(`piste : ${seconds} s, ${chunk.entries.length} étapes${chunk.endsSession ? " (dernière)" : ""}`);
    },
    play() {
      audio.play().catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        debugLog(`✗ lecture refusée (${error instanceof Error ? error.name : String(error)})`);
        handlers?.interrupted();
      });
    },
    pause() {
      if (audio.paused) return;
      expectedPause = true;
      audio.pause();
    },
    setRate(rate: number) {
      audio.defaultPlaybackRate = rate;
      audio.playbackRate = rate;
    },
    positionMs: () => audio.currentTime * 1000,
    listen(next) {
      handlers = next;
    },
  };
}
