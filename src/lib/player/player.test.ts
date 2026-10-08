import assert from "node:assert/strict";
import { test } from "node:test";
import { PAUSE_BASE_MS } from "./pause";
import { Player, type PlayerDeps } from "./player";
import type { Segment, Step } from "./types";

const SPEAK_MS = 1000;

/** Fake world: speaking takes 1 s, pauses take their duration, time is virtual. */
function fakeDeps() {
  const log: string[] = [];
  const clock = { now: 0 };
  let resolveHeld: (() => void) | undefined;
  const deps: PlayerDeps & { hold: boolean } = {
    hold: false,
    async speak(unit, lang) {
      log.push(unit[lang] ?? "?");
      if (deps.hold) {
        await new Promise<void>((resolve) => (resolveHeld = resolve));
        return;
      }
      clock.now += SPEAK_MS;
    },
    cancel() {
      log.push("(cancel)");
      resolveHeld?.();
      resolveHeld = undefined;
    },
    async wait(ms) {
      log.push("…");
      clock.now += ms;
    },
    now: () => clock.now,
  };
  return { deps, log, clock };
}

const say = (text: string): Step => ({ kind: "speak", unit: { id: text, en: text }, lang: "en", rate: 1 });
const pause: Step = { kind: "pause", words: 0, scale: 1 };
const segment = (...texts: string[]): Segment => ({
  itemId: texts[0],
  label: texts[0],
  steps: texts.flatMap((text) => [say(text), pause]),
});

const settings = { rate: 1, pauseFactor: 1 };

function untilEnded(player: Player) {
  return new Promise<void>((resolve) => {
    const check = () => player.getSnapshot().status === "ended" && resolve();
    player.subscribe(check);
    check();
  });
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("plays every step in order and loops until time is up", async () => {
  const { deps, log } = fakeDeps();
  let laps = 0;
  const player = new Player(
    { durationMs: 3 * SPEAK_MS + 2 * PAUSE_BASE_MS, settings, createLap: () => (laps++, [segment("a"), segment("b")]) },
    deps,
  );
  player.play();
  await untilEnded(player);
  // a, pause, b, pause, then a new lap: time runs out while "a" plays, so its pause is skipped.
  assert.deepEqual(log, ["a", "…", "b", "…", "a"]);
  assert.equal(laps, 2);
});

test("time up: finishes the current segment, skipping its pauses", async () => {
  const { deps, log } = fakeDeps();
  const player = new Player({ durationMs: 500, settings, createLap: () => [segment("one", "two", "three")] }, deps);
  player.play();
  await untilEnded(player);
  assert.deepEqual(log, ["one", "two", "three"]);
});

test("pause interrupts speech and stops the clock; play restarts the step", async () => {
  const { deps, log, clock } = fakeDeps();
  const player = new Player({ durationMs: 60_000, settings, createLap: () => [segment("a"), segment("b")] }, deps);
  deps.hold = true;
  player.play();
  await flush();
  clock.now += 400;
  player.pause();
  assert.equal(player.getSnapshot().status, "paused");
  assert.equal(player.elapsedMs(), 400);

  clock.now += 10_000;
  assert.equal(player.elapsedMs(), 400);

  deps.hold = false;
  player.play();
  await flush();
  assert.deepEqual(log.slice(0, 4), ["a", "(cancel)", "a", "…"]);
  player.stop();
});

test("next and previous jump between segments", async () => {
  const { deps, log } = fakeDeps();
  const player = new Player(
    { durationMs: 60_000, settings, createLap: () => [segment("a"), segment("b"), segment("c")] },
    deps,
  );
  deps.hold = true;
  player.play();
  await flush();
  player.next();
  await flush();
  assert.equal(player.getSnapshot().segment?.label, "b");
  player.previous();
  await flush();
  assert.equal(player.getSnapshot().segment?.label, "a");
  player.stop();
  assert.deepEqual(log, ["a", "(cancel)", "b", "(cancel)", "a", "(cancel)"]);
});

test("an empty playlist ends immediately", () => {
  const { deps } = fakeDeps();
  const player = new Player({ durationMs: 60_000, settings, createLap: () => [] }, deps);
  player.play();
  assert.equal(player.getSnapshot().status, "ended");
});
