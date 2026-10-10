import type { Metadata } from "next";
import { getContent } from "@/lib/content/load";
import { familyHeadings, listCollections } from "@/lib/content/collections";
import { ListenScreen } from "./listen-screen";

export const metadata: Metadata = { title: "Écouter · Anglais" };

export default function ListenPage() {
  const library = getContent();
  return <ListenScreen families={familyHeadings(library)} sources={listCollections(library)} />;
}
