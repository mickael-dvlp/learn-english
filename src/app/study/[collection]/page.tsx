import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { listCollections } from "@/lib/content/collections";
import { getContent } from "@/lib/content/load";
import { CollectionView } from "./collection-view";
import { TextReader } from "./text-reader";

export function generateStaticParams() {
  return listCollections(getContent()).map((collection) => ({ collection: collection.id }));
}

function findCollection(id: string) {
  return listCollections(getContent()).find((collection) => collection.id === id);
}

export async function generateMetadata({ params }: PageProps<"/study/[collection]">): Promise<Metadata> {
  const collection = findCollection((await params).collection);
  return { title: `${collection?.label ?? "Étudier"} · Anglais` };
}

/**
 * The page shell is shared by every collection; what depends on the URL (params) is read
 * behind Suspense so that navigation shows the shell instantly (Partial Prefetching).
 */
export default function CollectionPage({ params }: PageProps<"/study/[collection]">) {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <CollectionContent params={params} />
    </Suspense>
  );
}

async function CollectionContent({ params }: Pick<PageProps<"/study/[collection]">, "params">) {
  const collection = findCollection((await params).collection);
  if (!collection) notFound();

  // A single text opens its reader; several (all the dialogues) are listed, each with its own page.
  const [first] = collection.items;
  if (collection.items.length === 1 && first.type === "text") {
    return <TextReader text={first} collectionId={collection.id} familyId={collection.familyId} />;
  }
  return <CollectionView collection={collection} />;
}
