"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { ProgressLine } from "@/components/progress-line";
import type { Collection } from "@/lib/content/collections";
import type { ContentItem } from "@/lib/content/schema";
import { useLocalStore } from "@/lib/storage/local-store";
import { setPreferences } from "@/lib/storage/preferences";
import { markSeen, progressStore, summarize } from "@/lib/storage/progress";
import { itemSummary } from "../labels";
import { ItemCard } from "./cards";
import { closeHash, openHash, replaceHash, useHash } from "./use-hash";

export function CollectionView({ collection }: { collection: Collection }) {
  const hash = useHash();
  const progress = useLocalStore(progressStore);
  const index = collection.items.findIndex((item) => item.id === hash);

  if (index >= 0) return <CardScreen items={collection.items} index={index} />;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 pb-10 pt-6">
      <PageHeader title={collection.label} backHref="/study" backLabel="Retour à Étudier" />

      <div className="flex items-center justify-between gap-4">
        <ProgressLine {...summarize(progress, collection.items.map((item) => item.id))} />
        <Link
          href="/listen"
          onClick={() => setPreferences({ sourceId: collection.id })}
          className="shrink-0 rounded-2xl bg-accent px-4 py-3 font-semibold text-accent-foreground"
        >
          🎧 Écouter
        </Link>
      </div>

      <ul className="flex flex-col gap-2">
        {collection.items.map((item) => {
          const { primary, secondary } = itemSummary(item);
          const entry = progress[item.id];
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openHash(item.id)}
                className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left"
              >
                <span className="flex flex-1 flex-col">
                  <span className="text-lg">{primary}</span>
                  <span className="text-sm text-muted">{secondary}</span>
                </span>
                <span className="flex gap-1 text-sm" aria-label={statusLabel(entry)}>
                  {entry?.seen !== undefined && <span title="Vu">👁</span>}
                  {entry?.listened !== undefined && <span title="Écouté">🎧</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

function statusLabel(entry: { seen?: number; listened?: number } | undefined) {
  const parts = [entry?.seen !== undefined && "vu", entry?.listened !== undefined && "écouté"].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "nouveau";
}

function CardScreen({ items, index }: { items: ContentItem[]; index: number }) {
  const item = items[index];
  const previous = items[index - 1];
  const next = items[index + 1];

  useEffect(() => markSeen(item.id), [item.id]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 pb-8 pt-6">
      <header className="flex items-center justify-between">
        <button type="button" onClick={closeHash} className="-ml-2 rounded-full px-3 py-2 text-2xl" aria-label="Retour à la liste">
          ←
        </button>
        <span className="text-muted tabular-nums">
          {index + 1} / {items.length}
        </span>
      </header>

      <div className="flex flex-1 flex-col justify-center">
        <ItemCard item={item} />
      </div>

      <nav className="flex gap-3">
        <button
          type="button"
          disabled={!previous}
          onClick={() => previous && replaceHash(previous.id)}
          className="min-h-16 flex-1 rounded-3xl bg-surface text-lg disabled:opacity-40"
        >
          ← Précédent
        </button>
        <button
          type="button"
          disabled={!next}
          onClick={() => next && replaceHash(next.id)}
          className="min-h-16 flex-1 rounded-3xl bg-accent text-lg font-semibold text-accent-foreground disabled:opacity-40"
        >
          Suivant →
        </button>
      </nav>
    </main>
  );
}
