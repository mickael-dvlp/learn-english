/**
 * Loops one second of silence through an <audio> element during a session.
 * The native voice alone is not "media" for the browser: without a playing media element,
 * Chrome shows no Media Session controls and Android is more likely to suspend the page.
 */

let audio: HTMLAudioElement | undefined;

export function startKeepAlive(): void {
  if (typeof window === "undefined") return;
  audio ??= Object.assign(new Audio(silentWav()), { loop: true });
  void audio.play().catch(() => {
    // Autoplay refused (no user gesture yet): speech still works, only the media controls are missing.
  });
}

export function stopKeepAlive(): void {
  audio?.pause();
}

/** 1 s of 8 kHz mono 8-bit PCM silence, as a data URL (no binary file in the repo). */
function silentWav(): string {
  const sampleRate = 8000;
  const bytes = new Uint8Array(44 + sampleRate);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + sampleRate, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  text(36, "data");
  view.setUint32(40, sampleRate, true);
  bytes.fill(128, 44); // 8-bit PCM silence is 128
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
}
