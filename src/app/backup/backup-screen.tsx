"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { cardClass, focusRing, primaryButtonClass } from "@/components/ui";
import { backupFileName, createBackup, mergeProgress, parseBackup } from "@/lib/storage/backup";
import { createLocalStore, useLocalStore } from "@/lib/storage/local-store";
import { persistState, requestPersistence, type PersistState } from "@/lib/storage/persist";
import { preferencesStore } from "@/lib/storage/preferences";
import { progressStore, type Progress } from "@/lib/storage/progress";

const lastExportStore = createLocalStore("backup-last-export", z.number().nullable(), null);

type Message = { kind: "success" | "error"; text: string };

/** Export, import (merged, nothing lost) and protection of the progress kept in this browser. */
export function BackupScreen() {
  const progress = useLocalStore(progressStore);
  const lastExport = useLocalStore(lastExportStore);
  const [persist, setPersist] = useState<PersistState | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const { seen, listened } = counts(progress);

  useEffect(() => {
    void persistState().then(setPersist);
  }, []);

  const exportFile = () => {
    const now = new Date();
    const backup = createBackup(progressStore.get(), preferencesStore.get(), now);
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 1)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFileName(now);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    lastExportStore.set(now.getTime());
    setMessage({ kind: "success", text: `Fichier « ${backupFileName(now)} » enregistré dans tes téléchargements.` });
  };

  const importFile = async (file: File) => {
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) return setMessage({ kind: "error", text: parsed.error });
    const before = counts(progressStore.get());
    progressStore.set(mergeProgress(progressStore.get(), parsed.progress));
    if (parsed.preferences) preferencesStore.set(parsed.preferences);
    const after = counts(progressStore.get());
    setMessage({
      kind: "success",
      text:
        `Sauvegarde du ${parsed.exportedAt.toLocaleDateString("fr-FR")} importée et fusionnée : ` +
        `${after.seen - before.seen} éléments vus et ${after.listened - before.listened} écoutés en plus. Rien n'a été effacé.`,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted">
        Ta progression est gardée dans ce navigateur, sur ce téléphone seulement. Une sauvegarde régulière évite de la perdre
        si les données de Chrome sont effacées.
      </p>

      <section className={`${cardClass} flex-col gap-1 py-4`} aria-label="Ta progression">
        <p className="text-lg">
          {seen} éléments vus · {listened} écoutés
        </p>
        <p className="text-sm text-muted">
          {lastExport === null
            ? "Jamais sauvegardée"
            : `Dernière sauvegarde : ${new Date(lastExport).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`}
        </p>
      </section>

      <Block title="Exporter">
        <button type="button" onClick={exportFile} className={primaryButtonClass}>
          Exporter ma progression
        </button>
      </Block>

      <Block title="Importer">
        <p className="text-sm text-muted">Fusionne une sauvegarde avec ta progression actuelle : les dates les plus anciennes sont gardées.</p>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          id="backup-file"
          // Opened by the button below: kept out of the tab order, so focus never lands on something invisible.
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importFile(file);
            event.target.value = "";
          }}
        />
        <button type="button" onClick={() => input.current?.click()} className={`${cardClass} items-center justify-center text-lg`}>
          Choisir un fichier de sauvegarde
        </button>
      </Block>

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`rounded-2xl px-4 py-3 ${message.kind === "error" ? "bg-accent/15 ring-2 ring-inset ring-accent" : "bg-surface"}`}
        >
          {message.kind === "error" ? "✗ " : "✓ "}
          {message.text}
        </p>
      )}

      <Block title="Protection contre l'effacement">
        <p className="text-sm text-muted">
          {persist === "persisted"
            ? "✓ Activée : le téléphone ne supprimera pas ta progression pour faire de la place."
            : persist === "unsupported"
              ? "Ce navigateur ne permet pas de la demander."
              : "Pas encore accordée : si le téléphone manque de place, Chrome peut effacer les données. Installer l'appli sur l'écran d'accueil aide à l'obtenir."}
        </p>
        {persist === "not-persisted" && (
          <button
            type="button"
            onClick={() => void requestPersistence().then(setPersist)}
            className={`${cardClass} items-center justify-center text-lg ${focusRing}`}
          >
            Demander la protection
          </button>
        )}
      </Block>
    </div>
  );
}

function counts(progress: Progress) {
  const entries = Object.values(progress);
  return {
    seen: entries.filter((entry) => entry.seen !== undefined).length,
    listened: entries.filter((entry) => entry.listened !== undefined).length,
  };
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
