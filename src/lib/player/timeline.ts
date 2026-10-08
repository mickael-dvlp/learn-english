import { concat, msToSamples, samplesToMs } from "@/lib/audio/pcm";
import { pauseMs } from "./pause";
import type { ListenSettings, Segment, Step } from "./types";

/**
 * A session is played as long audio tracks ("chunks", one to two minutes) holding the words
 * and the pauses. Android lets a long track play with the screen locked; a series of short
 * sounds gets paused a few seconds after locking (seen on the phone).
 */

export type SpeakStep = Extract<Step, { kind: "speak" }>;

/** Decoded mono PCM of a spoken step, already trimmed. */
export type ClipLoader = (step: SpeakStep) => Promise<Float32Array | undefined>;

/** Where a chunk starts: a segment of a lap. */
export type Position = { lap: Segment[]; segmentIndex: number };

export type ChunkEntry = {
  lap: Segment[];
  segmentIndex: number;
  segment: Segment;
  step: Step;
  /** Media time in the chunk, in ms. */
  startMs: number;
  endMs: number;
  /** Last entry of a segment: once it has played, the segment counts as listened to. */
  endsSegment: boolean;
};

export type Chunk = {
  samples: Float32Array;
  entries: ChunkEntry[];
  /** Media time (before the playback rate is applied). */
  durationMs: number;
  /** Where the next chunk starts. */
  next: Position;
  /** The session timer runs out within this chunk: it is the last one. */
  endsSession: boolean;
};

export type BuildChunkOptions = {
  from: Position;
  /** One more pass over the content, when the current lap is over. */
  nextLap: () => Segment[];
  loadClip: ClipLoader;
  settings: ListenSettings;
  /** Listening time left when this chunk starts (real time, ms). */
  remainingMs: number;
  /** Stop adding segments once the chunk lasts this long (real time, ms). */
  targetMs: number;
};

/**
 * Assembles whole segments into one track. The playback rate is applied by the audio element:
 * silences are lengthened accordingly so that pauses keep their real duration.
 * When the timer runs out, the current segment is finished without its remaining pauses.
 */
export async function buildChunk(options: BuildChunkOptions): Promise<Chunk> {
  const { settings, remainingMs, targetMs, loadClip } = options;
  const parts: Float32Array[] = [];
  const entries: ChunkEntry[] = [];
  let mediaMs = 0;
  const realMs = () => mediaMs / settings.rate;
  let position = options.from;
  let silentSegments = 0;

  for (;;) {
    const { lap, segmentIndex } = position;
    const segment = lap[segmentIndex];
    const segmentEntries: ChunkEntry[] = [];

    for (const step of segment.steps) {
      let samples: Float32Array | undefined;
      if (step.kind === "pause") {
        if (realMs() >= remainingMs) continue;
        samples = new Float32Array(msToSamples(pauseMs(step, settings) * settings.rate));
      } else {
        samples = await loadClip(step);
        if (!samples) continue; // Missing audio file: skipped.
      }
      const durationMs = samplesToMs(samples.length);
      parts.push(samples);
      segmentEntries.push({
        lap,
        segmentIndex,
        segment,
        step,
        startMs: mediaMs,
        endMs: mediaMs + durationMs,
        endsSegment: false,
      });
      mediaMs += durationMs;
    }

    const last = segmentEntries.at(-1);
    if (last) last.endsSegment = true;
    entries.push(...segmentEntries);
    // Nothing playable in a whole lap (no audio at all): stop rather than loop forever.
    silentSegments = segmentEntries.some((entry) => entry.step.kind === "speak") ? 0 : silentSegments + 1;

    position = segmentIndex + 1 < lap.length ? { lap, segmentIndex: segmentIndex + 1 } : { lap: options.nextLap(), segmentIndex: 0 };

    const endsSession = realMs() >= remainingMs || silentSegments >= lap.length || position.lap.length === 0;
    if (endsSession || realMs() >= targetMs) {
      return { samples: concat(parts), entries, durationMs: mediaMs, next: position, endsSession };
    }
  }
}

