import { debugLog } from "@/lib/debug/log";
import type { Lang, PlayableUnit } from "@/lib/player/types";
import { audioPath, spokenText } from "./audio-files";
import { silenceUrl } from "./silence";

/**
 * The only door to the voice. The player calls `speak()` and never the Web Speech API directly:
 * the generated audio file for this text is played when it exists, the native voice otherwise.
 * Audio files keep playing with the screen locked; the native voice does not (Android pauses it).
 * Always resolves (end, error or `cancelSpeech()`), never rejects.
 */
export function speak(unit: PlayableUnit, lang: Lang, rate = 1): Promise<void> {
  stopCurrent?.();
  const text = unit[lang];
  if (!text) return Promise.resolve();
  return playFile(`/${audioPath(lang, text)}`, rate, () => speakNative(text, lang, rate));
}

/**
 * A pause, played as silence through the same audio element as the voice.
 * The element never stops during a session: Android keeps the page running with the screen locked,
 * and the next step starts from the media "ended" event rather than from a timer (timers get frozen).
 */
export function waitSilently(ms: number): Promise<void> {
  stopCurrent?.();
  if (ms <= 0) return Promise.resolve();
  return playFile(silenceUrl(ms), 1, () => new Promise((resolve) => setTimeout(resolve, ms)));
}

/** Interrupts whatever is being said; the pending `speak()` promise resolves. */
export function cancelSpeech(): void {
  stopCurrent?.();
}

const LOCALES: Record<Lang, string> = { en: "en-GB", fr: "fr-FR" };

let stopCurrent: (() => void) | undefined;

/** Files known to be missing (not generated yet): go straight to the native voice next time. */
const missingFiles = new Set<string>();

/** A single element, reused: once allowed to play by a tap, it keeps that permission in the background. */
let voiceAudio: HTMLAudioElement | undefined;

function playFile(src: string, rate: number, fallback: () => Promise<void>): Promise<void> {
  if (missingFiles.has(src) || typeof Audio === "undefined") return fallback();
  const name = src.startsWith("blob:") ? "silence" : src;

  return new Promise((resolve) => {
    const audio = (voiceAudio ??= new Audio());
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
    const fallBack = (reason: string) => {
      debugLog(`✗ ${name} : ${reason}, repli`);
      if (settle()) void fallback().then(resolve);
    };

    audio.onended = () => {
      debugLog(`fin ${name}`);
      if (settle()) resolve();
    };
    // Missing or unreadable file: remember it and use the fallback (native voice for speech).
    audio.onerror = () => {
      if (!src.startsWith("blob:")) missingFiles.add(src);
      fallBack("fichier illisible");
    };
    stopCurrent = stop;
    audio.src = src;
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;
    debugLog(`lecture ${name}`);
    audio.play().catch((error: unknown) => {
      // AbortError: interrupted by pause() or a new source, already handled by `stop`.
      if (error instanceof DOMException && error.name === "AbortError") return;
      fallBack(`lecture refusée (${error instanceof Error ? error.name : String(error)})`);
    });
  });
}

// Keeps a reference to the utterance: some Chrome versions garbage-collect it and never fire `onend`.
let currentUtterance: SpeechSynthesisUtterance | undefined;

function speakNative(text: string, lang: Lang, rate: number): Promise<void> {
  const synth = typeof window === "undefined" ? undefined : window.speechSynthesis;
  if (!synth) return Promise.resolve();

  debugLog(`voix native : ${text}`);
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(spokenText(text));
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
