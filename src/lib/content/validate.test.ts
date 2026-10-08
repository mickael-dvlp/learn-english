import assert from "node:assert/strict";
import { test } from "node:test";
import { loadContent } from "./load";
import { validateContent, type RawContent } from "./validate";

const theme = { id: "cuisine", name: { en: "Cooking", fr: "Cuisine" } };
const word = { id: "word-pan", type: "word", theme: "cuisine", en: "pan", fr: "poêle", level: "A2" };
const text = {
  id: "text-dinner",
  type: "text",
  title: { en: "Dinner", fr: "Le dîner" },
  sentences: [{ en: "We eat.", fr: "Nous mangeons." }],
  level: "A1",
};

function raw(overrides: Partial<RawContent> = {}): RawContent {
  return {
    themes: { path: "themes.json", data: [theme] },
    words: [{ path: "words/cuisine.json", data: [word] }],
    verbs: [],
    rules: [],
    texts: [{ path: "texts/dinner.json", data: text }],
    ...overrides,
  };
}

test("accepts valid content", () => {
  const { library, errors } = validateContent(raw());
  assert.deepEqual(errors, []);
  assert.equal(library.words[0].id, "word-pan");
  assert.equal(library.texts[0].id, "text-dinner");
});

test("rejects duplicate ids across files", () => {
  const { errors } = validateContent(
    raw({ words: [{ path: "words/a.json", data: [word] }, { path: "words/b.json", data: [word] }] }),
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /double.*word-pan/);
});

test("rejects unknown theme", () => {
  const { errors } = validateContent(
    raw({ words: [{ path: "words/x.json", data: [{ ...word, theme: "garage" }] }] }),
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /garage/);
});

test("rejects invalid level, missing field and badly formatted id", () => {
  const withoutFr: Record<string, unknown> = { ...word };
  delete withoutFr.fr;
  const { errors } = validateContent(
    raw({
      words: [
        {
          path: "words/cuisine.json",
          data: [
            { ...word, level: "Z9" },
            { ...withoutFr, id: "word-oven" },
            { ...word, id: "pan" },
          ],
        },
      ],
    }),
  );
  assert.equal(errors.length, 3);
  assert.match(errors[0], /\[0\].*level/);
  assert.match(errors[1], /\[1\] \(word-oven\).*fr/);
  assert.match(errors[2], /\[2\].*id/);
});

test("rejects unknown fields (typos)", () => {
  const { errors } = validateContent(
    raw({ words: [{ path: "words/cuisine.json", data: [{ ...word, exemple: "oops" }] }] }),
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /exemple/);
});

test("rejects tense on a special rule", () => {
  const rule = {
    id: "rule-x",
    type: "rule",
    kind: "special",
    tense: "present",
    title: { en: "X", fr: "X" },
    explanation: "…",
    examples: [{ en: "a", fr: "b" }],
    level: "A1",
  };
  const { errors } = validateContent(raw({ rules: [{ path: "rules/special.json", data: [rule] }] }));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /tense/);
});

test("rejects a words file that is not an array", () => {
  const { errors } = validateContent(raw({ words: [{ path: "words/cuisine.json", data: word }] }));
  assert.deepEqual(errors, ["words/cuisine.json : le fichier doit contenir un tableau"]);
});

test("the real /content folder is valid", () => {
  const { errors } = loadContent();
  assert.deepEqual(errors, []);
});
