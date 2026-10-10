import assert from "node:assert/strict";
import { test } from "node:test";
import { loadContent } from "@/lib/content/load";
import type { Pair, Rule, TextItem, Word } from "@/lib/content/schema";
import { compileItem, fillTemplate, lapFactory, shuffleAfter } from "./compile";
import { PATTERNS, choosePattern, findPattern, patternsFor, type Pattern } from "./patterns";
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

const modal: Rule = {
  id: "rule-x",
  type: "rule",
  kind: "modal",
  title: { en: "can", fr: "can : capacité" },
  explanation: "Une longue explication en français.",
  forms: [
    { kind: "affirmative", en: "I can swim.", fr: "Je sais nager." },
    { kind: "negative", en: "I can't swim.", fr: "Je ne sais pas nager." },
    { kind: "question", en: "Can you swim?", fr: "Tu sais nager ?" },
  ],
  examples: [
    { en: "She can drive.", fr: "Elle sait conduire." },
    { en: "We can't come.", fr: "Nous ne pouvons pas venir." },
  ],
};

test("rule: its name, then each form and example as a segment, never the explanation", () => {
  const segments = compileItem(modal, pattern("rule"));
  assert.equal(segments[0].intro, true);
  assert.deepEqual(said(segments[0].steps), ["fr:can : capacité", "pause×1"]);
  const parts = segments.slice(1);
  assert.deepEqual(parts.map((s) => s.label), ["I can swim.", "I can't swim.", "Can you swim?", "She can drive.", "We can't come."]);
  assert.deepEqual(parts.map((s) => s.part?.index), [0, 1, 2, 3, 4], "numbered across forms and examples");
  assert.ok(parts.every((s) => s.part?.count === 5 && s.part.needed === 3 && s.context === "can : capacité"));
  assert.deepEqual(said(parts[3].steps), ["en:She can drive.", "pause×1", "fr:Elle sait conduire.", "pause×1", "en:She can drive.", "pause×1.5"]);
  const all = segments.flatMap((s) => s.steps);
  assert.ok(all.every((step) => step.kind !== "speak" || step.unit[step.lang] !== modal.explanation));
});

test("rule in English only: no French", () => {
  const steps = compileItem(modal, pattern("rule-en-only")).flatMap((s) => s.steps);
  assert.ok(steps.every((step) => step.kind !== "speak" || step.lang === "en"));
});

test("a text needs every sentence, a rule most of its sentences", () => {
  const [, ...lines] = compileItem(dialogue, pattern("text"));
  assert.ok(lines.every((s) => s.part?.needed === 3));
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
  const items = [...library.words, ...library.verbs, ...library.rules, ...library.texts, ...library.pairs];
  for (const p of PATTERNS) {
    for (const item of items.filter((i) => p.appliesTo.includes(i.type))) {
      assert.ok(compileItem(item, p).length > 0, `${p.id} × ${item.id}`);
    }
  }
  for (const type of ["word", "verb", "rule", "text", "pair"] as const) {
    assert.ok(patternsFor(type).length > 0, `no pattern for ${type}`);
  }
});

const dialogue: TextItem = {
  id: "text-hi",
  type: "text",
  kind: "dialogue",
  title: { en: "Hi", fr: "Salut" },
  sentences: [
    { en: "Hi!", fr: "Salut !", speaker: "Anna" },
    { en: "Hello!", fr: "Bonjour !", speaker: "Ben" },
    { en: "How are you?", fr: "Ça va ?", speaker: "Anna" },
  ],
};

test("dialogue: lines in order, numbered, with their speaker; the second speaker has the second voice", () => {
  const segments = compileItem(dialogue, pattern("text-en-fr-en"));
  assert.equal(segments[0].intro, true, "the title alone does not count as listened");
  const lines = segments.slice(1);
  assert.deepEqual(
    lines.map((s) => [s.speaker, s.part?.index, s.part?.count, s.context]),
    [
      ["Anna", 0, 3, "Hi"],
      ["Ben", 1, 3, "Hi"],
      ["Anna", 2, 3, "Hi"],
    ],
  );
  const voices = lines.map((s) =>
    s.steps.flatMap((step) => (step.kind === "speak" && step.lang === "en" ? [step.voice ?? "usual"] : [])),
  );
  assert.deepEqual(voices, [
    ["usual", "usual"],
    ["alt", "alt"],
    ["usual", "usual"],
  ]);
  assert.deepEqual(said(lines[1].steps), ["en:Hello!", "pause×1", "fr:Bonjour !", "pause×1", "en:Hello!", "pause×1.5"]);
});

test("dialogue in English only: no French at all", () => {
  const steps = compileItem(dialogue, pattern("text-en-only")).flatMap((s) => s.steps);
  assert.ok(steps.every((step) => step.kind !== "speak" || step.lang === "en"));
});

test("random order shuffles dialogues, never their lines", () => {
  const other = { ...dialogue, id: "text-other", title: { en: "Other", fr: "Autre" } };
  for (const seed of [0, 0.5, 0.99]) {
    const lap = lapFactory([dialogue, other], pattern("text"), "random", () => seed)();
    for (const id of [dialogue.id, other.id]) {
      const parts = lap.filter((s) => s.itemId === id && s.part).map((s) => s.part?.index);
      assert.deepEqual(parts, [0, 1, 2]);
    }
  }
});

test("pair: the words one after the other, a longer pause at the end, one segment", () => {
  const pair: Pair = {
    id: "pair-ship-sheep",
    type: "pair",
    theme: "prononciation",
    words: [
      { en: "ship", fr: "bateau" },
      { en: "sheep", fr: "mouton" },
    ],
    explanation: "…",
  };
  const [once, ...rest] = compileItem(pair, pattern("pair-once"));
  assert.equal(rest.length, 0);
  assert.equal(once.label, "ship / sheep");
  assert.equal(once.intro, undefined);
  assert.deepEqual(said(once.steps), ["en:ship", "pause×0.6", "en:sheep", "pause×0.6", "pause×2"]);
  const [twice] = compileItem(pair, pattern("pair-twice"));
  assert.deepEqual(
    said(twice.steps).filter((s) => s.startsWith("en")),
    ["en:ship", "en:sheep", "en:ship", "en:sheep"],
  );
});

test("choosePattern keeps the chosen mode across types when it exists (same name)", () => {
  assert.equal(choosePattern("text", "en-only-loop").id, "text-en-only");
  assert.equal(choosePattern("text", "en-fr-en").id, "text-en-fr-en");
  assert.equal(choosePattern("word", "text-en-only").id, "en-only-loop");
  assert.equal(choosePattern("pair", "en-fr-en").id, "pair-once");
  assert.equal(choosePattern("verb", undefined).id, "verb-forms");
});
