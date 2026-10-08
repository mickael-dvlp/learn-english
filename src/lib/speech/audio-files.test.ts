import assert from "node:assert/strict";
import { test } from "node:test";
import { loadContent } from "@/lib/content/load";
import { audioPath, spokenText } from "./audio-files";
import { listSpokenTexts } from "./spoken-texts";

test("audioPath is stable, and depends on the language and the spoken text", () => {
  assert.match(audioPath("en", "tractor"), /^audio\/en\/[0-9a-z]+\.mp3$/);
  assert.equal(audioPath("en", "tractor"), audioPath("en", "tractor"));
  assert.notEqual(audioPath("en", "tractor"), audioPath("en", "tractors"));
  assert.notEqual(audioPath("en", "tractor").slice(9), audioPath("fr", "tractor").slice(9));
  // Same spoken text, same file.
  assert.equal(audioPath("en", "was / were"), audioPath("en", "was, were"));
});

test("spokenText reads slashes as a short pause", () => {
  assert.equal(spokenText("be, was / were,  been"), "be, was, were, been");
});

test("listSpokenTexts covers patterns and study examples, without duplicates", () => {
  const { library } = loadContent();
  const spoken = listSpokenTexts(library);
  const has = (lang: string, text: string) => spoken.some((s) => s.lang === lang && s.text === text);
  assert.ok(has("en", "be, was / were, been"), "verb forms");
  assert.ok(has("fr", "tracteur"), "word translation");
  assert.ok(has("en", "It is early in the morning."), "text sentence");
  assert.ok(has("en", "The farmer drives a red tractor."), "word example (study mode)");
  assert.equal(new Set(spoken.map((s) => s.path)).size, spoken.length);
});
