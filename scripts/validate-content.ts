import { existsSync } from "node:fs";
import path from "node:path";
import { loadContent } from "../src/lib/content/load";
import { plural } from "../src/lib/format";
import { listSpokenTexts } from "../src/lib/speech/spoken-texts";

const { library, errors } = loadContent();

if (errors.length > 0) {
  console.error(`✗ Contenu invalide (${plural(errors.length, "erreur")}) :`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(
  `✓ Contenu valide : ${plural(library.themes.length, "thème")}, ${plural(library.words.length, "mot")}, ` +
    `${plural(library.verbs.length, "verbe")}, ${plural(library.rules.length, "règle")}, ` +
    `${plural(library.texts.length, "texte")}`,
);

// Not an error (the content stays usable in study mode), but listening needs the audio files.
const missingAudio = listSpokenTexts(library).filter(
  (entry) => !existsSync(path.join(process.cwd(), "public", entry.path)),
);
if (missingAudio.length > 0) {
  console.warn(`⚠ ${plural(missingAudio.length, "texte")} sans audio généré : lance \`npm run audio\` puis commite.`);
}
