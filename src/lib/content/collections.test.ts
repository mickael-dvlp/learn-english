import assert from "node:assert/strict";
import { test } from "node:test";
import { familyCountLabel, itemsOf, listCollections } from "./collections";
import { loadContent } from "./load";
import type { ContentLibrary } from "./validate";

const word = (id: string, theme: string) =>
  ({ id: `word-${id}`, type: "word", theme, en: id, fr: id }) as const;

const library: ContentLibrary = {
  families: [
    { id: "basics", name: { en: "Basics", fr: "Bases" } },
    { id: "sentences", name: { en: "Sentences", fr: "Phrases" }, includes: ["verbs", "rules"] },
    { id: "texts", name: { en: "Texts", fr: "Textes" }, includes: ["texts"] },
  ],
  themes: [
    { id: "links", name: { en: "Links", fr: "Liens" }, family: "sentences" },
    { id: "colours", name: { en: "Colours", fr: "Couleurs" }, family: "basics", emoji: "🎨" },
    { id: "empty", name: { en: "Empty", fr: "Vide" }, family: "basics" },
  ],
  words: [word("red", "colours"), word("and", "links")],
  verbs: [{ id: "verb-go", type: "verb", base: "go", past: "went", pastParticiple: "gone", fr: "aller", regular: false }],
  rules: [],
  texts: [],
  pairs: [],
  verbGroups: [],
  ruleGroups: [],
};

test("collections follow the families, sections before themes, empty ones left out", () => {
  const collections = listCollections(library);
  assert.deepEqual(
    collections.map((c) => `${c.familyId}/${c.id}`),
    ["basics/theme-colours", "sentences/verbs-all", "sentences/verbs-irregular", "sentences/theme-links"],
  );
  assert.equal(collections[0].label, "🎨 Couleurs");
});

test("existing collection ids are unchanged (progress and listening preferences refer to them)", () => {
  const ids = listCollections(loadContent().library).map((c) => c.id);
  for (const id of ["theme-agriculture", "theme-cuisine", "theme-argent", "verbs-all", "verbs-irregular", "verbs-regular", "rules-all", "text-at-the-farm"]) {
    assert.ok(ids.includes(id), id);
  }
});

test("every theme of the real content is in a family and has words", () => {
  const { library: real } = loadContent();
  const collections = listCollections(real);
  for (const theme of real.themes) {
    const collection = collections.find((c) => c.id === `theme-${theme.id}`);
    assert.ok(collection, `${theme.id} has no words`);
    assert.equal(collection.familyId, theme.family);
  }
});

test("sub-themes order the items, borrowed words included, and filter them", () => {
  const grouped: ContentLibrary = {
    ...library,
    themes: [
      ...library.themes,
      {
        id: "talk",
        name: { en: "Talk", fr: "Parler" },
        family: "sentences",
        groups: [
          { id: "start", name: { en: "Start", fr: "Commencer" } },
          { id: "react", name: { en: "React", fr: "Réagir" }, also: ["word-red"] },
          { id: "empty", name: { en: "Empty", fr: "Vide" } },
        ],
      },
    ],
    words: [...library.words, { ...word("wow", "talk"), group: "react" }, { ...word("hi", "talk"), group: "start" }],
  };
  const talk = listCollections(grouped).find((c) => c.id === "theme-talk");
  assert.ok(talk);
  assert.deepEqual(talk.items.map((i) => i.id), ["word-hi", "word-wow", "word-red"]);
  assert.deepEqual(
    talk.groups?.map((g) => [g.label, g.itemIds]),
    [
      ["Commencer", ["word-hi"]],
      ["Réagir", ["word-wow", "word-red"]],
    ],
  );
  assert.deepEqual(itemsOf(talk, "react").map((i) => i.id), ["word-wow", "word-red"]);
  assert.equal(itemsOf(talk, undefined).length, 3);
  assert.equal(itemsOf(talk, "unknown").length, 3);
});

test("the real content: new themes, all the dialogues together, verbs by sub-theme", () => {
  const collections = listCollections(loadContent().library);
  const byId = (id: string) => collections.find((c) => c.id === id);
  for (const id of ["theme-conversation", "theme-quantites", "theme-adverbes", "theme-verbes-particule", "theme-prononciation"]) {
    assert.ok((byId(id)?.groups?.length ?? 0) > 1, id);
  }
  assert.equal(byId("theme-quantites")?.familyId, "fondations");
  assert.equal(byId("theme-prononciation")?.type, "pair");
  const dialogues = byId("dialogues-all");
  assert.ok(dialogues && dialogues.items.length >= 12);
  assert.ok(dialogues.items.every((item) => item.type === "text" && item.kind === "dialogue"));
  const all = byId("verbs-all");
  assert.ok(all?.groups && all.groups.length >= 7);
  const irregular = byId("verbs-irregular")?.items.length ?? 0;
  const regular = byId("verbs-regular")?.items.length ?? 0;
  assert.equal(irregular + regular, all.items.length, "every verb is either regular or irregular");
});

test("modals have their own section, by function; rules hold the rest", () => {
  const { library: real } = loadContent();
  const collections = listCollections(real);
  const modals = collections.find((c) => c.id === "modals");
  const rules = collections.find((c) => c.id === "rules-all");
  assert.ok(modals && rules);
  assert.equal(modals.familyId, "phrases");
  assert.ok(modals.items.every((item) => item.type === "rule" && item.kind === "modal"));
  assert.ok(rules.items.every((item) => item.type === "rule" && item.kind !== "modal"));
  assert.deepEqual(modals.groups?.map((g) => g.id), ["rappel", "capacite", "permission", "demandes", "obligation", "conseil", "possibilite", "futur", "habitudes"]);
  assert.equal(collections.find((c) => c.id === "verbs-all")?.label, "⚡ Tous les verbes simples");
  const ids = collections.map((c) => c.id);
  assert.ok(ids.indexOf("verbs-regular") < ids.indexOf("modals") && ids.indexOf("modals") < ids.indexOf("rules-all"));
});

test("family counts: all the dialogues is not counted, texts and dialogues are told apart", () => {
  const { library: real } = loadContent();
  const collections = listCollections(real);
  const texts = real.families.find((f) => f.id === "textes");
  const phrases = real.families.find((f) => f.id === "phrases");
  assert.ok(texts && phrases);
  assert.equal(familyCountLabel(texts, collections.filter((c) => c.familyId === "textes")), "1 texte · 12 dialogues");
  assert.equal(familyCountLabel(phrases, [{}, {}, {}]), "3 rubriques");
  assert.equal(familyCountLabel(real.families[0], [{}]), "1 thème");
});
