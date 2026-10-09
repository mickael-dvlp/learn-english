# Appli d'apprentissage de l'anglais — Spécification

> Ce fichier est la source de vérité du projet. Le lire en entier avant toute modification.
> Si une décision change, mettre ce fichier à jour dans le même commit.

## 1. Vision

Application **personnelle** (un seul utilisateur, francophone) pour apprendre l'anglais, utilisée sur **Android uniquement**, installée en **PWA**.

Usage principal : **écouter de l'anglais avant de s'endormir** pendant 5, 10 ou 30 minutes (mots, verbes, adjectifs, règles, textes), sans toucher l'écran. Usage secondaire : étudier en journée (lire, réviser, quiz).

Le contenu **grossit en permanence**. Ajouter du contenu ne doit jamais demander de modifier le code.

Ton de l'appli : chaleureux, fonctionnel, simple.

## 2. Décisions figées

| Sujet | Décision |
|---|---|
| Plateforme | PWA, Android (Chrome). Pas d'iOS. |
| Framework | Next.js (App Router) + TypeScript + React |
| Style | Tailwind CSS |
| Données | **Fichiers JSON statiques** dans le repo. Pas de Firebase, pas de backend, pas de base de données. |
| Progression utilisateur | Stockée localement (IndexedDB, ou localStorage si suffisant). Jamais dans le repo. |
| Hors-ligne | Service worker. Données en cache à l'installation. Audio en packs téléchargeables par thème. |
| Voix (phase 1) | Web Speech API (voix native) |
| Voix (phase 2) | Fichiers audio générés avec **Edge TTS**, liés **automatiquement** au texte prononcé (pas de champ dans les JSON), voir section 6 |
| Minuteur | Minuteur de durée de session (5/10/30 min, valeur libre possible) avec arrêt net. **Pas de fade-out.** |
| Développement | Intégralement sur ordinateur (Chrome/Edge desktop). Pas de test sur téléphone avant le déploiement. |
| Déploiement | **Vercel**, branché sur le dépôt GitHub (redéploiement à chaque push). Déployé après l'étape 3, avant le travail de style. Adresse : https://learn-english-blush-seven.vercel.app/ (dépôt : https://github.com/mickael-dvlp/learn-english). |

## 3. Deux modes, un seul contenu

Il n'y a **pas** d'arborescence séparée « oral » / « écrit ». Le contenu est unique, deux modes l'exploitent.

- **Mode Écouter** : l'utilisateur choisit un contenu (thème, verbes, règles, texte), une durée, un motif de lecture. L'appli génère une playlist et la joue.
- **Mode Étudier** : listes, fiches, quiz, suivi de ce qui est vu.

Un élément ajouté dans les données apparaît automatiquement dans les deux modes.

## 4. Types de contenu

Quatre types. Champs communs à tous :

- `id` : string stable, jamais modifié après création (sert aussi au suivi de progression). Format `<type>-<slug>` ex. `word-tractor`, `verb-go`.
- `level` : `"A1" | "A2" | "B1" | "B2" | "C1"`
- `tags` : string[] (optionnel), transversal aux thèmes

### 4.1 Mot (`word`)

```ts
type Word = {
  id: string;            // "word-tractor"
  type: "word";
  theme: string;         // id de thème : "agriculture"
  en: string;            // "tractor"
  fr: string;            // "tracteur"
  example?: { en: string; fr: string };
  pos?: "noun" | "verb" | "adjective" | "adverb" | "other"; // nature du mot
  speakEn?: string;      // texte lu si différent de en (ajustement de prononciation)
  level: Level;
  tags?: string[];
};
```

### 4.2 Verbe (`verb`)

```ts
type Verb = {
  id: string;            // "verb-go"
  type: "verb";
  base: string;          // "go"
  past: string;          // "went"
  pastParticiple: string;// "gone"
  fr: string;            // "aller"
  regular: boolean;
  example?: { en: string; fr: string };
  level: Level;
  tags?: string[];
};
```

### 4.3 Règle (`rule`)

Couvre les règles de conjugaison (temps) et les règles spéciales (be + ing, etc.).

```ts
type Rule = {
  id: string;            // "rule-present-continuous"
  type: "rule";
  kind: "conjugation" | "special";
  title: { en: string; fr: string };
  explanation: string;   // en français, court, clair
  examples: { en: string; fr: string }[];
  tense?: "present" | "past" | "future" | "other"; // pour kind = "conjugation"
  level: Level;
  tags?: string[];
};
```

### 4.4 Texte (`text`)

Texte à écouter : phrases lentes et compréhensibles.

```ts
type TextItem = {
  id: string;            // "text-at-the-farm"
  type: "text";
  title: { en: string; fr: string };
  theme?: string;
  sentences: { en: string; fr: string }[];
  level: Level;
  tags?: string[];
};
```

### 4.5 Thème

```ts
type Theme = {
  id: string;            // "agriculture"
  name: { en: string; fr: string };
  emoji?: string;
};
```

Thèmes prévus au départ : vêtements, cuisine, agriculture, fruits, légumes, animaux, maison, émotions. En ajouter librement.

## 5. Organisation des fichiers

```
/content
  themes.json                 // liste des thèmes
  /words
    agriculture.json          // Word[] d'un thème
    cuisine.json
  /verbs
    irregular.json
    regular.json
  /rules
    conjugation.json
    special.json
  /texts
    at-the-farm.json          // un fichier par texte
/public
  /audio/<lang>/<hash>.mp3    // audio généré, voir section 6
/src
  /lib/content                // chargement et validation du contenu
  /lib/player                 // lecteur, motifs, minuteur
  /lib/speech                 // abstraction de la voix
  /lib/storage                // progression locale
  /app                        // pages Next.js
```

Règles :
- Un fichier = une collection cohérente. Ajouter du contenu = éditer ou créer un JSON.
- **Valider le contenu au build** (schéma Zod ou équivalent) : id unique, champs requis, niveau valide, thème existant. Le build échoue si le contenu est invalide.
- Ne jamais renommer un `id` existant (casse la progression).

Mise en œuvre :
- Schémas Zod dans `src/lib/content/schema.ts` ; les types TS sont **inférés** des schémas (une seule source). Objets stricts : un champ inconnu (faute de frappe) est une erreur.
- `src/lib/content/validate.ts` : validation pure (testable sans disque). `load.ts` : lecture de `/content` (synchrone, côté serveur, au build).
- `npm run validate` vérifie le contenu ; il est lancé automatiquement par `prebuild`.
- Tests : `npm test` (runner natif `node:test` via `tsx`, pas de framework de test). Fichiers `*.test.ts` à côté du code.
- Autres commandes : `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`.

## 6. Voix et audio : abstraction obligatoire

Le lecteur ne parle **jamais** directement à la Web Speech API. Il appelle une seule fonction :

```ts
speak(item: PlayableUnit, lang: "en" | "fr"): Promise<void>
```

Logique interne :
1. Si le fichier audio généré pour ce texte existe → le jouer (`<audio>`).
2. Sinon (pas encore généré, introuvable) → voix native (Web Speech API).

**Liaison automatique** (`src/lib/speech/audio-files.ts`) : un fichier par texte prononcé, `public/audio/<lang>/<hash>.mp3`, où le hash porte sur la voix et le texte dit. L'appli et le script calculent le même chemin : rien à écrire dans les JSON. Corriger un texte ou changer de voix donne un nouveau nom de fichier.

**Génération** : `npm run audio` (`scripts/generate-audio.ts`, Edge TTS via `msedge-tts`, voix `en-GB-SoniaNeural` et `fr-FR-DeniseNeural`). Le script liste tous les textes prononcés (motifs du lecteur + exemples lus en mode Étudier) et ne génère que les fichiers manquants. `--dry-run` compte, `--prune` supprime les fichiers devenus inutiles. Les fichiers sont commités ; Vercel les sert tels quels. **Après tout ajout de contenu : `npm run audio`, puis commit.**

Conséquence : un contenu sans audio généré reste utilisable en mode Étudier (voix native), mais il est muet en mode Écouter.

**Écran verrouillé (Android, testé sur le téléphone)** :
- La voix native se met en pause dès le verrouillage : inutilisable pour l'écoute du soir.
- Une suite de **sons courts** (un fichier par mot, même enchaînés sans minuteur) est mise en pause par le système environ 6 s après le verrouillage (journal `/debug`). Chrome Android ne traite comme une vraie lecture que les médias longs.
- D'où le lecteur par **pistes assemblées** (section 7.5) : une session est jouée comme des pistes d'une à deux minutes, comme un podcast. **Validé sur le téléphone : la lecture continue écran verrouillé, avec les contrôles de lecture (comme pour la musique) sur l'écran de verrouillage.**

Le mode Écouter n'utilise donc pas `speak()` : il joue les mêmes fichiers générés, assemblés. `speak()` reste l'unique accès à la voix pour les boutons 🔊 du mode Étudier. Un texte sans audio généré est sauté en mode Écouter (journal + avertissement de `npm run validate`).

## 7. Mode Écouter : le lecteur

### 7.1 Playlist et motifs

Une session = un contenu source + un **motif** + une durée. Le lecteur transforme le contenu en suite d'étapes (jouer EN, pause, jouer FR…).

Motifs initiaux :

| Motif | Séquence |
|---|---|
| `en-fr-en` (mots) | EN → pause → FR → pause → EN |
| `en-only-loop` | EN → pause (boucle) |
| `verb-forms` (verbes) | base, past, participe passé (« go – went – gone ») → pause → FR |
| `text` (textes) | phrase EN lente → pause → traduction FR → phrase suivante |
| `rule` (règles) | titre FR → explication FR → exemples (EN → pause → FR) |

Les motifs sont des **données/configurations**, pas du code dispersé : en ajouter un ne doit pas obliger à toucher le lecteur.

### 7.2 Pauses

Pause **proportionnelle à la longueur du texte** (durée de base + durée par mot), réglable par l'utilisateur. Une phrase longue = pause plus longue.

### 7.3 Minuteur de session

- Durées proposées : 5, 10, 30 min (+ valeur libre).
- À la fin : arrêt net à la fin de l'élément en cours (ne pas couper au milieu d'un mot).
- Pas de fade-out.

### 7.4 Contrôles

- Media Session API : pause, lecture, suivant, précédent depuis l'écran de verrouillage.
- Vitesse de lecture réglable (surtout pour les textes).
- Ordre : séquentiel ou aléatoire.

### 7.5 Mise en œuvre (étape 2)

- **Motifs** : `src/lib/player/patterns.ts`. Gabarits `{champ}`, `{a.b}`, `{a|b}` (premier champ présent). Une étape dont un champ manque (ex. `example` absent) est sautée avec la pause qui la suit. `each` répète sur une liste (`sentences`, `examples`) ; `segment` fait de chaque élément un segment.
- **Segment** = unité de navigation (suivant / précédent) et de fin de minuteur : un mot, un verbe, une règle, une phrase de texte (le titre d'un texte est son propre segment).
- **Fin du minuteur** : on termine le segment en cours, sans ses pauses restantes, puis arrêt net.
- **Le minuteur compte le temps d'écoute** : il s'arrête quand l'utilisateur met en pause.
- **Boucle** : quand le contenu est épuisé avant la fin du minuteur, il reprend du début (remélangé si ordre aléatoire). L'aléatoire mélange les éléments, jamais les phrases d'un texte. Chaque élément passe une fois par tour, et au changement de tour la moitié des autres éléments passe avant qu'un élément de fin de tour ne revienne (`shuffleAfter`).
- **Moteur** (`player.ts`) : sans dépendance au navigateur (chargement des sons, sortie audio, horloge injectés), testé avec une sortie factice.
- **Pistes assemblées** (`timeline.ts`, `browser.ts`) : le lecteur décode les MP3 générés (Web Audio, 24 kHz), retire leurs silences de début et de fin, et assemble des segments entiers avec les pauses (silence) en une piste WAV : 15 s pour démarrer vite, puis environ 90 s. La piste suivante est préparée pendant que la courante joue, et s'enchaîne sur `ended`. Un seul élément `<audio>`.
- **Vitesse** : réglage utilisateur = `playbackRate` de l'élément (hauteur de voix conservée) ; les silences sont ajustés pour garder leur durée réelle. Les phrases lentes des textes (`rate: 0.85` dans le motif) sont des fichiers **générés lentement** (Edge TTS `-15%`), pas ralentis à la lecture.
- **Interruption par le système** (pause non demandée) : le lecteur passe en pause, minuteur arrêté ; ▶ reprend au même endroit.
- **Diagnostic** : le lecteur écrit un journal court en localStorage (`src/lib/debug/log.ts`), lisible sur le téléphone à `/debug` (page non liée dans l'interface).
- `speak()` remplace « / » par une virgule pour la voix (« was / were »). Voix native (repli) : on préfère celles installées sur l'appareil (fonctionnent hors ligne).
- Préférences d'écoute (contenu, motif, durée, ordre, vitesse, pauses) mémorisées en localStorage.
- Route : `/listen`.

## 8. Mode Étudier

- Navigation par thème, verbes, règles, textes.
- Fiches de lecture (mot + exemple, verbe avec ses 3 formes, règle avec exemples).
- Quiz simples (choix multiple EN↔FR).
- Suivi minimal : « vu / écouté » par `id`, stocké localement.
- Répétition espacée : **hors périmètre pour l'instant**.

Mise en œuvre (étape 3) :
- **Collections** (`src/lib/content/collections.ts`) : partagées par Écouter et Étudier (un thème, verbes tous / irréguliers / réguliers, règles, un texte). Dérivées du contenu ; leur `id` sert de slug d'URL.
- Routes : `/study` (collections avec progression) et `/study/[collection]` (une page statique par collection). La fiche ouverte est dans le hash (`#word-tractor`) : le bouton retour du téléphone ramène à la liste.
- Fiches avec boutons 🔊 (même `speak()` et même vitesse que le mode Écouter). Un texte s'affiche en entier, traduction masquable.
- **Suivi** (`src/lib/storage/progress.ts`, localStorage) : par `id`, date du premier « vu » (fiche ou texte ouvert) et du premier « écouté » (segment joué jusqu'au bout dans le lecteur, pas s'il est sauté).
- `createLocalStore` (`src/lib/storage/local-store.ts`) : valeur localStorage validée par Zod, exposée à React via `useSyncExternalStore`.

## 9. Hors-ligne

- Service worker : met en cache l'app et **toutes les données JSON** à l'installation (légères).
- Audio : **packs téléchargeables par thème** (ex. bouton « Télécharger Cuisine »). Stockés via Cache Storage. L'utilisateur voit l'espace utilisé et peut supprimer un pack.
- Le mode Écouter doit fonctionner **entièrement hors ligne** une fois les données et packs audio téléchargés.
- Attention : les voix natives ne sont pas toujours disponibles hors ligne selon le téléphone.

## 10. Design et UX

- Mobile first, utilisable **à une main**, gros boutons.
- **Thème sombre doux** (tons chauds, jamais de blanc agressif) pour le mode nuit ; thème clair en journée.
- Écran d'accueil à trois actions seulement : **Écouter**, **Étudier**, **Continuer où j'en étais**.
- Pendant une écoute : écran minimal (élément en cours, lecture/pause, temps restant). Possibilité de laisser l'écran allumé en faible luminosité ou de le verrouiller sans interrompre l'audio.
- Interface en **français**.

## 11. Feuille de route

1. ✅ **Fondations** : projet Next.js + TS + Tailwind, schémas de types, validation du contenu, quelques fichiers d'exemple (2 thèmes, 10 verbes, 2 règles, 1 texte).
2. ✅ **Lecteur** : abstraction `speak()`, motifs, pauses, minuteur de session, Media Session. Tests sur ordinateur.
3. ✅ **Mode Étudier** : listes, fiches, suivi vu/écouté.
4. ✅ **Déploiement** : dépôt GitHub + Vercel. Test sur téléphone, dont une session écran verrouillé.
5. **Style** : refonte visuelle.
6. **Compléter l'application** :
   - PWA et hors-ligne : manifest, service worker, cache des données.
   - Audio généré : ✅ script et liaison automatique (avancé, car la voix native se coupe écran verrouillé). Reste : packs téléchargeables par thème (hors-ligne).
   - Confort : quiz, réglages, statistiques d'écoute.

Avancer **une étape à la fois**, la valider avant de passer à la suivante.

### Tâches à faire (liste de l'utilisateur, 8 octobre 2026)

À reprendre à la prochaine session, dans cet ordre sauf avis contraire :

1. **Modification du visuel** (étape 5). Demander d'abord l'ambiance souhaitée, ce qui gêne aujourd'hui et l'écran prioritaire.
2. ✅ **Logo et favicon** (9 octobre) : `public/image/logo-mouton.svg` est l'icône principale (favicon SVG), `favicon.ico` en secours, logo sur l'accueil. `logo-192.png` et `logo-512.png` sont des rendus du SVG (image de l'écran de verrouillage, icône Apple, futur manifest) : les refaire si le SVG change.
3. **Nouveaux thèmes de mots** : nourriture, animaux, fruits, légumes, objets du quotidien, vêtements, transports, politesse… (un fichier `content/words/<theme>.json` par thème + entrée dans `themes.json`).
4. **Autres verbes** (`content/verbs/irregular.json`, `regular.json`).
5. **Mots de coordination** (and, but, or, so, because…). À décider : un thème de mots dédié, ou une nouvelle valeur de `pos` (`conjunction`), ce qui touche au schéma.
6. ✅ **Phrases interrogatives** (9 octobre) : trois règles dans `content/rules/special.json`, tag `questions` (do/does/did, inversion avec be/can/will/have, mots interrogatifs).

Pour tout ajout de contenu : `npm run validate`, puis `npm run audio`, puis commit.

## 12. Conventions de code

- TypeScript strict, pas de `any`.
- Composants React fonctionnels, hooks.
- Logique métier (lecteur, motifs, minuteur) séparée de l'UI et testable sans navigateur.
- Noms de code en anglais, textes de l'interface en français.
- Petits commits, message clair.
- Ne pas ajouter de dépendance sans la justifier.
- Ne jamais coder en dur du contenu pédagogique : tout vient de `/content`.

## 13. Hors périmètre (ne pas faire sans demande explicite)

- Comptes utilisateurs, authentification, synchronisation cloud
- Firebase ou tout autre backend
- Support iOS
- Publication sur le Play Store
- Répétition espacée
