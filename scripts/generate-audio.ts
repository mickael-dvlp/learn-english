/**
 * Generates the missing audio files with Edge TTS (Microsoft neural voices, no account needed).
 *
 *   npm run audio              generate what is missing
 *   npm run audio -- --dry-run only count what is missing
 *   npm run audio -- --prune   also delete files no longer used (text changed or removed)
 *
 * Files go to public/audio/<lang>/<hash>.mp3 and are committed: Vercel serves them as is.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { loadContent } from "../src/lib/content/load";
import type { Lang } from "../src/lib/player/types";
import { VOICES, spokenText } from "../src/lib/speech/audio-files";
import { listSpokenTexts, type SpokenText } from "../src/lib/speech/spoken-texts";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const AUDIO_DIR = path.join(PUBLIC_DIR, "audio");
const RETRIES = 3;

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const prune = args.has("--prune");

const { library, errors } = loadContent();
if (errors.length > 0) {
  console.error("✗ Contenu invalide, lance d'abord `npm run validate`.");
  process.exit(1);
}

const spoken = listSpokenTexts(library);
const missing = spoken.filter((entry) => !existsSync(path.join(PUBLIC_DIR, entry.path)));
console.log(`${spoken.length} textes prononcés, ${missing.length} fichier(s) audio à générer.`);

if (prune) pruneUnused(new Set(spoken.map((entry) => path.join(PUBLIC_DIR, entry.path))));
if (dryRun || missing.length === 0) process.exit(0);

const tts = new MsEdgeTTS();
main().catch((error: unknown) => {
  console.error("✗ Échec de la génération :", error);
  process.exit(1);
});

async function main() {
  let done = 0;
  try {
    for (const lang of Object.keys(VOICES) as Lang[]) {
      const batch = missing.filter((entry) => entry.lang === lang);
      if (batch.length === 0) continue;
      // The third argument works around a msedge-tts bug when switching voices.
      await tts.setMetadata(VOICES[lang], OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {});
      for (const entry of batch) {
        await generate(entry);
        done++;
        console.log(`[${done}/${missing.length}] ${entry.lang} · ${entry.text}`);
      }
    }
  } finally {
    tts.close();
  }
  console.log(`✓ ${done} fichier(s) audio générés.`);
}

async function generate(entry: SpokenText) {
  for (let attempt = 1; ; attempt++) {
    try {
      const { audioStream } = tts.toStream(escapeXml(spokenText(entry.text)));
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) chunks.push(chunk as Buffer);
      const audio = Buffer.concat(chunks);
      if (audio.length === 0) throw new Error("réponse audio vide");
      const file = path.join(PUBLIC_DIR, entry.path);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, audio);
      return;
    } catch (error) {
      if (attempt >= RETRIES) throw error;
      console.warn(`  nouvel essai (${attempt}/${RETRIES - 1}) : ${(error as Error).message}`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

/** The text is inserted in SSML: escape XML special characters. */
function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pruneUnused(used: Set<string>) {
  let removed = 0;
  for (const lang of Object.keys(VOICES)) {
    const dir = path.join(AUDIO_DIR, lang);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const file = path.join(dir, name);
      if (name.endsWith(".mp3") && !used.has(file)) {
        if (!dryRun) rmSync(file);
        removed++;
      }
    }
  }
  console.log(`${removed} fichier(s) inutilisé(s) ${dryRun ? "à supprimer" : "supprimé(s)"}.`);
}
