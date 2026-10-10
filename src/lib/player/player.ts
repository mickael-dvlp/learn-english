import { buildChunk, type Chunk, type ClipLoader, type Position } from "./timeline";
import type { ListenSettings, Segment, Step } from "./types";

/** First track short so that playback starts quickly, then longer ones. */
export const FIRST_CHUNK_MS = 15_000;
export const NEXT_CHUNK_MS = 90_000;

/** The audio element, seen by the player. Injected so that the player is tested without a browser. */
export type AudioOutput = {
  /** Replaces the current track (does not start playback). */
  load(chunk: Chunk): void;
  play(): void;
  pause(): void;
  setRate(rate: number): void;
  /** Media time in the current track, in ms. */
  positionMs(): number;
  listen(handlers: {
    /** Playback progressed. */
    time: () => void;
    /** The track played to its end. */
    ended: () => void;
    /** The system paused or refused playback (screen locked, other app…). */
    interrupted: () => void;
  }): void;
};

export type PlayerDeps = {
  loadClip: ClipLoader;
  output: AudioOutput;
  now(): number;
};

export type PlayerOptions = {
  /** Listening time; the session stops at the end of the segment playing when it runs out. */
  durationMs: number;
  settings: ListenSettings;
  /** Builds one pass over the content. Called again each time the content loops. */
  createLap: () => Segment[];
  /** Called when a segment has been played to its end (not when skipped). */
  onSegmentEnd?: (segment: Segment) => void;
};

export type PlayerStatus = "idle" | "playing" | "paused" | "ended";

export type PlayerSnapshot = {
  status: PlayerStatus;
  segment: Segment | undefined;
  /** Step being played (speech or pause). */
  step: Step | undefined;
};

export class Player {
  private status: PlayerStatus = "idle";
  /** Where playback (re)starts when there is no track yet. */
  private position: Position;
  private chunk: Chunk | undefined;
  /** Listening time left when the current track started (real ms). */
  private chunkBudgetMs = 0;
  private nextChunk: Promise<Chunk> | undefined;
  private entryIndex = 0;
  /** Index of the next entry whose segment end has not been reported yet. */
  private reportedUpTo = 0;
  /** Incremented when tracks being built become obsolete (navigation, stop). */
  private buildId = 0;
  private elapsedBeforeMs = 0;
  private playingSince: number | undefined;
  private listeners = new Set<() => void>();
  private snapshot: PlayerSnapshot;

  constructor(
    private readonly options: PlayerOptions,
    private readonly deps: PlayerDeps,
  ) {
    this.position = { lap: options.createLap(), segmentIndex: 0 };
    deps.output.listen({
      time: () => this.syncPosition(),
      ended: () => void this.onTrackEnded(),
      interrupted: () => this.pause(),
    });
    this.snapshot = this.buildSnapshot();
  }

  play = () => {
    if (this.status === "playing" || this.status === "ended") return;
    if (this.position.lap.length === 0) return this.finish();
    this.status = "playing";
    this.playingSince = this.deps.now();
    this.notify();
    if (this.chunk) this.deps.output.play();
    else void this.startFrom(this.position);
  };

  pause = () => {
    if (this.status !== "playing") return;
    this.elapsedBeforeMs = this.elapsedMs();
    this.playingSince = undefined;
    this.status = "paused";
    this.deps.output.pause();
    this.notify();
  };

  toggle = () => (this.status === "playing" ? this.pause() : this.play());

  next = () => this.jump(1);

  previous = () => this.jump(-1);

  /** Plays the current segment again from its start (a dialogue line, a word…). */
  replay = () => this.jump(0);

  stop = () => {
    if (this.status === "ended") return;
    this.finish();
  };

  elapsedMs = (): number =>
    this.elapsedBeforeMs + (this.playingSince === undefined ? 0 : this.deps.now() - this.playingSince);

  remainingMs = (): number => Math.max(0, this.options.durationMs - this.elapsedMs());

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): PlayerSnapshot => this.snapshot;

  private async startFrom(position: Position) {
    const id = ++this.buildId;
    const budget = this.remainingMs();
    const chunk = await this.build(position, budget, FIRST_CHUNK_MS);
    if (id !== this.buildId) return;
    this.loadTrack(chunk, budget);
  }

  private loadTrack(chunk: Chunk, budgetMs: number) {
    const { output } = this.deps;
    this.chunk = chunk;
    this.chunkBudgetMs = budgetMs;
    this.entryIndex = 0;
    this.reportedUpTo = 0;
    output.load(chunk);
    output.setRate(this.options.settings.rate);
    if (this.status === "playing") output.play();
    this.notify();

    // Prepare the following track while this one plays.
    const nextBudget = budgetMs - chunk.durationMs / this.options.settings.rate;
    this.nextChunk = chunk.endsSession ? undefined : this.build(chunk.next, nextBudget, NEXT_CHUNK_MS);
  }

  private build(from: Position, remainingMs: number, targetMs: number): Promise<Chunk> {
    return buildChunk({
      from,
      nextLap: this.options.createLap,
      loadClip: this.deps.loadClip,
      settings: this.options.settings,
      remainingMs,
      targetMs,
    });
  }

  private async onTrackEnded() {
    const chunk = this.chunk;
    if (!chunk || this.status === "ended") return;
    this.reportSegmentEnds(chunk.entries.length);
    if (chunk.endsSession || !this.nextChunk) return this.finish();

    const id = this.buildId;
    const budget = this.chunkBudgetMs - chunk.durationMs / this.options.settings.rate;
    const next = await this.nextChunk;
    if (id !== this.buildId) return; // Navigation or stop meanwhile (stop also changes buildId).
    this.loadTrack(next, budget);
  }

  /** Follows playback: current entry for the screen, listened segments. */
  private syncPosition() {
    const chunk = this.chunk;
    if (!chunk || chunk.entries.length === 0) return;
    const position = this.deps.output.positionMs();
    const playing = chunk.entries.findIndex((entry) => position < entry.endMs);
    this.reportSegmentEnds(playing === -1 ? chunk.entries.length : playing);
    const index = playing === -1 ? chunk.entries.length - 1 : playing;
    if (index !== this.entryIndex) {
      this.entryIndex = index;
      this.notify();
    }
  }

  /** Reports the segments whose last entry is before `upTo` (exclusive). */
  private reportSegmentEnds(upTo: number) {
    const chunk = this.chunk;
    if (!chunk) return;
    for (; this.reportedUpTo < upTo; this.reportedUpTo++) {
      const entry = chunk.entries[this.reportedUpTo];
      if (entry.endsSegment) this.options.onSegmentEnd?.(entry.segment);
    }
  }

  /** Moves by one segment from the current one, and plays from there. */
  private jump(delta: number) {
    if (this.status === "ended") return;
    const { lap, segmentIndex } = this.currentPosition();
    let target: Position;
    if (segmentIndex + delta >= lap.length) target = { lap: this.options.createLap(), segmentIndex: 0 };
    else target = { lap, segmentIndex: Math.max(0, segmentIndex + delta) };

    this.buildId++;
    this.deps.output.pause();
    this.chunk = undefined;
    this.nextChunk = undefined;
    this.position = target;
    this.notify();
    if (this.status === "playing") void this.startFrom(target);
  }

  private currentPosition(): Position {
    const entry = this.chunk?.entries[this.entryIndex];
    return entry ? { lap: entry.lap, segmentIndex: entry.segmentIndex } : this.position;
  }

  private finish() {
    this.elapsedBeforeMs = this.elapsedMs();
    this.playingSince = undefined;
    this.buildId++;
    this.status = "ended";
    this.deps.output.pause();
    this.notify();
  }

  private buildSnapshot(): PlayerSnapshot {
    const entry = this.chunk?.entries[this.entryIndex];
    if (entry) return { status: this.status, segment: entry.segment, step: entry.step };
    const { lap, segmentIndex } = this.position;
    return { status: this.status, segment: lap[segmentIndex], step: undefined };
  }

  private notify() {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) listener();
  }
}
