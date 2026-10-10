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

Cinq types (mot, verbe, règle, texte, paire de prononciation). Champs communs à tous :

- `id` : string stable, jamais modifié après création (sert aussi au suivi de progression). Format `<type>-<slug>` ex. `word-tractor`, `verb-go`.
- **Pas de niveau** (A1, A2…) : appli personnelle, le champ a été retiré du modèle et des données (10 octobre). Un champ `level` dans un JSON est refusé par la validation.
- `tags` : string[] (optionnel), transversal aux thèmes. Sert de sous-catégorie (futur quiz par catégorie) : connecteurs `coordination`, `cause`, `opposition`, `addition`, `temps`, `explication`, `nuance` ; prépositions `lieu`, `mouvement`, `temps`, `autre` ; règles `questions`.

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
  note?: string;         // remarque d'usage affichée, jamais lue (« familier », « devant un adjectif »)
  group?: string;        // sous-thème, parmi les groups du thème (obligatoire si le thème en a)
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
  regular: boolean;      // "learnt / learned" (forme britannique irrégulière) : false
  note?: string;         // remarque affichée, jamais lue
  speak?: string;        // dit à la place des trois formes quand elles se lisent autrement (« read, red, red »)
  example?: { en: string; fr: string };
  group?: string;        // sous-thème, parmi content/verb-groups.json (obligatoire s’il existe)
  tags?: string[];
};
```

### 4.3 Règle (`rule`)

Couvre les règles de conjugaison (temps) et les règles spéciales (be + ing, etc.).

```ts
type Rule = {
  id: string;            // "rule-present-continuous"
  type: "rule";
  kind: "conjugation" | "special" | "modal"; // modal : verbe modal ou semi-modal, rubrique à part
  title: { en: string; fr: string };
  meaning?: string;      // fonction et traduction en contexte (« pouvoir, savoir (faire), au présent »)
  explanation: string;   // en français, court, clair (affiché, jamais lu en mode Écouter)
  structure?: string;    // modèle visuel : « sujet + can + base »
  forms?: { kind: "affirmative" | "negative" | "question"; en: string; fr: string }[];
  examples: { en: string; fr: string }[]; // 3 à 6 phrases utiles à l'oral
  mistake?: { wrong: string; right: string; note?: string }; // erreur fréquente (la phrase fausse n'est jamais lue)
  tense?: "present" | "past" | "future" | "other"; // pour kind = "conjugation"
  group?: string;        // sous-thème, parmi content/rule-groups.json
  tags?: string[];
};
```

Fichiers : `content/rules/conjugation.json` (temps), `special.json` (questions, phrase, conditions et suggestions), `modals.json` (30 fiches de modaux et semi-modaux, par fonction : rappel, capacité, permission, demandes, obligation, conseil, possibilité, futur et hypothèse, habitudes passées). Collections : « Toutes les règles » (`rules-all`, 17 règles) et « 🧭 Verbes modaux et semi-modaux » (`modals`, section `modals` de families.json, entre verbes et règles).

### 4.4 Texte (`text`)

Texte à écouter : phrases lentes et compréhensibles.

```ts
type TextItem = {
  id: string;            // "text-at-the-farm"
  type: "text";
  kind?: "story" | "dialogue"; // histoire par défaut
  title: { en: string; fr: string };
  situation?: string;    // la situation en une phrase, en français
  theme?: string;        // thème associé (ex. restaurant), pour plus tard
  sentences: { en: string; fr: string; speaker?: string }[]; // speaker : qui parle (affiché, non lu)
  expressions?: { en: string; fr: string }[]; // expressions importantes, affichées à la fin
  tags?: string[];
};
```

Les textes sont regroupés dans la famille « Textes et dialogues ». Pas de système de niveaux dédié. Un **dialogue** (`kind: "dialogue"`) a exactement deux interlocuteurs et chaque réplique indique le sien (validé au build). Fichiers `content/texts/dialogue-NN-<slug>.json` (le numéro fixe l’ordre d’affichage). 12 dialogues de situations (restaurant, chemin, achats, rendez-vous, santé, hôtel, aéroport, téléphone, projets, travail, urgence, rencontre).

### 4.4 bis Paire de prononciation (`pair`)

Mots qui se ressemblent, à entendre côte à côte (thème `prononciation`). Prête pour un futur quiz « quel mot avez-vous entendu ? » (jouer un des `words`, proposer les autres).

```ts
type Pair = {
  id: string;            // "pair-ship-sheep"
  type: "pair";
  theme: string;         // "prononciation" ; fichier content/pairs/<theme>.json
  group?: string;        // sous-thème (nombres, voyelles, -ed, accent tonique…)
  words: { en: string; fr: string; ipa?: string; example?: { en: string; fr: string } }[]; // 2 à 4 (ex. -ed : /t/ /d/ /ɪd/)
  explanation: string;   // ce qu’il faut entendre, en français
  tags?: string[];
};
```

`en` est ce qui est dit : un mot, ou une courte phrase pour les formes faibles (« I can swim. » / « Yes, I can. ») et l’accent tonique (« a record » / « to record », pour que la voix place l’accent). Transcription britannique dans `ipa`. Un thème ne mélange pas mots et paires.

### 4.5 Thème

```ts
type Theme = {
  id: string;            // "agriculture" (minuscules sans accent, jamais renommé)
  name: { en: string; fr: string };
  emoji?: string;
  family: string;        // id d'une famille de families.json
  groups?: {             // sous-thèmes, dans l'ordre d'affichage
    id: string;
    name: { en: string; fr: string };
    also?: string[];     // ids de mots d'autres thèmes affichés ici aussi (pas de copie, même progression)
  }[];
};

type Family = {          // content/families.json : regroupement affiché dans Étudier et Écouter
  id: string;            // "fondations"
  name: { en: string; fr: string };
  emoji?: string;
  includes?: ("verbs" | "rules" | "texts")[]; // sections non thématiques rattachées à la famille
};
```

Familles et thèmes en place (46 thèmes, ordre d'affichage = ordre des fichiers) :
1. **Fondations** `fondations` : salutations, nombres (de zéro à vingt, dizaines, ordinaux, prix / dates / années / téléphone), alphabet (lettres, épeler), quantites, jours-mois-saisons, heure-rendez-vous, couleurs, questions-frequentes
2. **Vie quotidienne** `vie-quotidienne` : vetements, maison, fruits, legumes, alimentation, cuisine, courses, restaurant, routine, hygiene
3. **Personnes, travail et loisirs** `personnes` : famille, corps, emotions, sante, description, travail, ecole, loisirs
4. **Déplacements, voyages et services** `deplacements` : ville, directions, transports, voyage, hotel, aeroport, meteo, argent, services-publics, urgences
5. **Nature et technologie** `nature-technologie` : animaux, agriculture, nature, telephone-internet
6. **Construire ses phrases** `phrases` : sections verbes et règles (`includes`), puis connecteurs, prepositions, expressions, conversation, adverbes, verbes-particule, prononciation (paires)
7. **Textes et dialogues** `textes` : section textes (`includes`) : les histoires (« À la ferme » et 5 histoires calmes du soir, `story-NN-<slug>.json`), « Tous les dialogues » (`dialogues-all`) puis chaque dialogue

**Sous-thèmes** (`groups`) : conversation (commencer, réagir, opinion, accord, hésiter, préciser, clarification, terminer), quantites (générales, petites, questions, unités, contenants), adverbes (fréquence, intensité, manière, probabilité, temps, lieu), verbes-particule (quotidien, recherche, objets, relations, travail, déplacement), prononciation (nombres, voyelles, sons, consonnes, finales, -ed, -s, accent, faibles), verbes (`content/verb-groups.json` : base, quotidien, mouvement, communication, perception, travail, besoins). Jamais un troisième niveau d'accordéon : ce sont des filtres dans la collection. Un élément qui existe déjà ailleurs est repris par `also` (ex. always, usually… de routine dans les adverbes de fréquence) plutôt que recopié.

**Traductions lues à voix haute** : `fr` est lu par la voix française en mode Écouter. Il ne contient donc que la traduction : une remarque d'usage va dans `note` (affichée, jamais lue), jamais d'anglais ni de symbole (+, ;, :). Un complément qui se lit naturellement peut rester entre parenthèses (« porter (un vêtement) »). Pour une règle, l'introduction lit le titre anglais puis `meaning` (ou `title.fr`), en français seulement.

**Registre** (Conversation naturelle) : une expression dont la traduction change entre tu et vous affiche les deux (« Comment vas-tu ? / Comment allez-vous ? ») ; les exemples d'un même sous-thème gardent un seul registre (tu partout, vous dans « Demander une clarification »). Les dialogues suivent la situation. **Forme** : une phrase s'écrit comme une phrase (« How are you? », « See you later. », « Actually… ») ; un mot isolé, un verbe (« to hurry up ») ou un connecteur reste en minuscules. Numéros de téléphone : uniquement la plage fictive britannique 07700 900xxx.

Règles de contenu : vocabulaire courant et utile à l'oral, anglais britannique (trousers, jumper, mobile phone…), pas de quota par thème (de 10 à 40 selon le sujet). Un mot qui a plusieurs sens a une entrée par sens, avec un `id` distinct et un exemple qui montre la différence (ex. `word-since-because` « puisque » / `word-since-time` « depuis »). Pas de doublon d'un même mot dans le même sens entre deux thèmes.

En ajouter librement : une entrée dans `themes.json` (avec sa `family`) + un fichier `content/words/<id>.json`. Déplacer un mot d'un thème à un autre : le changer de fichier et de `theme`, **sans changer son `id`** (la progression suit l'id).

## 5. Organisation des fichiers

```
/content
  families.json               // familles (regroupement des thèmes et sections)
  themes.json                 // liste des thèmes, chacun dans une famille
  /words
    agriculture.json          // Word[] d'un thème
    cuisine.json
  /verbs
    irregular.json
    regular.json
  verb-groups.json            // sous-thèmes des verbes
  rule-groups.json            // sous-thèmes des règles et des modaux
  /pairs
    prononciation.json        // Pair[] d'un thème
  /rules
    conjugation.json
    special.json
    modals.json
  /texts
    at-the-farm.json          // un fichier par texte
    dialogue-01-meeting-someone-new.json
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
- **Valider le contenu au build** (schéma Zod ou équivalent) : id unique (éléments et thèmes), champs requis, niveau valide, thème existant. Le build échoue si le contenu est invalide.
- **Fichiers de mots** : `content/words/<id>.json` porte le nom d'un thème de `themes.json` (même vide : sinon erreur), et chaque mot du fichier a ce `theme`. Un fichier vide `[]` est accepté ; le thème n'apparaît alors ni dans les collections d'Écouter/Étudier ni ailleurs, sauf sur `/study/themes` (« 0 mot »).
- Ne jamais renommer un `id` existant (casse la progression).

Mise en œuvre :
- Schémas Zod dans `src/lib/content/schema.ts` ; les types TS sont **inférés** des schémas (une seule source). Objets stricts : un champ inconnu (faute de frappe) est une erreur.
- `src/lib/content/validate.ts` : validation pure (testable sans disque). `load.ts` : lecture de `/content` (synchrone, côté serveur, au build).
- `npm run validate` vérifie le contenu ; il est lancé automatiquement par `prebuild`.
- `getContent()` garde le contenu en mémoire en production ; en développement il relit les JSON à chaque requête (modifications visibles sans redémarrer `npm run dev`).
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

**Deux voix pour les dialogues** : le second interlocuteur d'un dialogue parle avec `en-GB-RyanNeural` (`ALT_VOICES`, `voice: "alt"`), le premier avec la voix habituelle (alternance par ordre d'apparition, `voicePicker()` partagé par le lecteur et les écrans). Si le fichier de la seconde voix manque, on joue celui de la voix habituelle (`audioCandidates`), puis la voix native : une seule voix suffit pour que tout fonctionne. Les traductions françaises restent avec Denise.

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
| `rule` (règles, modaux) | nom de la règle (FR), puis chaque forme et chaque exemple : EN → FR → EN. L'explication n'est jamais lue |
| `rule-en-only` | nom de la règle (EN), puis chaque forme et chaque exemple en anglais |
| `text-en-fr-en` (textes, dialogues) | titre, puis chaque phrase / réplique : EN lente → FR → EN lente |
| `text-en-only` (textes, dialogues) | titre, puis chaque phrase / réplique en anglais seulement |
| `pair-once` (prononciation) | mot 1 → courte pause → mot 2 (→ mot 3…) → pause longue |
| `pair-twice` (prononciation) | la même chose deux fois de suite |

Le motif choisi est retrouvé par son nom d'un type à l'autre (`choosePattern`) : « Anglais seulement » choisi pour des mots s'applique aussi aux dialogues.

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
- **Dialogues** : chaque réplique est un segment, avec `speaker`, `context` (titre du dialogue, affiché quand plusieurs dialogues sont joués) et `part` (rang / nombre de répliques). Les répliques ne sont jamais mélangées ; « Tous les dialogues » en aléatoire mélange l'ordre des dialogues seulement. Le titre est un segment `intro` qui ne compte pas comme écoute.
- **Règles** : chaque forme et chaque exemple est un segment (nom de la règle affiché, `part` numéroté sur l'ensemble des phrases). Une règle est écoutée quand 60 % de ses phrases l'ont été (`listenedRatio` du motif ; textes : 100 %). Dans Écouter, « Quelle règle ? » permet d'en choisir une seule (préférence `itemId`), comme le bouton « 🎧 Écouter cette règle » de la fiche.
- **Rejouer** (`player.replay`) : reprend l'élément en cours depuis son début (une réplique, un mot).
- **Sous-thème** : choisi dans « Quelle partie ? » (filtres), la séance ne joue que ses éléments ; changer de contenu revient à « Tous ».
- Préférences d'écoute (contenu, sous-thème, motif, durée, ordre, vitesse, pauses) mémorisées en localStorage.
- Route : `/listen`.

## 8. Mode Étudier

- Navigation par thème, verbes, règles, textes.
- Fiches de lecture (mot + exemple, verbe avec ses 3 formes, règle avec exemples).
- Quiz simples (choix multiple EN↔FR).
- Suivi minimal : « vu / écouté » par `id`, stocké localement.
- Répétition espacée : **hors périmètre pour l'instant**.

Mise en œuvre (étape 3) :
- **Collections** (`src/lib/content/collections.ts`) : partagées par Écouter et Étudier (un thème, verbes tous / irréguliers / réguliers, règles, un texte). Dérivées du contenu ; leur `id` sert de slug d'URL.
- **Accordéon des familles** (`src/components/accordion.tsx`, un seul composant) sur Étudier, Tous les thèmes et Écouter : une famille ouverte à la fois, en-tête = vrai bouton (`aria-expanded`, `aria-controls`, ids `<page>-header-<famille>` / `<page>-panel-<famille>`), panneau fermé `inert` (ni focus ni lecteur d'écran), animation courte désactivée par `prefers-reduced-motion`. En-tête : emoji, nom, nombre de thèmes et progression courte (« vus », sans compter deux fois un élément).
- **État ouvert** (`src/lib/storage/accordion.ts`, localStorage) : clé `accordion-study` partagée par Étudier et Tous les thèmes (Fondations par défaut, dernière famille mémorisée ; ouvrir une collection ou un texte ouvre sa famille, donc le retour arrive dessus) ; clé `accordion-listen` pour Écouter, où la famille du contenu sélectionné s'ouvre d'elle-même. Replier une famille ne touche ni la progression ni la sélection.
- **Briques visuelles partagées** par Étudier et Écouter (même apparence partout) : `Page` (`src/components/page.tsx`, colonne, largeur, marges), `PageHeader`, classes de `src/components/ui.ts` (`focusRing`, `cardClass`, `primaryButtonClass`) et `SelectCard` (`src/components/select-card.tsx`) : carte de sélection, vrai bouton `aria-pressed`, sélection = contour orange, fond orange léger et coche. Dans Écouter, tout choix (contenu, motif, durée, ordre) est une `SelectCard`.
- **Étiquettes des fiches** : nature du mot (sauf `other`, non affiché) et catégories `tags` (« cause et conséquence », « opposition »… ; `autre` masqué). Aucun niveau affiché.
- Routes : `/study` (collections regroupées par famille, avec progression, lien « Tous les thèmes »), `/study/themes` (tous les thèmes par famille, avec emoji et nombre de mots, vides compris) et `/study/[collection]` (une page statique par collection). La fiche ouverte est dans le hash (`#word-tractor`) : le bouton retour du téléphone ramène à la liste.
- Fiches avec boutons 🔊 (même `speak()` et même vitesse que le mode Écouter). Un texte s'affiche en entier, traduction masquable.
- **Suivi** (`src/lib/storage/progress.ts`, localStorage) : par `id`, date du premier « vu » (fiche ou texte ouvert) et du premier « écouté » (segment joué jusqu'au bout dans le lecteur, pas s'il est sauté). Paire : écoutée quand ses mots ont tous été lus (segment entier, ou « Écouter en alternance » jusqu'au bout). **Texte et dialogue** : `parts` garde les répliques entendues jusqu'au bout (lecteur ou « Écouter le dialogue complet ») ; ouvert / écouté en partie (n / total) / écouté en entier quand toutes l'ont été, même sur plusieurs séances (`textListening`). Un `listened` enregistré avant ce comptage est conservé (écouté en entier).
- **Sous-thèmes** : filtres (« Tous » + un par sous-thème, `FilterChips`) en haut de la collection ; avec « Tous », un titre de section par sous-thème. Précédent / suivant restent dans le sous-thème choisi, et « 🎧 Écouter » le transmet au mode Écouter.
- **Fiche de règle et de modal** : sens, explication, structure (encadré), les trois formes avec leur étiquette, exemples, erreur fréquente (✗ barré, ✓ avec 🔊), « 🎧 Écouter cette règle ».
- **Compteurs** : « Tous les dialogues » est une collection `aggregate`, jamais comptée ; Textes et dialogues affiche « 1 texte · 12 dialogues ». L'accueil dit « mots et expressions », « exercices de prononciation », et sépare règles, verbes modaux, textes et dialogues. « ⚡ Tous les verbes simples » (les verbes à particule ont leur thème).
- **Fiche de prononciation** : mots côte à côte (phonétique, traduction, 🔊 chacun), « Écouter en alternance » (A, B, A, B), explication, puis exemples.
- **Dialogue** (`text-reader.tsx`) : situation, « Écouter le dialogue complet » (lecture enchaînée avec les deux voix, réplique en cours soulignée), traduction masquable, répliques décalées selon l'interlocuteur, 🔊 par réplique, expressions importantes à la fin. Lecture enchaînée : `src/lib/speech/sequence.ts` (une seule à la fois, un bouton 🔊 l'arrête).
- `createLocalStore` (`src/lib/storage/local-store.ts`) : valeur localStorage validée par Zod, exposée à React via `useSyncExternalStore`.

## 8 bis. Sauvegarde et sécurité

- **Sauvegarde** (`/backup`, lien discret sous les chiffres de l'accueil) : export de la progression et des préférences d'écoute dans un fichier JSON (`anglais-progression-AAAA-MM-JJ.json`), import qui **fusionne** sans rien effacer (dates les plus anciennes, toutes les répliques entendues). Fichier relu et validé champ par champ (Zod), taille limitée. Date de la dernière sauvegarde affichée (`backup-last-export`).
- **Stockage persistant** : `navigator.storage.persist()` demandé à chaque visite (`PersistStorage` dans le layout) ; état affiché sur `/backup`. Chrome l'accorde plus volontiers à l'appli installée.
- **En-têtes** (`next.config.ts`) : Content-Security-Policy (tout vient de l'origine ; `unsafe-inline` requis par Next.js pour les pages statiques ; `blob:` pour les pistes du lecteur ; `unsafe-eval` et websocket en développement seulement), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`. Appli personnelle : `noindex` (en-tête et métadonnées).
- **Cache de l'audio** : `/audio/*` en `max-age` d'un an, `immutable` (le nom d'un fichier change avec son texte ou sa voix).

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
3. ✅ **Nouveaux thèmes de mots** (9 octobre) : 41 thèmes en 7 familles, 962 mots, audio généré. Pas de thème « objets du quotidien » (à ajouter si souhaité).
4. ✅ **Autres verbes** (10 octobre) : 96 verbes en 7 sous-thèmes (`verb-groups.json`).
7. ✅ **Conversation, quantités, adverbes, verbes à particule, prononciation, dialogues** (10 octobre) : 5 thèmes à sous-thèmes, 45 paires, 12 dialogues. Pas de thème séparé sur les contractions (à faire si souhaité).
8. ✅ **Corrections éditoriales, modaux et règles orales** (10 octobre) : 30 fiches de modaux et semi-modaux, 12 nouvelles règles (17 au total), compteurs corrigés.
9. ✅ **Analyse, points 1 à 5** (10 octobre) : sauvegarde et stockage persistant, traductions propres à l'écoute (`note`), nombres complets et alphabet, en-têtes de sécurité et cache de l'audio, 5 histoires du soir, Cuisine et Agriculture enrichies.

Pistes restantes de l'analyse (10 octobre) : catégories (`tags`) sur plus de mots pour le futur quiz ; deux exemples en double (tea / a cup of, take off / shoes) ; balisage `lang="en"` des phrases anglaises ; surveiller la taille du dépôt (audio) et `msedge-tts` (service non officiel) ; vulnérabilités `npm audit` limitées à l'outillage de lint.
5. ✅ **Mots de coordination** (9 octobre) : thème `connecteurs` (71 entrées, catégories en `tags`), sans changement de schéma.
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
