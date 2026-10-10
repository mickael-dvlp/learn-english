"use client";

import Link from "next/link";
import { Accordion } from "@/components/accordion";
import { focusRing } from "@/components/ui";
import { familyTitle, type FamilyHeading } from "@/lib/content/collections";
import type { Bilingual } from "@/lib/content/schema";
import { plural } from "@/lib/format";
import { useAccordion } from "@/lib/storage/accordion";

type ThemeSummary = { id: string; familyId: string; name: Bilingual; emoji?: string; count: number };

/** Shares its open family with the study page: both show the same families. */
export function ThemesList({ families, themes }: { families: FamilyHeading[]; themes: ThemeSummary[] }) {
  const visibleFamilies = families.filter((family) => themes.some((theme) => theme.familyId === family.id));
  const [openId, setOpenId] = useAccordion("study", visibleFamilies[0]?.id ?? null);

  return (
    <Accordion
      idPrefix="themes"
      openId={openId}
      onOpenChange={setOpenId}
      sections={visibleFamilies.map((family) => {
        const familyThemes = themes.filter((theme) => theme.familyId === family.id);
        const words = familyThemes.reduce((total, theme) => total + theme.count, 0);
        return {
          id: family.id,
          title: familyTitle(family),
          meta: (
            <>
              {plural(familyThemes.length, "thème")}
              <br />
              <span className="text-xs">{plural(words, "mot")}</span>
            </>
          ),
          content: (
            <ul className="flex flex-col gap-2">
              {familyThemes.map((theme) => {
                const content = (
                  <>
                    <span className="text-2xl" aria-hidden>
                      {theme.emoji ?? "•"}
                    </span>
                    <span className="flex flex-1 flex-col">
                      <span className="text-lg">{theme.name.fr}</span>
                      <span className="text-sm text-muted">{theme.name.en}</span>
                    </span>
                    <span className="text-sm text-muted tabular-nums">{plural(theme.count, "mot")}</span>
                  </>
                );
                const className = `flex min-h-16 items-center gap-4 rounded-2xl bg-surface px-4 py-3 ${focusRing}`;
                return (
                  <li key={theme.id}>
                    {theme.count > 0 ? (
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
          ),
        };
      })}
    />
  );
}
