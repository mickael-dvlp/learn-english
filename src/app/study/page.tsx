import type { Metadata } from "next";
import { familyHeadings, listCollections } from "@/lib/content/collections";
import { getContent } from "@/lib/content/load";
import { StudyHub } from "./study-hub";

export const metadata: Metadata = { title: "Étudier · Anglais" };

export default function StudyPage() {
  const library = getContent();
  const collections = listCollections(library).map(({ id, label, familyId, items, aggregate, textKind }) => ({
    id,
    label,
    familyId,
    itemIds: items.map((item) => item.id),
    ...(aggregate && { aggregate }),
    ...(textKind && { textKind }),
  }));
  return <StudyHub families={familyHeadings(library)} collections={collections} />;
}
