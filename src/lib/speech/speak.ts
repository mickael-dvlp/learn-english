import type { Lang, PlayableUnit } from "@/lib/player/types";

/**
 * The only door to the voice. The player calls `speak()` and never the Web Speech API directly:
 * an audio file is played when the unit has one for this language, the native voice otherwise.
 * Always resolves (end, error or `cancelSpeech()`), never rejects.
 */
export function speak(unit: PlayableUnit, lang: Lang, rate = 1): Promise<void> {
  const text = unit[lang];
  const file = unit.audio?.[lang];
  if (file) return playFile(file, rate, () => (text ? speakNative(text, lang, rate) : Promise.resolve()));
  if (text) return speakNative(text, lang, rate);
  return Promise.resolve();
}

/** Interrupts whatever is being said; the pending `speak()` promise resolves. */
export function cancelSpeech(): void {
  stopCurrent?.();
}

const LOCALES: Record<Lang, string> = { en: "en-GB", fr: "fr-FR" };

let stopCurrent: (() => void) | undefined;

function playFile(file: string, rate: number, fallback: () => Promise<void>): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(`/audio/${file}`);
    audio.playbackRate = rate;
    let settled = false;
    const settle = () => {
      if (settled) return false;
      settled = true;
      audio.onended = audio.onerror = null;
      if (stopCurrent === stop) stopCurrent = undefined;
      return true;
    };
    const stop = () => {
      audio.pause();
      if (settle()) resolve();
    };
    // Missing or unreadable file: fall back to the native voice rather than staying silent.
    const fail = () => {
      if (settle()) void fallback().then(resolve);
    };
    audio.onended = () => settle() && resolve();
    audio.onerror = fail;
    stopCurrent = stop;
    audio.play().catch(fail);
  });
}

// Keeps a reference to the utterance: some Chrome versions garbage-collect it and never fire `onend`.
let currentUtterance: SpeechSynthesisUtterance | undefined;

function speakNative(text: string, lang: Lang, rate: number): Promise<void> {
  const synth = typeof window === "undefined" ? undefined : window.speechSynthesis;
  if (!synth) return Promise.resolve();

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(normalize(text));
    utterance.lang = LOCALES[lang];
    utterance.rate = rate;
    const voice = pickVoice(synth, lang);
    if (voice) utterance.voice = voice;

    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      clearTimeout(watchdog);
      if (currentUtterance === utterance) currentUtterance = undefined;
      if (stopCurrent === stop) stopCurrent = undefined;
      resolve();
    };
    const stop = () => {
      synth.cancel();
      done();
    };
    // Safety net: some engines occasionally never fire `onend`.
    const watchdog = setTimeout(done, 5000 + (text.split(/\s+/).length * 800) / rate);

    utterance.onend = done;
    utterance.onerror = done;
    currentUtterance = utterance;
    stopCurrent = stop;
    synth.speak(utterance);
  });
}

/** "was / were" would be read "was slash were". */
function normalize(text: string): string {
  return text.replace(/\s*\/\s*/g, ", ");
}

/** Prefers voices installed on the device: they also work offline. */
function pickVoice(synth: SpeechSynthesis, lang: Lang): SpeechSynthesisVoice | undefined {
  const voices = synth.getVoices().filter((voice) => voice.lang.replace("_", "-").toLowerCase().startsWith(lang));
  const preferred = LOCALES[lang].toLowerCase();
  const score = (voice: SpeechSynthesisVoice) =>
    (voice.localService ? 2 : 0) + (voice.lang.replace("_", "-").toLowerCase() === preferred ? 1 : 0);
  return voices.sort((a, b) => score(b) - score(a))[0];
}

/** Chrome loads the voice list asynchronously: ask for it early. */
export function preloadVoices(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener("voiceschanged", () => window.speechSynthesis.getVoices(), { once: true });
}
