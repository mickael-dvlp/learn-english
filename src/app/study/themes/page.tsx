import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getContent } from "@/lib/content/load";
import { plural } from "@/lib/format";

export const metadata: Metadata = { title: "Thèmes · Anglais" };

/** Every theme of themes.json with its number of words, empty themes included. */
export default function ThemesPage() {
  const { themes, words } = getContent();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 pb-10 pt-6">
      <PageHeader title="Thèmes" backHref="/study" backLabel="Retour à Étudier" />

      <ul className="flex flex-col gap-2">
        {themes.map((theme) => {
          const count = words.filter((word) => word.theme === theme.id).length;
          const content = (
            <>
              <span className="text-2xl" aria-hidden>
                {theme.emoji ?? "•"}
              </span>
              <span className="flex flex-1 flex-col">
                <span className="text-lg">{theme.name.fr}</span>
                <span className="text-sm text-muted">{theme.name.en}</span>
              </span>
              <span className="text-sm text-muted tabular-nums">{plural(count, "mot")}</span>
            </>
          );
          const className = "flex min-h-16 items-center gap-4 rounded-2xl bg-surface px-4 py-3";
          return (
            <li key={theme.id}>
              {count > 0 ? (
                <Link href={`/study/theme-${theme.id}`} className={className}>
                  {content}
                </Link>
              ) : (
                <div className={`${className} opacity-60`}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
