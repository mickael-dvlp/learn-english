import type { Metadata } from "next";
import { getContent } from "@/lib/content/load";
import { listCollections } from "@/lib/content/collections";
import { ListenScreen } from "./listen-screen";

export const metadata: Metadata = { title: "Écouter · Anglais" };

export default function ListenPage() {
  return <ListenScreen sources={listCollections(getContent())} />;
}
