import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { DebugLog } from "./debug-log";

export const metadata: Metadata = { title: "Diagnostic · Anglais" };

/** Not linked from the app: open /debug directly. */
export default function DebugPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 pb-10 pt-6">
      <PageHeader title="Diagnostic" backHref="/" backLabel="Retour à l'accueil" />
      <DebugLog />
    </main>
  );
}
