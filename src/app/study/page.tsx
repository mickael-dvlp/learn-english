import type { Metadata } from "next";
import { listCollections } from "@/lib/content/collections";
import { getContent } from "@/lib/content/load";
import { StudyHub } from "./study-hub";

export const metadata: Metadata = { title: "Étudier · Anglais" };

export default function StudyPage() {
  const collections = listCollections(getContent()).map(({ id, type, label, items }) => ({
    id,
    type,
    label,
    itemIds: items.map((item) => item.id),
  }));
  return <StudyHub collections={collections} />;
}
