"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Page } from "@/components/page";
import { cardClass, focusRing } from "@/components/ui";
import { bindMediaSession } from "@/lib/player/media-session";
import type { Player } from "@/lib/player/player";
import { debugLog } from "@/lib/debug/log";

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
    let lastStatus = player.getSnapshot().status;
    const logStatus = () => {
      const { status } = player.getSnapshot();
      if (status !== lastStatus) debugLog(`lecteur : ${(lastStatus = status)}`);
    };
    const logVisibility = () => debugLog(`écran : ${document.visibilityState === "hidden" ? "verrouillé / caché" : "visible"}`);
    const unsubscribe = player.subscribe(logStatus);
    document.addEventListener("visibilitychange", logVisibility);
    const timer = setInterval(() => setRemainingMs(player.remainingMs()), 500);
    return () => {
      clearInterval(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", logVisibility);
      unbindMediaSession();
      pendingStop.current = setTimeout(player.stop, 0);
    };
  }, [player, title]);

  if (status === "ended") {
    return (
      <Page className="items-center justify-center pb-10 text-center">
        <p className="text-5xl">🌙</p>
        <p className="text-2xl font-semibold">Session terminée</p>
        <p className="text-muted">Bonne nuit, et à demain.</p>
        <button type="button" onClick={onClose} className={`${cardClass} mt-3 w-full items-center justify-center text-lg font-semibold`}>
          Retour
        </button>
      </Page>
    );
  }

  const spoken = step?.kind === "speak" ? step.unit[step.lang] : undefined;
  // In a dialogue: its title (when several are played) and who is talking.
  const context = segment?.context && segment.context !== title ? segment.context : undefined;

  return (
    <Page>
      {/* Same height and alignment as the page headers; the timer stays small. */}
      <header className="flex min-h-12 items-center justify-between gap-3">
        <h1 className="truncate text-2xl font-semibold">{title}</h1>
        <span role="timer" aria-label="Temps restant" className="shrink-0 rounded-full bg-surface px-3 py-1 text-sm text-muted tabular-nums">
          {formatTime(remainingMs)}
        </span>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        {(context || segment?.speaker) && (
          <div className="flex flex-col items-center gap-1">
            {context && <p className="text-muted">{context}</p>}
            {segment?.speaker && <p className="text-lg font-semibold text-accent">{segment.speaker}</p>}
          </div>
        )}
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

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={player.replay}
          aria-label="Rejouer depuis le début de l'élément en cours"
          className={`${cardClass} flex-1 items-center justify-center gap-2 text-lg`}
        >
          <span aria-hidden className="text-muted">
            ↺
          </span>
          Rejouer
        </button>
        <button
          type="button"
          onClick={() => {
            player.stop();
            onClose();
          }}
          className={`${cardClass} flex-1 items-center justify-center gap-2 text-lg`}
        >
          <span aria-hidden className="text-muted">
            ■
          </span>
          Arrêter
        </button>
      </div>
    </Page>
  );
}

function RoundButton(props: { label: string; onClick: () => void; big?: boolean; children: string }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      onClick={props.onClick}
      className={`flex items-center justify-center rounded-full ${focusRing} ${
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
