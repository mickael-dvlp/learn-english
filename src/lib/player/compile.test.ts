import assert from "node:assert/strict";
import { test } from "node:test";
import { loadContent } from "@/lib/content/load";
import type { Rule, TextItem, Word } from "@/lib/content/schema";
import { compileItem, fillTemplate, lapFactory, shuffleAfter } from "./compile";
import { PATTERNS, findPattern, patternsFor, type Pattern } from "./patterns";
import { DEFAULT_SETTINGS, pauseMs } from "./pause";
import type { Step } from "./types";

const pattern = (id: string): Pattern => {
  const found = findPattern(id);
  assert.ok(found, `pattern ${id}`);
  return found;
};

const said = (steps: Step[]) =>
  steps.map((step) => (step.kind === "speak" ? `${step.lang}:${step.unit[step.lang]}` : `pause×${step.scale}`));

const word: Word = {
  id: "word-tractor",
  type: "word",
  theme: "agriculture",
  en: "tractor",
  fr: "tracteur",
  level: "A1",
};

test("fillTemplate resolves paths and fallbacks, fails on missing fields", () => {
  const scope = { en: "go", title: { fr: "Aller" }, speakEn: "" };
  assert.equal(fillTemplate("{en} / {title.fr}", scope), "go / Aller");
  assert.equal(fillTemplate("{speakEn|en}", scope), "go");
  assert.equal(fillTemplate("{example.en}", scope), undefined);
});

test("en-fr-en: EN, pause, FR, pause, EN", () => {
  const [segment] = compileItem({ ...word, speakEn: "trac-tor" }, pattern("en-fr-en"));
  assert.equal(segment.label, "tractor — tracteur");
  assert.deepEqual(said(segment.steps), [
    "en:trac-tor",
    "pause×1",
    "fr:tracteur",
    "pause×1",
    "en:trac-tor",
    "pause×1.5",
  ]);
});

test("a step on a missing optional field is skipped with its pause", () => {
  const custom: Pattern = {
    id: "test",
    name: "test",
    description: "",
    appliesTo: ["word"],
    display: "{en}",
    steps: [{ say: "{example.en}", lang: "en" }, { pause: 1 }, { say: "{en}", lang: "en" }, { pause: 1 }],
  };
  const [segment] = compileItem(word, custom);
  assert.deepEqual(said(segment.steps), ["en:tractor", "pause×1"]);
});

test("text: a title segment, then one slow segment per sentence", () => {
  const text: TextItem = {
    id: "text-x",
    type: "text",
    title: { en: "At home", fr: "À la maison" },
    sentences: [
      { en: "I am home.", fr: "Je suis à la maison." },
      { en: "It is late.", fr: "Il est tard." },
    ],
    level: "A1",
  };
  const segments = compileItem(text, pattern("text"));
  assert.deepEqual(
    segments.map((segment) => segment.label),
    ["At home", "I am home.", "It is late."],
  );
  const sentence = segments[1].steps[0];
  assert.ok(sentence.kind === "speak");
  assert.equal(sentence.rate, 0.85);
});

test("rule: title, explanation and every example in a single segment", () => {
  const rule: Rule = {
    id: "rule-x",
    type: "rule",
    kind: "special",
    title: { en: "X", fr: "Titre" },
    explanation: "Explication.",
    examples: [
      { en: "A.", fr: "Un." },
      { en: "B.", fr: "Deux." },
    ],
    level: "A1",
  };
  const segments = compileItem(rule, pattern("rule"));
  assert.equal(segments.length, 1);
  assert.deepEqual(said(segments[0].steps).filter((s) => !s.startsWith("pause")), [
    "fr:Titre",
    "fr:Explication.",
    "en:A.",
    "fr:Un.",
    "en:B.",
    "fr:Deux.",
  ]);
});

test("pauses grow with the number of words and the user factor", () => {
  const short = pauseMs({ kind: "pause", words: 1, scale: 1 }, DEFAULT_SETTINGS);
  const long = pauseMs({ kind: "pause", words: 10, scale: 1 }, DEFAULT_SETTINGS);
  const slower = pauseMs({ kind: "pause", words: 1, scale: 1 }, { ...DEFAULT_SETTINGS, pauseFactor: 2 });
  assert.ok(long > short);
  assert.equal(slower, short * 2);
});

test("random order shuffles items but keeps the sentences of a text in order", () => {
  const words = ["a", "b", "c", "d"].map((en) => ({ ...word, id: `word-${en}`, en }));
  const sequential = lapFactory(words, pattern("en-only-loop"), "sequential")();
  const random = lapFactory(words, pattern("en-only-loop"), "random", () => 0)();
  assert.deepEqual(sequential.map((s) => s.label), ["a", "b", "c", "d"]);
  assert.deepEqual(random.map((s) => s.label), ["b", "c", "d", "a"]);
});

test("random laps: every item once per lap, and never back soon after the lap change", () => {
  for (let size = 1; size <= 12; size++) {
    const items = Array.from({ length: size }, (_, i) => i);
    const gap = Math.floor(size / 2);
    let previous: number[] = shuffleAfter(items, []);
    for (let lap = 0; lap < 300; lap++) {
      const next = shuffleAfter(items, previous);
      assert.deepEqual([...next].sort((a, b) => a - b), items, "each item exactly once");
      for (const item of items) {
        const between = size - 1 - previous.indexOf(item) + next.indexOf(item);
        assert.ok(between >= gap, `size ${size}: item ${item} back after ${between} items`);
      }
      previous = next;
    }
  }
});

test("every pattern produces something for every applicable item of /content", () => {
  const { library } = loadContent();
  const items = [...library.words, ...library.verbs, ...library.rules, ...library.texts];
  for (const p of PATTERNS) {
    for (const item of items.filter((i) => p.appliesTo.includes(i.type))) {
      assert.ok(compileItem(item, p).length > 0, `${p.id} × ${item.id}`);
    }
  }
  for (const type of ["word", "verb", "rule", "text"] as const) {
    assert.ok(patternsFor(type).length > 0, `no pattern for ${type}`);
  }
});
