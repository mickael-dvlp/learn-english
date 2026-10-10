import type { Metadata } from "next";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";
import { BackupScreen } from "./backup-screen";

export const metadata: Metadata = { title: "Sauvegarde · Anglais" };

export default function BackupPage() {
  return (
    <Page>
      <PageHeader title="Sauvegarde" backHref="/" backLabel="Retour à l'accueil" />
      <BackupScreen />
    </Page>
  );
}
