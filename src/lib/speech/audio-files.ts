import type { Lang, Voice } from "@/lib/player/types";

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

/** Second voices (second speaker of a dialogue). */
export const ALT_VOICES: Record<Lang, string> = {
  en: "en-GB-RyanNeural",
  fr: "fr-FR-HenriNeural",
};

export function voiceName(lang: Lang, voice?: Voice): string {
  return voice === "alt" ? ALT_VOICES[lang] : VOICES[lang];
}

/** The text as it is actually said: "was / were" would be read "was slash were". */
export function spokenText(text: string): string {
  return text.replace(/\s*\/\s*/g, ", ").replace(/\s+/g, " ").trim();
}

/**
 * Path under /public, e.g. `audio/en/1x2y3z.mp3`.
 * `rate` < 1 is a slower recording (generated slower, which sounds better than slowing down playback).
 * `voice`: the second voice; the usual voice gives the same names as before it existed.
 */
export function audioPath(lang: Lang, text: string, rate = 1, voice?: Voice): string {
  const speed = rate === 1 ? "" : `@${rate}\n`;
  return `audio/${lang}/${hash(`${voiceName(lang, voice)}\n${speed}${spokenText(text)}`)}.mp3`;
}

/** Files to try, best first: second voice (slow, normal), then the usual voice (slow, normal). */
export function audioCandidates(lang: Lang, text: string, rate = 1, voice?: Voice): string[] {
  const paths = [audioPath(lang, text, rate, voice), audioPath(lang, text, 1, voice), audioPath(lang, text, rate), audioPath(lang, text)];
  return [...new Set(paths)];
}

/** Edge TTS prosody rate, e.g. 0.85 → "-15%". */
export function prosodyRate(rate: number): string {
  const percent = Math.round((rate - 1) * 100);
  return `${percent >= 0 ? "+" : ""}${percent}%`;
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
