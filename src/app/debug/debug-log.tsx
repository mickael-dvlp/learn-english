"use client";

import { useReducer, useSyncExternalStore } from "react";
import { clearDebugLog, readDebugLog } from "@/lib/debug/log";

const noSubscription = () => () => {};

export function DebugLog() {
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  // Re-read on every render; the joined string is a stable snapshot.
  const log = useSyncExternalStore(noSubscription, () => readDebugLog().join("\n"), () => "");

  return (
    <>
      <p className="text-sm text-muted">
        Derniers événements du lecteur, du plus récent au plus ancien. 🔒 = écran verrouillé ou appli en arrière-plan.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={refresh} className="min-h-12 flex-1 rounded-2xl bg-surface">
          Rafraîchir
        </button>
        <button
          type="button"
          onClick={() => {
            clearDebugLog();
            refresh();
          }}
          className="min-h-12 flex-1 rounded-2xl bg-surface"
        >
          Effacer
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl bg-surface p-4 text-xs leading-relaxed">
        {log ? log.split("\n").reverse().join("\n") : "Journal vide."}
      </pre>
    </>
  );
}
