import assert from "node:assert/strict";
import { test } from "node:test";
import { loadContent } from "./load";
import { validateContent, type RawContent } from "./validate";

const family = {
  id: "daily",
  name: { en: "Daily life", fr: "Vie quotidienne" },
  includes: ["verbs", "modals", "rules", "texts"],
};
const theme = { id: "cuisine", name: { en: "Cooking", fr: "Cuisine" }, family: "daily" };
const word = { id: "word-pan", type: "word", theme: "cuisine", en: "pan", fr: "poêle" };
const text = {
  id: "text-dinner",
  type: "text",
  title: { en: "Dinner", fr: "Le dîner" },
  sentences: [{ en: "We eat.", fr: "Nous mangeons." }],
};

function raw(overrides: Partial<RawContent> = {}): RawContent {
  return {
    families: { path: "families.json", data: [family] },
    themes: { path: "themes.json", data: [theme] },
    words: [{ path: "words/cuisine.json", data: [word] }],
    verbs: [],
    rules: [],
    texts: [{ path: "texts/dinner.json", data: text }],
    pairs: [],
    verbGroups: undefined,
    ruleGroups: undefined,
    ...overrides,
  };
}

test("accepts valid content", () => {
  const { library, errors } = validateContent(raw());
  assert.deepEqual(errors, []);
  assert.equal(library.words[0].id, "word-pan");
  assert.equal(library.texts[0].id, "text-dinner");
});

const house = { id: "maison", name: { en: "House", fr: "Maison" }, family: "daily" };

test("rejects duplicate ids across files", () => {
  const { errors } = validateContent(
    raw({
      themes: { path: "themes.json", data: [theme, house] },
      words: [
        { path: "words/cuisine.json", data: [word] },
        { path: "words/maison.json", data: [{ ...word, theme: "maison" }] },
      ],
    }),
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /double.*word-pan/);
});

test("accepts empty word files", () => {
  const { library, errors } = validateContent(
    raw({
      themes: { path: "themes.json", data: [theme, house] },
      words: [
        { path: "words/cuisine.json", data: [] },
        { path: "words/maison.json", data: [] },
      ],
    }),
  );
  assert.deepEqual(errors, []);
  assert.equal(library.words.length, 0);
});

test("rejects a word file named after a theme missing from themes.json, even empty", () => {
  const { errors } = validateContent(raw({ words: [{ path: "words/garage.json", data: [] }] }));
  assert.deepEqual(errors, [`words/garage.json : le thème "garage" n'existe pas dans themes.json`]);
});

test("rejects a word whose theme does not exist or differs from its file", () => {
  const { errors } = validateContent(
    raw({ words: [{ path: "words/cuisine.json", data: [{ ...word, theme: "garage" }] }] }),
  );
  assert.equal(errors.length, 2);
  assert.match(errors[0], /word-pan : thème "garage", attendu "cuisine"/);
  assert.match(errors[1], /le thème "garage" n'existe pas/);
});

test("rejects duplicate theme ids", () => {
  const { errors } = validateContent(raw({ themes: { path: "themes.json", data: [theme, theme] } }));
  assert.deepEqual(errors, [`id de thème en double : "cuisine"`]);
});

test("rejects a level field (no levels in this app), missing field and badly formatted id", () => {
  const withoutFr: Record<string, unknown> = { ...word };
  delete withoutFr.fr;
  const { errors } = validateContent(
    raw({
      words: [
        {
          path: "words/cuisine.json",
          data: [
            { ...word, level: "A1" },
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

test("rejects a theme whose family is missing from families.json", () => {
  const { errors } = validateContent(raw({ themes: { path: "themes.json", data: [{ ...theme, family: "garage" }] } }));
  assert.deepEqual(errors, [`themes.json › cuisine : la famille "garage" n'existe pas dans families.json`]);
});

test("rejects duplicate family ids", () => {
  const other = { ...family, includes: undefined };
  const { errors } = validateContent(raw({ families: { path: "families.json", data: [family, other] } }));
  assert.deepEqual(errors, [`id de famille en double : "daily"`]);
});

test("verbs, rules and texts must each be in exactly one family", () => {
  const stories = { id: "stories", name: { en: "Stories", fr: "Histoires" }, includes: ["texts"] };
  const withoutRules = { ...family, includes: ["verbs", "modals", "texts"] };
  const { errors } = validateContent(raw({ families: { path: "families.json", data: [withoutRules, stories] } }));
  assert.deepEqual(errors, [
    `families.json : la section "rules" doit être incluse dans une seule famille (trouvée 0 fois)`,
    `families.json : la section "texts" doit être incluse dans une seule famille (trouvée 2 fois)`,
  ]);
});

const dialogue = {
  ...text,
  kind: "dialogue",
  situation: "Deux amis se saluent.",
  sentences: [
    { en: "Hi!", fr: "Salut !", speaker: "Anna" },
    { en: "Hello!", fr: "Bonjour !", speaker: "Ben" },
  ],
  expressions: [{ en: "Hi!", fr: "Salut !" }],
};

test("a dialogue has two speakers, a situation and key expressions", () => {
  const { library, errors } = validateContent(raw({ texts: [{ path: "texts/dinner.json", data: dialogue }] }));
  assert.deepEqual(errors, []);
  assert.equal(library.texts[0].sentences[1].speaker, "Ben");
});

test("rejects a dialogue with one speaker, or a line without speaker", () => {
  const oneSpeaker = { ...dialogue, sentences: dialogue.sentences.map((s) => ({ ...s, speaker: "Anna" })) };
  const missing = { ...dialogue, sentences: [...dialogue.sentences, { en: "Bye.", fr: "Au revoir." }] };
  for (const data of [oneSpeaker, missing]) {
    const { errors } = validateContent(raw({ texts: [{ path: "texts/dinner.json", data }] }));
    assert.equal(errors.length, 1);
    assert.match(errors[0], /deux interlocuteurs/);
  }
});

const grouped = {
  ...theme,
  groups: [
    { id: "tools", name: { en: "Tools", fr: "Ustensiles" } },
    { id: "rooms", name: { en: "Rooms", fr: "Pièces" }, also: ["word-kitchen"] },
  ],
};
const kitchen = { id: "word-kitchen", type: "word", theme: "maison", en: "kitchen", fr: "cuisine" };

test("sub-themes: every word has an existing one, words of other themes can be shown again", () => {
  const ok = validateContent(
    raw({
      themes: { path: "themes.json", data: [grouped, house] },
      words: [
        { path: "words/cuisine.json", data: [{ ...word, group: "tools" }] },
        { path: "words/maison.json", data: [kitchen] },
      ],
    }),
  );
  assert.deepEqual(ok.errors, []);

  const { errors } = validateContent(
    raw({
      themes: {
        path: "themes.json",
        data: [{ ...grouped, groups: [...grouped.groups, { id: "x", name: { en: "X", fr: "X" }, also: ["word-nope", "word-pan"] }] }, house],
      },
      words: [{ path: "words/cuisine.json", data: [{ ...word, id: "word-pot" }, { ...word, group: "nope" }] }],
    }),
  );
  assert.deepEqual(errors, [
    `thème "cuisine" › word-pot : sous-thème manquant (group)`,
    `thème "cuisine" › word-pan : le sous-thème "nope" n'existe pas`,
    `thème "cuisine" › also : le mot "word-kitchen" n'existe pas`,
    `thème "cuisine" › also : le mot "word-nope" n'existe pas`,
    `thème "cuisine" › also : "word-pan" est déjà dans ce thème`,
  ]);
});

test("a group on a word of a theme without sub-themes is an error", () => {
  const { errors } = validateContent(raw({ words: [{ path: "words/cuisine.json", data: [{ ...word, group: "tools" }] }] }));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /sans liste de sous-thèmes/);
});

const pair = {
  id: "pair-ship-sheep",
  type: "pair",
  theme: "cuisine",
  words: [
    { en: "ship", fr: "bateau", ipa: "/ʃɪp/" },
    { en: "sheep", fr: "mouton", ipa: "/ʃiːp/", example: { en: "Look, sheep!", fr: "Regarde, des moutons !" } },
  ],
  explanation: "Voyelle courte, voyelle longue.",
};

test("pronunciation pairs: two to four words, never mixed with words in a theme", () => {
  const ok = validateContent(raw({ words: [], pairs: [{ path: "pairs/cuisine.json", data: [pair] }] }));
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.library.pairs[0].words[1].ipa, "/ʃiːp/");

  const alone = validateContent(raw({ words: [], pairs: [{ path: "pairs/cuisine.json", data: [{ ...pair, words: [pair.words[0]] }] }] }));
  assert.equal(alone.errors.length, 1);

  const mixed = validateContent(raw({ pairs: [{ path: "pairs/cuisine.json", data: [pair] }] }));
  assert.deepEqual(mixed.errors, [`thème "cuisine" : des mots et des paires de prononciation ne peuvent pas être mélangés`]);
});

test("verbs and their sub-themes (verb-groups.json)", () => {
  const verb = { id: "verb-go", type: "verb", base: "go", past: "went", pastParticiple: "gone", fr: "aller", regular: false };
  const verbGroups = { path: "verb-groups.json", data: [{ id: "moving", name: { en: "Moving", fr: "Mouvement" } }] };
  const ok = validateContent(raw({ verbs: [{ path: "verbs/irregular.json", data: [{ ...verb, group: "moving" }] }], verbGroups }));
  assert.deepEqual(ok.errors, []);
  const { errors } = validateContent(raw({ verbs: [{ path: "verbs/irregular.json", data: [verb] }], verbGroups }));
  assert.deepEqual(errors, [`verbes › verb-go : sous-thème manquant (group)`]);
});

test("rules: sub-themes from rule-groups.json, forms and a frequent mistake", () => {
  const modal = {
    id: "rule-modal-can",
    type: "rule",
    kind: "modal",
    title: { en: "can", fr: "can" },
    meaning: "pouvoir",
    explanation: "…",
    structure: "sujet + can + base",
    forms: [{ kind: "negative", en: "I can't.", fr: "Je ne peux pas." }],
    examples: [{ en: "I can swim.", fr: "Je sais nager." }],
    mistake: { wrong: "I can to swim.", right: "I can swim.", note: "Pas de to." },
    group: "ability",
  };
  const ruleGroups = { path: "rule-groups.json", data: [{ id: "ability", name: { en: "Ability", fr: "Capacité" } }] };
  const ok = validateContent(raw({ rules: [{ path: "rules/modals.json", data: [modal] }], ruleGroups }));
  assert.deepEqual(ok.errors, []);
  const { errors } = validateContent(
    raw({
      rules: [
        {
          path: "rules/modals.json",
          data: [{ ...modal, id: "rule-modal-x", group: undefined }, { ...modal, forms: [{ kind: "maybe", en: "a", fr: "b" }] }],
        },
      ],
      ruleGroups,
    }),
  );
  assert.equal(errors.length, 2);
  assert.match(errors.join(), /forms\.0\.kind/);
  assert.match(errors.join(), /sous-thème manquant/);
});

test("a usage note on a word or a verb is shown, a verb can say its forms differently", () => {
  const verb = { id: "verb-read", type: "verb", base: "read", past: "read", pastParticiple: "read", fr: "lire", regular: false, note: "« red »", speak: "read, red, red" };
  const { library, errors } = validateContent(
    raw({ words: [{ path: "words/cuisine.json", data: [{ ...word, note: "familier" }] }], verbs: [{ path: "verbs/irregular.json", data: [verb] }] }),
  );
  assert.deepEqual(errors, []);
  assert.equal(library.words[0].note, "familier");
  assert.equal(library.verbs[0].speak, "read, red, red");
});
