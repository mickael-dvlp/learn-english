import type { Metadata } from "next";
import { getContent } from "@/lib/content/load";
import { listSources } from "@/lib/player/sources";
import { ListenScreen } from "./listen-screen";

export const metadata: Metadata = { title: "Écouter · Anglais" };

export default function ListenPage() {
  return <ListenScreen sources={listSources(getContent())} />;
}
