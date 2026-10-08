import { loadContent } from "../src/lib/content/load";
import { plural } from "../src/lib/format";

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
