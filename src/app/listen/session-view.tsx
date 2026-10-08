"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { bindMediaSession } from "@/lib/player/media-session";
import type { Player } from "@/lib/player/player";
import { startKeepAlive, stopKeepAlive } from "@/lib/speech/keep-alive";

type Props = { player: Player; title: string; onClose: () => void };

/** Minimal screen while listening: current item, play/pause, time left. */
export function SessionView({ player, title, onClose }: Props) {
  const { status, segment, step } = useSyncExternalStore(player.subscribe, player.getSnapshot, player.getSnapshot);
  const [remainingMs, setRemainingMs] = useState(player.remainingMs);
  const pendingStop = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    // Leaving the screen stops the session. Deferred so that React's dev double mount does not stop it.
    clearTimeout(pendingStop.current);
    const unbindMediaSession = bindMediaSession(player, title);
    const syncKeepAlive = () => (player.getSnapshot().status === "playing" ? startKeepAlive() : stopKeepAlive());
    const unsubscribe = player.subscribe(syncKeepAlive);
    const timer = setInterval(() => setRemainingMs(player.remainingMs()), 500);
    return () => {
      clearInterval(timer);
      unsubscribe();
      unbindMediaSession();
      pendingStop.current = setTimeout(() => {
        player.stop();
        stopKeepAlive();
      }, 0);
    };
  }, [player, title]);

  if (status === "ended") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-5 text-center">
        <p className="text-5xl">🌙</p>
        <p className="text-2xl font-semibold">Session terminée</p>
        <p className="text-muted">Bonne nuit, et à demain.</p>
        <button
          type="button"
          onClick={onClose}
          className="min-h-14 w-full rounded-3xl bg-surface text-lg font-semibold"
        >
          Retour
        </button>
      </main>
    );
  }

  const spoken = step?.kind === "speak" ? step.unit[step.lang] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-10 pt-6">
      <header className="flex items-center justify-between text-muted">
        <span className="truncate">{title}</span>
        <span className="tabular-nums" aria-label="Temps restant">
          {formatTime(remainingMs)}
        </span>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="text-3xl font-semibold leading-snug">{segment?.label}</p>
        <p className="min-h-14 text-lg text-muted" aria-live="polite">
          {spoken !== undefined && spoken !== segment?.label ? spoken : " "}
        </p>
      </div>

      <div className="flex items-center justify-center gap-6">
        <RoundButton label="Précédent" onClick={player.previous}>
          ⏮
        </RoundButton>
        <RoundButton label={status === "playing" ? "Pause" : "Lecture"} onClick={player.toggle} big>
          {status === "playing" ? "⏸" : "▶"}
        </RoundButton>
        <RoundButton label="Suivant" onClick={player.next}>
          ⏭
        </RoundButton>
      </div>

      <button
        type="button"
        onClick={() => {
          player.stop();
          onClose();
        }}
        className="mt-8 min-h-12 self-center rounded-2xl px-6 text-muted"
      >
        Arrêter
      </button>
    </main>
  );
}

function RoundButton(props: { label: string; onClick: () => void; big?: boolean; children: string }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      onClick={props.onClick}
      className={`flex items-center justify-center rounded-full ${
        props.big ? "h-24 w-24 bg-accent text-4xl text-accent-foreground" : "h-16 w-16 bg-surface text-2xl"
      }`}
    >
      {props.children}
    </button>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
