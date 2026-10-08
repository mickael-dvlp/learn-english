import Link from "next/link";
import { getContent } from "@/lib/content/load";
import { plural } from "@/lib/format";

const cardClass = "flex min-h-20 flex-col items-start justify-center rounded-3xl px-6 py-4 text-left";

const comingSoon = [
  { label: "Étudier", hint: "Fiches et révisions" },
  { label: "Continuer où j'en étais", hint: "Reprendre la dernière session" },
];

export default function Home() {
  const { themes, words, verbs, rules, texts } = getContent();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-end gap-4 px-5 pb-10 pt-16">
      <h1 className="mb-auto text-3xl font-semibold">Bonsoir 👋</h1>

      <Link href="/listen" className={`${cardClass} bg-accent text-accent-foreground`}>
        <span className="text-xl font-semibold">Écouter</span>
        <span className="text-sm opacity-80">Mots, verbes, textes… les yeux fermés</span>
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
          plural(words.length, "mot"),
          plural(verbs.length, "verbe"),
          plural(rules.length, "règle"),
          plural(texts.length, "texte"),
        ].join(" · ")}
      </p>
    </main>
  );
}
