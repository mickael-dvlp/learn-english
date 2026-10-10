"use client";

import Link from "next/link";
import { Accordion } from "@/components/accordion";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";
import { ProgressLine } from "@/components/progress-line";
import { cardClass, focusRing } from "@/components/ui";
import { familyCountLabel, familyTitle, type CountedCollection, type FamilyHeading } from "@/lib/content/collections";
import { useAccordion } from "@/lib/storage/accordion";
import { useLocalStore } from "@/lib/storage/local-store";
import { progressStore, summarize } from "@/lib/storage/progress";

type CollectionSummary = { id: string; label: string; familyId: string; itemIds: string[] } & CountedCollection;

export function StudyHub({ families, collections }: { families: FamilyHeading[]; collections: CollectionSummary[] }) {
  const progress = useLocalStore(progressStore);
  const visibleFamilies = families.filter((family) => collections.some((c) => c.familyId === family.id));
  const [openId, setOpenId] = useAccordion("study", visibleFamilies[0]?.id ?? null);

  return (
    <Page>
      <PageHeader title="Étudier" backHref="/" backLabel="Retour à l'accueil" />

      <Link href="/study/themes" className={`-mt-2 self-end rounded-xl px-2 py-1 text-sm text-accent ${focusRing}`}>
        Tous les thèmes →
      </Link>

      <Accordion
        idPrefix="study"
        openId={openId}
        onOpenChange={setOpenId}
        sections={visibleFamilies.map((family) => {
          const familyCollections = collections.filter((c) => c.familyId === family.id);
          // An item can be in two collections (all verbs / irregular verbs): count it once.
          const { seen, total } = summarize(progress, [...new Set(familyCollections.flatMap((c) => c.itemIds))]);
          return {
            id: family.id,
            title: familyTitle(family),
            meta: (
              <>
                {familyCountLabel(family, familyCollections)}
                <br />
                <span className="text-xs">
                  {seen} / {total} vus
                </span>
              </>
            ),
            content: familyCollections.map((collection) => (
              <Link
                key={collection.id}
                href={`/study/${collection.id}`}
                className={`${cardClass} flex-col justify-center gap-1`}
              >
                <span className="text-lg">{collection.label}</span>
                <ProgressLine {...summarize(progress, collection.itemIds)} />
              </Link>
            )),
          };
        })}
      />
    </Page>
  );
}
