import assert from "node:assert/strict";
import { test } from "node:test";
import { SAMPLE_RATE } from "@/lib/audio/pcm";
import { PAUSE_BASE_MS } from "./pause";
import { FIRST_CHUNK_MS, Player, type AudioOutput } from "./player";
import { buildChunk, type Chunk, type ClipLoader } from "./timeline";
import type { Segment, Step } from "./types";

const settings = { rate: 1, pauseFactor: 1 };
const SPEAK_MS = 1000;

/** Every spoken text lasts 1 s; "missing" has no audio file. */
const loadClip: ClipLoader = async (step) =>
  step.unit[step.lang] === "missing" ? undefined : new Float32Array(SAMPLE_RATE * (SPEAK_MS / 1000));

const say = (text: string): Step => ({ kind: "speak", unit: { id: text, en: text }, lang: "en", rate: 1 });
const pause: Step = { kind: "pause", words: 0, scale: 1 };
const segment = (...texts: string[]): Segment => ({
  itemId: texts[0],
  label: texts[0],
  steps: texts.flatMap((text) => [say(text), pause]),
});
const spoken = (chunk: Chunk) =>
  chunk.entries.map((entry) => (entry.step.kind === "speak" ? entry.step.unit.en : "…"));

// --- buildChunk -------------------------------------------------------------------------

test("buildChunk: whole segments until the target length, then where to continue", async () => {
  const lap = [segment("a"), segment("b"), segment("c")];
  const chunk = await buildChunk({
    from: { lap, segmentIndex: 0 },
    nextLap: () => lap,
    loadClip,
    settings,
    remainingMs: 60_000,
    targetMs: 2000, // reached during "b"'s segment: "b" is completed
  });
  assert.deepEqual(spoken(chunk), ["a", "…", "b", "…"]);
  assert.equal(chunk.durationMs, 2 * (SPEAK_MS + PAUSE_BASE_MS));
  assert.equal(chunk.samples.length, (chunk.durationMs / 1000) * SAMPLE_RATE);
  assert.equal(chunk.next.segmentIndex, 2);
  assert.equal(chunk.endsSession, false);
  assert.deepEqual(
    chunk.entries.map((entry) => entry.endsSegment),
    [false, true, false, true],
  );
});

test("buildChunk: loops over a new lap when the content runs out", async () => {
  let laps = 0;
  const chunk = await buildChunk({
    from: { lap: [segment("a")], segmentIndex: 0 },
    nextLap: () => (laps++, [segment("x")]),
    loadClip,
    settings,
    remainingMs: 60_000,
    targetMs: 3500, // each segment lasts 1.5 s: three segments
  });
  assert.deepEqual(spoken(chunk), ["a", "…", "x", "…", "x", "…"]);
  assert.equal(laps, 3);
});

test("buildChunk: time up finishes the segment without its pauses, and ends the session", async () => {
  const chunk = await buildChunk({
    from: { lap: [segment("one", "two", "three"), segment("next")], segmentIndex: 0 },
    nextLap: () => [],
    loadClip,
    settings,
    remainingMs: 500,
    targetMs: 90_000,
  });
  assert.deepEqual(spoken(chunk), ["one", "two", "three"]);
  assert.equal(chunk.endsSession, true);
});

test("buildChunk: pauses keep their real duration whatever the playback rate", async () => {
  const lap = [segment("a")];
  const options = { from: { lap, segmentIndex: 0 }, nextLap: () => lap, loadClip, remainingMs: 60_000, targetMs: 1 };
  const normal = await buildChunk({ ...options, settings });
  const slower = await buildChunk({ ...options, settings: { rate: 0.5, pauseFactor: 1 } });
  const pauseOf = (chunk: Chunk) => chunk.entries[1].endMs - chunk.entries[1].startMs;
  // Played at half speed, a silence half as long in the file lasts the same real time.
  assert.equal(pauseOf(slower), pauseOf(normal) * 0.5);
});

test("buildChunk: missing audio files are skipped; nothing playable ends the session", async () => {
  const chunk = await buildChunk({
    from: { lap: [segment("missing"), segment("missing")], segmentIndex: 0 },
    nextLap: () => [segment("missing"), segment("missing")],
    loadClip,
    settings,
    remainingMs: 60_000,
    targetMs: 90_000,
  });
  assert.equal(chunk.entries.some((entry) => entry.step.kind === "speak"), false);
  assert.equal(chunk.endsSession, true);
});

// --- Player -----------------------------------------------------------------------------

/** Fake <audio>: records what the player does; the test moves time and ends tracks. */
function fakeOutput() {
  const loaded: Chunk[] = [];
  let handlers: Parameters<AudioOutput["listen"]>[0] | undefined;
  const state = { playing: false, positionMs: 0 };
  const output: AudioOutput = {
    load: (chunk) => {
      loaded.push(chunk);
      state.positionMs = 0;
    },
    play: () => {
      state.playing = true;
    },
    pause: () => {
      state.playing = false;
    },
    setRate: () => {},
    positionMs: () => state.positionMs,
    listen: (next) => {
      handlers = next;
    },
  };
  return {
    output,
    loaded,
    state,
    moveTo: (ms: number) => {
      state.positionMs = ms;
      handlers?.time();
    },
    endTrack: () => {
      state.playing = false;
      handlers?.ended();
    },
    interrupt: () => {
      state.playing = false;
      handlers?.interrupted();
    },
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function setup(options: { durationMs?: number; lap?: () => Segment[] } = {}) {
  const fake = fakeOutput();
  const clock = { now: 0 };
  const ended: string[] = [];
  const player = new Player(
    {
      durationMs: options.durationMs ?? 60 * 60_000,
      settings,
      createLap: options.lap ?? (() => [segment("a"), segment("b"), segment("c")]),
      onSegmentEnd: (s) => ended.push(s.label),
    },
    { loadClip, output: fake.output, now: () => clock.now },
  );
  return { player, fake, clock, ended };
}

test("player: plays the first track, then the next one when it ends", async () => {
  const { player, fake } = setup();
  player.play();
  await flush();
  assert.equal(fake.loaded.length, 1);
  assert.equal(fake.state.playing, true);
  assert.ok(fake.loaded[0].durationMs >= FIRST_CHUNK_MS);
  fake.endTrack();
  await flush();
  assert.equal(fake.loaded.length, 2);
  assert.equal(fake.state.playing, true);
  assert.equal(player.getSnapshot().status, "playing");
});

test("player: follows playback for the screen and reports listened segments", async () => {
  const { player, fake, ended } = setup();
  player.play();
  await flush();
  assert.equal(player.getSnapshot().segment?.label, "a");
  fake.moveTo(SPEAK_MS + PAUSE_BASE_MS + 10); // inside "b"
  assert.equal(player.getSnapshot().segment?.label, "b");
  assert.deepEqual(ended, ["a"]);
});

test("player: the last track ends the session", async () => {
  const { player, fake } = setup({ durationMs: 2000 });
  player.play();
  await flush();
  assert.equal(fake.loaded[0].endsSession, true);
  fake.endTrack();
  await flush();
  assert.equal(player.getSnapshot().status, "ended");
});

test("player: a system interruption pauses the player and the timer; play resumes the same track", async () => {
  const { player, fake, clock } = setup();
  player.play();
  await flush();
  clock.now = 3000;
  fake.interrupt();
  assert.equal(player.getSnapshot().status, "paused");
  clock.now = 60_000;
  assert.equal(player.elapsedMs(), 3000);
  player.play();
  assert.equal(fake.state.playing, true);
  assert.equal(fake.loaded.length, 1);
});

test("player: next and previous rebuild from the neighbouring segment", async () => {
  const { player, fake, ended } = setup();
  player.play();
  await flush();
  player.next();
  await flush();
  assert.equal(fake.loaded.at(-1)?.entries[0].segment.label, "b");
  player.previous();
  await flush();
  assert.equal(fake.loaded.at(-1)?.entries[0].segment.label, "a");
  assert.deepEqual(ended, [], "skipped segments are not counted as listened");
});

test("player: an empty playlist ends immediately", () => {
  const { player } = setup({ lap: () => [] });
  player.play();
  assert.equal(player.getSnapshot().status, "ended");
});
