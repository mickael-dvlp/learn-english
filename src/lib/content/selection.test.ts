import assert from "node:assert/strict";
import { test } from "node:test";
import type { Collection } from "./collections";
import type { ContentItem } from "./schema";
import { resolveSelection, selectionItems, selectionTitle, toggleSelection } from "./selection";

const word = (id: string): ContentItem => ({ id: `word-${id}`, type: "word", theme: "t", en: id, fr: id });
const verb = (id: string): ContentItem => ({ id: `verb-${id}`, type: "verb", base: id, past: id, pastParticiple: id, fr: id, regular: true });

const fruits: Collection = {
  id: "theme-fruits",
  type: "word",
  label: "🍎 Fruits",
  familyId: "daily",
  items: [word("apple"), word("pear"), word("plum")],
  groups: [{ id: "red", label: "Rouges", itemIds: ["word-apple", "word-plum"] }],
};
const vegetables: Collection = { id: "theme-vegetables", type: "word", label: "🥕 Légumes", familyId: "daily", items: [word("leek")] };
const colours: Collection = { id: "theme-colours", type: "word", label: "🎨 Couleurs", familyId: "basics", items: [word("plum"), word("red")] };
const allVerbs: Collection = { id: "verbs-all", type: "verb", label: "Tous les verbes", familyId: "sentences", items: [verb("go"), verb("walk")] };
const irregular: Collection = { id: "verbs-irregular", type: "verb", label: "Irréguliers", familyId: "sentences", items: [verb("go")] };
const sources = [colours, fruits, vegetables, allVerbs, irregular];

test("the selection keeps the display order, existing collections only, of the type of the first chosen", () => {
  assert.deepEqual(resolveSelection(sources, ["theme-vegetables", "theme-colours"]).map((s) => s.id), ["theme-colours", "theme-vegetables"]);
  assert.deepEqual(resolveSelection(sources, ["theme-fruits", "verbs-all", "theme-gone"]).map((s) => s.id), ["theme-fruits"]);
  assert.deepEqual(resolveSelection(sources, undefined).map((s) => s.id), ["theme-colours"], "nothing chosen yet: the first one");
  assert.deepEqual(resolveSelection(sources, ["theme-gone"]).map((s) => s.id), ["theme-colours"]);
  assert.deepEqual(resolveSelection([], undefined), []);
});

test("tapping adds or removes a collection of the same type, replaces the selection otherwise, one always stays", () => {
  assert.deepEqual(toggleSelection([fruits], vegetables), ["theme-fruits", "theme-vegetables"]);
  assert.deepEqual(toggleSelection([fruits, vegetables], fruits), ["theme-vegetables"]);
  assert.deepEqual(toggleSelection([fruits], fruits), ["theme-fruits"], "the last one stays chosen");
  assert.deepEqual(toggleSelection([fruits, vegetables], allVerbs), ["verbs-all"], "words and verbs are not mixed");
  const book = (id: string): Collection => ({ id, type: "book", label: id, familyId: "books", items: [] });
  assert.deepEqual(toggleSelection([book("book-a")], book("book-b")), ["book-b"], "a book is listened to on its own");
});

test("items of several collections are played once each; a sub-theme only applies to a single collection", () => {
  assert.deepEqual(selectionItems([colours, fruits], undefined).map((i) => i.id), ["word-plum", "word-red", "word-apple", "word-pear"]);
  assert.deepEqual(selectionItems([allVerbs, irregular], undefined).map((i) => i.id), ["verb-go", "verb-walk"]);
  assert.deepEqual(selectionItems([fruits], "red").map((i) => i.id), ["word-apple", "word-plum"]);
  assert.deepEqual(selectionItems([fruits, vegetables], "red").length, 4);
});

test("the session title names the chosen collections", () => {
  assert.equal(selectionTitle([fruits]), "🍎 Fruits");
  assert.equal(selectionTitle([fruits, vegetables]), "🍎 Fruits + 🥕 Légumes");
  assert.equal(selectionTitle([colours, fruits, vegetables, allVerbs, irregular]), "🎨 Couleurs + 🍎 Fruits + 3 autres");
});
