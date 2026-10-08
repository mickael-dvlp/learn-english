import type { Lang } from "@/lib/player/types";

/**
 * Generated audio files are linked to the content automatically: one file per spoken text,
 * named after a hash of the voice and the text. Shared by the generation script and the app,
 * so both compute the same path. Changing a text or a voice gives a new file name.
 */

/** Edge TTS voices used to generate the files. */
export const VOICES: Record<Lang, string> = {
  en: "en-GB-SoniaNeural",
  fr: "fr-FR-DeniseNeural",
};

/** The text as it is actually said: "was / were" would be read "was slash were". */
export function spokenText(text: string): string {
  return text.replace(/\s*\/\s*/g, ", ").replace(/\s+/g, " ").trim();
}

/** Path under /public, e.g. `audio/en/1x2y3z.mp3`. */
export function audioPath(lang: Lang, text: string): string {
  return `audio/${lang}/${hash(`${VOICES[lang]}\n${spokenText(text)}`)}.mp3`;
}

/** cyrb53: small, fast, deterministic 53-bit string hash (not cryptographic, collisions negligible here). */
function hash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
