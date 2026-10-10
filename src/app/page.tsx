import Image from "next/image";
import Link from "next/link";
import { getContent } from "@/lib/content/load";
import { focusRing } from "@/components/ui";
import { plural } from "@/lib/format";

const cardClass = "flex min-h-20 flex-col items-start justify-center rounded-3xl px-6 py-4 text-left";

/** "1 186": thousands separated as in French. */
const number = (n: number) => n.toLocaleString("fr-FR");

const comingSoon = [
  { label: "Continuer où j'en étais", hint: "Reprendre la dernière session" },
];

export default function Home() {
  const { themes, words, verbs, rules, texts, pairs } = getContent();
  const modals = rules.filter((rule) => rule.kind === "modal");
  const dialogues = texts.filter((text) => text.kind === "dialogue");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-end gap-4 px-5 pb-10 pt-16">
      <header className="mb-auto flex items-center gap-4">
        <Image src="/image/logo-mouton.svg" alt="" width={64} height={64} priority className="rounded-2xl" />
        <h1 className="text-3xl font-semibold">Bonsoir 👋</h1>
      </header>

      <Link href="/listen" className={`${cardClass} bg-accent text-accent-foreground`}>
        <span className="text-xl font-semibold">Écouter</span>
        <span className="text-sm opacity-80">Mots, verbes, textes… les yeux fermés</span>
      </Link>

      <Link href="/study" className={`${cardClass} bg-surface`}>
        <span className="text-xl font-semibold">Étudier</span>
        <span className="text-sm opacity-80">Fiches, verbes, règles et textes</span>
      </Link>

      {comingSoon.map((action) => (
        <button key={action.label} type="button" disabled className={`${cardClass} bg-surface opacity-60`}>
          <span className="text-xl font-semibold">{action.label}</span>
          <span className="text-sm opacity-80">{action.hint} · bientôt</span>
        </button>
      ))}

      <p className="mt-4 text-center text-sm text-muted">
        {[
          plural(themes.length, "thème"),
          // Words, expressions and whole sentences.
          `${number(words.length)} ${words.length > 1 ? "mots et expressions" : "mot"}`,
          plural(verbs.length, "verbe"),
          `${modals.length} ${modals.length > 1 ? "verbes modaux" : "verbe modal"}`,
          plural(rules.length - modals.length, "règle"),
          // Not all of them are strict pairs (-ed endings, word stress…).
          `${number(pairs.length)} ${pairs.length > 1 ? "exercices" : "exercice"} de prononciation`,
          plural(texts.length - dialogues.length, "texte"),
          plural(dialogues.length, "dialogue"),
        ].join(" · ")}
      </p>
      <Link href="/backup" className={`self-center rounded-xl px-3 py-2 text-sm text-accent ${focusRing}`}>
        Sauvegarder ma progression
      </Link>
    </main>
  );
}
