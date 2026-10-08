import { pauseMs } from "./pause";
import type { Lang, ListenSettings, PlayableUnit, Segment, Step } from "./types";

/** Everything that touches the outside world, injected so the player runs (and is tested) without a browser. */
export type PlayerDeps = {
  /** Must always resolve, including when interrupted by `cancel()`. */
  speak(unit: PlayableUnit, lang: Lang, rate: number): Promise<void>;
  /** Stops the current speech immediately. */
  cancel(): void;
  wait(ms: number): Promise<void>;
  now(): number;
};

export type PlayerOptions = {
  /** Listening time; the session stops at the end of the segment playing when it runs out. */
  durationMs: number;
  settings: ListenSettings;
  /** Builds one pass over the content. Called again each time the content loops. */
  createLap: () => Segment[];
};

export type PlayerStatus = "idle" | "playing" | "paused" | "ended";

export type PlayerSnapshot = {
  status: PlayerStatus;
  segment: Segment | undefined;
  /** Step being played (speech or pause). */
  step: Step | undefined;
};

export class Player {
  private lap: Segment[];
  private segmentIndex = 0;
  private stepIndex = 0;
  private status: PlayerStatus = "idle";
  private settings: ListenSettings;
  private elapsedBeforeMs = 0;
  private playingSince: number | undefined;
  /** Incremented on every interruption: a run loop whose id is stale stops. */
  private runId = 0;
  private listeners = new Set<() => void>();
  private snapshot: PlayerSnapshot;

  constructor(
    private readonly options: PlayerOptions,
    private readonly deps: PlayerDeps,
  ) {
    this.settings = options.settings;
    this.lap = options.createLap();
    this.snapshot = this.buildSnapshot();
  }

  play = () => {
    if (this.status === "playing" || this.status === "ended") return;
    if (this.lap.length === 0) return this.finish();
    this.status = "playing";
    this.playingSince = this.deps.now();
    this.notify();
    void this.run(++this.runId);
  };

  pause = () => {
    if (this.status !== "playing") return;
    this.elapsedBeforeMs = this.elapsedMs();
    this.playingSince = undefined;
    this.status = "paused";
    this.interrupt();
    this.notify();
  };

  toggle = () => (this.status === "playing" ? this.pause() : this.play());

  next = () => this.jumpTo(this.segmentIndex + 1);

  previous = () => this.jumpTo(Math.max(0, this.segmentIndex - 1));

  stop = () => {
    if (this.status === "ended") return;
    this.interrupt();
    this.finish();
  };

  /** Applied from the next step on. */
  setSettings = (settings: ListenSettings) => {
    this.settings = settings;
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

  private async run(id: number) {
    while (id === this.runId) {
      const segment = this.lap[this.segmentIndex];
      const step = segment.steps[this.stepIndex];

      if (step === undefined) {
        if (this.isTimeUp()) return this.finish();
        this.advance(this.segmentIndex + 1);
        this.notify();
        continue;
      }

      if (step.kind === "speak") {
        await this.deps.speak(step.unit, step.lang, step.rate * this.settings.rate);
      } else if (!this.isTimeUp()) {
        // Once time is up, pauses are skipped: the current segment ends right after its last words.
        await this.deps.wait(pauseMs(step, this.settings));
      }
      if (id !== this.runId) return;

      this.stepIndex++;
      this.notify();
    }
  }

  private jumpTo(index: number) {
    if (this.status === "ended") return;
    this.interrupt();
    this.advance(index);
    this.notify();
    if (this.status === "playing") void this.run(++this.runId);
  }

  /** Moves to a segment, starting a new lap past the end. */
  private advance(index: number) {
    if (index >= this.lap.length) {
      this.lap = this.options.createLap();
      index = 0;
    }
    this.segmentIndex = index;
    this.stepIndex = 0;
  }

  private interrupt() {
    this.runId++;
    this.deps.cancel();
  }

  private finish() {
    this.elapsedBeforeMs = this.elapsedMs();
    this.playingSince = undefined;
    this.runId++;
    this.status = "ended";
    this.notify();
  }

  private isTimeUp() {
    return this.elapsedMs() >= this.options.durationMs;
  }

  private buildSnapshot(): PlayerSnapshot {
    const segment = this.lap[this.segmentIndex];
    return { status: this.status, segment, step: segment?.steps[this.stepIndex] };
  }

  private notify() {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) listener();
  }
}
