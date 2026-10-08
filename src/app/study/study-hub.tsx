"use client";

import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ProgressLine } from "@/components/progress-line";
import { COLLECTION_GROUPS } from "@/lib/content/collections";
import type { ContentType } from "@/lib/content/schema";
import { useLocalStore } from "@/lib/storage/local-store";
import { progressStore, summarize } from "@/lib/storage/progress";

type CollectionSummary = { id: string; type: ContentType; label: string; itemIds: string[] };

export function StudyHub({ collections }: { collections: CollectionSummary[] }) {
  const progress = useLocalStore(progressStore);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-7 px-5 pb-10 pt-6">
      <PageHeader title="Étudier" backHref="/" backLabel="Retour à l'accueil" />

      {COLLECTION_GROUPS.map((group) => {
        const groupCollections = collections.filter((c) => c.type === group.type);
        if (groupCollections.length === 0) return null;
        return (
          <section key={group.type} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{group.label}</h2>
            {groupCollections.map((collection) => (
              <Link
                key={collection.id}
                href={`/study/${collection.id}`}
                className="flex min-h-16 flex-col justify-center gap-1 rounded-3xl bg-surface px-5 py-3"
              >
                <span className="text-lg">{collection.label}</span>
                <ProgressLine {...summarize(progress, collection.itemIds)} />
              </Link>
            ))}
          </section>
        );
      })}
    </main>
  );
}
