"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FilterChips } from "@/components/filter-chips";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";
import { ProgressLine } from "@/components/progress-line";
import { focusRing } from "@/components/ui";
import { itemsOf, type Collection } from "@/lib/content/collections";
import type { ContentItem } from "@/lib/content/schema";
import { useLocalStore } from "@/lib/storage/local-store";
import { setPreferences } from "@/lib/storage/preferences";
import { openAccordion } from "@/lib/storage/accordion";
import { markSeen, progressStore, summarize, textListening, type Progress } from "@/lib/storage/progress";
import { itemSummary } from "../labels";
import { ItemCard } from "./cards";
import { closeHash, openHash, replaceHash, useHash } from "./use-hash";

export function CollectionView({ collection }: { collection: Collection }) {
  const hash = useHash();
  const progress = useLocalStore(progressStore);
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const visible = itemsOf(collection, groupId);
  const index = visible.findIndex((item) => item.id === hash);
  // Back on the study page, the family of this collection is the open one.
  useEffect(() => openAccordion("study", collection.familyId), [collection.familyId]);

  // A card of another sub-theme opened by its address: show the whole collection.
  if (index < 0 && groupId !== undefined && collection.items.some((item) => item.id === hash)) setGroupId(undefined);
  // Previous / next stay inside the chosen sub-theme.
  if (index >= 0) return <CardScreen items={visible} index={index} collectionId={collection.id} />;

  const groups = collection.groups ?? [];
  // With "Tous", one titled section per sub-theme; with a filter, that sub-theme only.
  const sections =
    groups.length > 1 && groupId === undefined
      ? groups.map((group) => ({ id: group.id, title: group.label, items: itemsOf(collection, group.id) }))
      : [{ id: "all", title: undefined, items: visible }];

  return (
    <Page>
      <PageHeader title={collection.label} backHref="/study" backLabel="Retour à Étudier" />

      <div className="flex items-center justify-between gap-4">
        <ProgressLine {...summarize(progress, visible.map((item) => item.id))} />
        <Link
          href="/listen"
          onClick={() => setPreferences({ sourceId: collection.id, groupId, itemId: undefined })}
          className={`shrink-0 rounded-2xl bg-accent px-4 py-3 font-semibold text-accent-foreground ${focusRing}`}
        >
          🎧 Écouter
        </Link>
      </div>

      {groups.length > 1 && <FilterChips label="Sous-thèmes" options={groups} value={groupId} onChange={setGroupId} />}

      {sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-2">
          {section.title && <h2 className="mt-2 text-lg font-semibold">{section.title}</h2>}
          <ul className="flex flex-col gap-2">
            {section.items.map((item) => (
              <li key={item.id}>
                <ItemRow item={item} entry={progress[item.id]} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Page>
  );
}

function ItemRow({ item, entry }: { item: ContentItem; entry: Progress[string] | undefined }) {
  const { primary, secondary } = itemSummary(item);
  const className = `flex min-h-16 w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left ${focusRing}`;
  const content = (
    <>
      <span className="flex flex-1 flex-col">
        <span className="text-lg">{primary}</span>
        <span className="text-sm text-muted">{secondary}</span>
      </span>
      <Status item={item} entry={entry} />
    </>
  );
  // A text or dialogue has its own page.
  if (item.type === "text") {
    return (
      <Link href={`/study/${item.id}`} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => openHash(item.id)} className={className}>
      {content}
    </button>
  );
}

function Status({ item, entry }: { item: ContentItem; entry: Progress[string] | undefined }) {
  if (item.type === "text") {
    const count = item.sentences.length;
    const { state, heard } = textListening(entry, count);
    const label =
      state === "full"
        ? "écouté en entier"
        : state === "partial"
          ? `écouté en partie, ${heard} sur ${count}`
          : entry?.seen !== undefined
            ? "ouvert"
            : "nouveau";
    return (
      <span className="flex shrink-0 gap-1 text-sm tabular-nums" aria-label={label}>
        {entry?.seen !== undefined && <span title="Ouvert">👁</span>}
        {state === "full" && <span title="Écouté en entier">🎧</span>}
        {state === "partial" && (
          <span title="Écouté en partie" className="text-muted">
            🎧 {heard}/{count}
          </span>
        )}
      </span>
    );
  }
  // A rule heard in part (some of its examples) is not listened to yet.
  const partial = entry?.listened === undefined && (entry?.parts?.length ?? 0) > 0;
  const parts = [entry?.seen !== undefined && "vu", entry?.listened !== undefined && "écouté", partial && "écouté en partie"].filter(Boolean);
  return (
    <span className="flex gap-1 text-sm" aria-label={parts.length > 0 ? parts.join(", ") : "nouveau"}>
      {entry?.seen !== undefined && <span title="Vu">👁</span>}
      {entry?.listened !== undefined && <span title="Écouté">🎧</span>}
      {partial && (
        <span title="Écouté en partie" className="opacity-50">
          🎧
        </span>
      )}
    </span>
  );
}

function CardScreen({ items, index, collectionId }: { items: ContentItem[]; index: number; collectionId: string }) {
  const item = items[index];
  const previous = items[index - 1];
  const next = items[index + 1];

  useEffect(() => markSeen(item.id), [item.id]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 pb-8 pt-6">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={closeHash}
          className={`-ml-2 rounded-full px-3 py-2 text-2xl ${focusRing}`}
          aria-label="Retour à la liste"
        >
          ←
        </button>
        <span className="text-muted tabular-nums">
          {index + 1} / {items.length}
        </span>
      </header>

      <div className="flex flex-1 flex-col justify-center">
        <ItemCard key={item.id} item={item} collectionId={collectionId} />
      </div>

      <nav className="flex gap-3">
        <button
          type="button"
          disabled={!previous}
          onClick={() => previous && replaceHash(previous.id)}
          className={`min-h-16 flex-1 rounded-3xl bg-surface text-lg disabled:opacity-40 ${focusRing}`}
        >
          ← Précédent
        </button>
        <button
          type="button"
          disabled={!next}
          onClick={() => next && replaceHash(next.id)}
          className={`min-h-16 flex-1 rounded-3xl bg-accent text-lg font-semibold text-accent-foreground disabled:opacity-40 ${focusRing}`}
        >
          Suivant →
        </button>
      </nav>
    </main>
  );
}
