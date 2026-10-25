/**
 * Scenarios of the main features, at a phone's size: several themes in Listen, quizzes, the book
 * and its bookmark, the back button while listening, backup, two tabs. See helpers.mjs to run them.
 */
import { BASE, check, clickText, go, launch, phonePage, setStorage, storage, summary, text, wait } from "./helpers.mjs";

const browser = await launch();
const errors = [];
console.log(`Tests navigateur · ${BASE}`);

const pressed = (page, label) =>
  page.evaluate((l) => [...document.querySelectorAll("button[aria-pressed]")].find((b) => b.innerText.includes(l))?.getAttribute("aria-pressed"), label);

// --- Listen: several themes, quiz, back button, duration -------------------------------------
{
  console.log("\n== Écouter");
  const { context, page } = await phonePage(browser, errors);
  await go(page, "/");
  await setStorage(page, "listen-preferences", { sourceIds: ["theme-fruits"], patternId: "en-fr-en" });
  await go(page, "/listen");
  await clickText(page, "button[aria-pressed]", "Légumes");
  check((await pressed(page, "Fruits")) === "true" && (await pressed(page, "Légumes")) === "true", "deux thèmes cochés ensemble");
  check(/2 choisis · \d+ mots/.test(await text(page)), "résumé de la sélection (2 choisis, nombre de mots)");
  check((await text(page)).includes("2 sélectionnés"), "la famille indique 2 sélectionnés");
  await clickText(page, "button[aria-pressed]", "Fruits");
  check((await pressed(page, "Fruits")) === "false" && (await pressed(page, "Légumes")) === "true", "décocher un thème");
  await clickText(page, "button[aria-pressed]", "Légumes");
  check((await pressed(page, "Légumes")) === "true", "le dernier thème reste coché");
  check((await storage(page, "listen-preferences")).sourceIds.join() === "theme-legumes", "sélection mémorisée (sourceIds)");

  // Old preferences (one content in sourceId) are taken over.
  await setStorage(page, "listen-preferences", { sourceId: "theme-fruits", patternId: "en-fr-en" });
  await go(page, "/listen");
  check((await pressed(page, "Fruits")) === "true", "ancienne préférence sourceId reprise");

  // Custom duration: the field can be cleared, then typed.
  const field = await page.$('input[type="number"]');
  await field.click();
  await page.keyboard.press("End");
  for (let i = 0; i < 3; i++) await page.keyboard.press("Backspace");
  check((await field.evaluate((input) => input.value)) === "", "durée libre : le champ peut être vidé");
  await page.keyboard.type("45");
  await page.keyboard.press("Tab");
  check((await storage(page, "listen-preferences")).durationMinutes === 45, "durée libre : effacée puis 45 tapé");

  // Back button during a session: back to the settings, not out of the page.
  await clickText(page, "button", "Lancer l");
  await wait(1500);
  check(page.url().endsWith("#ecoute") && (await text(page)).includes("Rejouer"), "écoute lancée (#ecoute)");
  await page.goBack();
  await wait(600);
  check(page.url().endsWith("/listen") && (await text(page)).includes("Quoi écouter"), "retour du téléphone : revient aux réglages d'Écouter");

  // Quiz in Listen.
  await clickText(page, "button[aria-pressed]", "Quiz");
  const quizScreen = await text(page);
  check(quizScreen.includes("Combien de questions") && !quizScreen.includes("Combien de temps") && !quizScreen.includes("Ordre"), "quiz : nombre de questions au lieu de la durée");
  check(quizScreen.includes("Temps pour répondre") && quizScreen.includes("Lancer le quiz"), "quiz : temps pour répondre, bouton « Lancer le quiz »");
  await clickText(page, "button", "Lancer le quiz");
  await wait(2500);
  const session = await text(page);
  check(/Question 1 \/ 20/.test(session) && session.includes("Quiz ·") && !(await page.$('[role="timer"]')), `quiz lancé : « Question 1 / 20 », sans minuteur`);
  await clickText(page, "button", "Arrêter");
  await wait(500);
  check(page.url().endsWith("/listen") && (await text(page)).includes("Quoi écouter"), "« Arrêter » revient aux réglages");
  await context.close();
}

// --- Study: quiz of a theme ------------------------------------------------------------------
{
  console.log("\n== Quiz dans Étudier");
  const { context, page } = await phonePage(browser, errors);
  await go(page, "/study/theme-fruits");
  await clickText(page, "main a", "Quiz sur ce thème");
  await page.waitForFunction(() => location.pathname.endsWith("/quiz"));
  await wait(400);
  check((await text(page)).includes("Combien de questions"), "page du quiz : choix du nombre de questions");
  await page.$eval('input[type="range"]', (input) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(input, "10");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await wait(200);
  check((await text(page)).includes("10 questions"), "10 questions choisies");
  await clickText(page, "button", "Commencer");
  const first = await text(page);
  // The label is in capitals on screen (innerText follows the CSS).
  check(first.includes("1 / 10") && /traduis en français/i.test(first) && first.includes("Réponse"), "question 1 : depuis l'anglais, bouton Réponse");
  await clickText(page, "main button", "Réponse");
  const buttons = await page.$$eval("main button", (list) => list.map((b) => b.innerText.trim()));
  check(/RÉPONSE/i.test(await text(page)) && (await page.$('[aria-live="polite"] p[lang]')) !== null, "la réponse s'affiche");
  check(buttons.includes("Suivant") && !buttons.includes("Réponse"), "le bouton Réponse a laissé place à « Suivant »");
  await clickText(page, "main button", "Suivant");
  check(/traduis en anglais/i.test(await text(page)), "question 2 : depuis le français");
  for (let i = 2; i <= 10; i++) {
    await clickText(page, "main button", "Réponse");
    await clickText(page, "main button", i === 10 ? "Terminer" : "Suivant");
  }
  check((await text(page)).includes("Quiz terminé"), "fin du quiz");
  const seen = Object.values((await storage(page, "progress")) ?? {}).filter((entry) => entry.seen).length;
  check(seen >= 5, `mots vus pendant le quiz : ${seen}`);
  await clickText(page, "button", "Recommencer");
  check((await text(page)).includes("1 / 10"), "recommencer : nouveau tirage");
  await context.close();
}

// --- Book: reading, bookmark, home, Listen ---------------------------------------------------
{
  console.log("\n== Livre");
  const { context, page } = await phonePage(browser, errors);
  await go(page, "/");
  check((await text(page)).includes("Commencer un livre"), "accueil : « Commencer un livre »");
  await setStorage(page, "accordion-study", "livres");
  await go(page, "/study");
  check((await text(page, "#study-header-livres")).includes("1 livre"), "famille Livres : 1 livre");
  await clickText(page, "#study-panel-livres a", "gardien du phare");
  await page.waitForFunction(() => location.pathname.includes("book-"));
  await wait(400);
  check((await text(page)).includes("Pas encore commencé") && (await text(page)).includes("Chapitres"), "page du livre : marque-page, chapitres");
  await clickText(page, "button", "Commencer la lecture");
  check(page.url().endsWith("#chapitre-1") && (await text(page)).includes("Chapitre 1 / 2"), "chapitre 1 ouvert");
  await clickText(page, "nav button", "Chapitre suivant");
  check(page.url().endsWith("#chapitre-2"), "chapitre suivant");
  let mark = (await storage(page, "book-bookmarks"))?.["book-the-lighthouse-keeper"];
  check(mark?.chapter === 1 && mark.sentence === 0, "marque-page : début du chapitre 2");
  // Reading: the sentence at the top of the screen once the reader scrolls.
  await page.setViewport({ width: 390, height: 500, isMobile: true, hasTouch: true });
  await page.mouse.move(200, 300);
  await page.mouse.wheel({ deltaY: 900 });
  await wait(700);
  mark = (await storage(page, "book-bookmarks"))?.["book-the-lighthouse-keeper"];
  check(mark?.chapter === 1 && mark.sentence > 0, `en faisant défiler, le marque-page suit : phrase ${(mark?.sentence ?? -1) + 1}`);
  await page.setViewport({ width: 390, height: 800, isMobile: true, hasTouch: true });
  await page.goBack();
  await wait(500);
  check((await text(page)).includes(`Chapitre 2, phrase ${mark.sentence + 1} sur 6`) && (await text(page)).includes("Reprendre la lecture"), "retour : « Reprendre la lecture » au bon endroit");
  await go(page, "/");
  const home = await text(page);
  check(home.includes("Continuer où j'en étais") && home.includes(`chapitre 2, phrase ${mark.sentence + 1}`), "accueil : « Continuer où j'en étais » avec la position");
  await clickText(page, "main a", "Continuer où j");
  await page.waitForFunction(() => location.hash.startsWith("#chapitre-2-phrase-"));
  await wait(500);
  check((await text(page)).includes("Marque-page"), "le lien ouvre le chapitre, marque-page visible");

  await setStorage(page, "listen-preferences", { sourceIds: ["book-the-lighthouse-keeper"] });
  await go(page, "/listen");
  const listen = await text(page);
  check(listen.includes("Où commencer") && listen.includes(`Chapitre 2, phrase ${mark.sentence + 1} sur 6`), "Écouter : « Reprendre là où j'en étais » avec la position");
  check(!listen.includes("Ordre") && listen.includes("Phrase par phrase"), "Écouter : livre dans l'ordre, motifs des textes");
  await page.select("select", "0");
  check((await storage(page, "listen-preferences")).bookChapter === 0, "choisir le chapitre 1");

  // Backup: the bookmark is in the file.
  await go(page, "/backup");
  const exported = await page.evaluate(async () => {
    const original = URL.createObjectURL;
    let blob;
    URL.createObjectURL = (b) => ((blob = b), original.call(URL, b));
    [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Exporter")).click();
    URL.createObjectURL = original;
    return JSON.parse(await blob.text());
  });
  check(exported.bookmarks?.["book-the-lighthouse-keeper"]?.chapter === 1, "sauvegarde : le marque-page est exporté");
  await context.close();
}

// --- Two tabs: progress written by both is kept ------------------------------------------------
{
  console.log("\n== Deux onglets");
  const { context, page } = await phonePage(browser, errors);
  const other = await context.newPage();
  await go(page, "/study/theme-fruits");
  await go(other, "/study/theme-legumes");
  // Each tab opens a card (seen): the second one must not put back its older copy of the progress.
  await page.bringToFront();
  await clickText(page, "main ul li button", "");
  await wait(300);
  await other.bringToFront();
  await clickText(other, "main ul li button", "");
  await wait(300);
  const progress = (await storage(page, "progress")) ?? {};
  check(Object.keys(progress).length === 2, `les deux onglets gardent leur progression (${Object.keys(progress).join(", ")})`);
  await context.close();
}

const ok = summary(errors);
await browser.close();
process.exit(ok ? 0 : 1);
