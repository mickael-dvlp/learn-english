import type { Metadata } from "next";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";
import { familyHeadings } from "@/lib/content/collections";
import { getContent } from "@/lib/content/load";
import { ThemesList } from "./themes-list";

export const metadata: Metadata = { title: "Thèmes · Anglais" };

/** Every theme of themes.json, by family, with its number of words (empty themes included). */
export default function ThemesPage() {
  const library = getContent();
  const themes = library.themes.map((theme) => ({
    id: theme.id,
    familyId: theme.family,
    name: theme.name,
    emoji: theme.emoji,
    count: library.words.filter((word) => word.theme === theme.id).length,
  }));

  return (
    <Page>
      <PageHeader title="Thèmes" backHref="/study" backLabel="Retour à Étudier" />
      <ThemesList families={familyHeadings(library)} themes={themes} />
    </Page>
  );
}
