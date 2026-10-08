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
| Voix (phase 2) | Fichiers audio générés, référencés par un champ `audio` |
| Minuteur | Minuteur de durée de session (5/10/30 min, valeur libre possible) avec arrêt net. **Pas de fade-out.** |

## 3. Deux modes, un seul contenu

Il n'y a **pas** d'arborescence séparée « oral » / « écrit ». Le contenu est unique, deux modes l'exploitent.

- **Mode Écouter** : l'utilisateur choisit un contenu (thème, verbes, règles, texte), une durée, un motif de lecture. L'appli génère une playlist et la joue.
- **Mode Étudier** : listes, fiches, quiz, suivi de ce qui est vu.

Un élément ajouté dans les données apparaît automatiquement dans les deux modes.

## 4. Types de contenu

Quatre types. Champs communs à tous :

- `id` : string stable, jamais modifié après création (sert aussi de nom de fichier audio). Format `<type>-<slug>` ex. `word-tractor`, `verb-go`.
- `level` : `"A1" | "A2" | "B1" | "B2" | "C1"`
- `tags` : string[] (optionnel), transversal aux thèmes
- `audio` : objet optionnel, voir section 6

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
  audio?: AudioRefs;
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
  audio?: AudioRefs;
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
  audio?: AudioRefs;
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
  audio?: AudioRefs;     // audio global optionnel ; sinon par phrase
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
  /audio                      // packs audio, voir section 6
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
- Ne jamais renommer un `id` existant (casse la progression et l'audio).

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
1. Si l'unité a un fichier audio pour cette langue → jouer le fichier (`<audio>`).
2. Sinon → voix native (Web Speech API).

```ts
type AudioRefs = { en?: string; fr?: string };  // chemins relatifs sous /public/audio
```

Conséquence : on peut avoir 200 éléments avec audio généré et 500 en voix native, l'appli fonctionne pareil. Le passage aux audios générés se fera plus tard par un **script** (`/scripts/generate-audio`) qui ne traite que les éléments sans audio.

Point d'attention connu : la voix native (Web Speech API) peut se couper écran verrouillé sur Android. **Tester tôt** une session écran verrouillé. Les fichiers audio via `<audio>` + Media Session API n'ont pas ce problème.

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

## 8. Mode Étudier

- Navigation par thème, verbes, règles, textes.
- Fiches de lecture (mot + exemple, verbe avec ses 3 formes, règle avec exemples).
- Quiz simples (choix multiple EN↔FR).
- Suivi minimal : « vu / écouté » par `id`, stocké localement.
- Répétition espacée : **hors périmètre pour l'instant**.

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

1. **Fondations** : projet Next.js + TS + Tailwind, schémas de types, validation du contenu, quelques fichiers d'exemple (2 thèmes, 10 verbes, 2 règles, 1 texte).
2. **Lecteur** : abstraction `speak()`, motifs, pauses, minuteur de session, Media Session. Test écran verrouillé.
3. **Mode Étudier** : listes, fiches, suivi vu/écouté.
4. **PWA et hors-ligne** : manifest, service worker, cache des données.
5. **Audio généré** : script de génération, champ `audio`, packs téléchargeables par thème.
6. **Confort** : quiz, réglages, statistiques d'écoute.

Avancer **une étape à la fois**, la valider avant de passer à la suivante.

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
