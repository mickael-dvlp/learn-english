"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { COLLECTION_GROUPS, type Collection } from "@/lib/content/collections";
import { createBrowserPlayer } from "@/lib/player/browser";
import { lapFactory } from "@/lib/player/compile";
import { patternsFor } from "@/lib/player/patterns";
import type { Player } from "@/lib/player/player";
import { preloadVoices } from "@/lib/speech/speak";
import { useLocalStore } from "@/lib/storage/local-store";
import { preferencesStore, setPreferences } from "@/lib/storage/preferences";
import { markListened } from "@/lib/storage/progress";
import { SessionView } from "./session-view";

const DURATIONS = [5, 10, 30];

type Session = { player: Player; title: string };

export function ListenScreen({ sources }: { sources: Collection[] }) {
  const prefs = useLocalStore(preferencesStore);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(preloadVoices, []);

  if (session) {
    return <SessionView player={session.player} title={session.title} onClose={() => setSession(null)} />;
  }

  if (sources.length === 0) {
    return <p className="p-6">Aucun contenu à écouter pour l&apos;instant.</p>;
  }

  const source = sources.find((s) => s.id === prefs.sourceId) ?? sources[0];
  const patterns = patternsFor(source.type);
  const pattern = patterns.find((p) => p.id === prefs.patternId) ?? patterns[0];

  const start = () => {
    const settings = { rate: prefs.rate, pauseFactor: prefs.pauseFactor };
    const player = createBrowserPlayer({
      durationMs: prefs.durationMinutes * 60_000,
      settings,
      createLap: lapFactory(source.items, pattern, prefs.order),
      onSegmentEnd: (segment) => markListened(segment.itemId),
    });
    // Started from the click itself: browsers only allow audio after a user gesture.
    player.play();
    setSession({ player, title: source.label });
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-7 px-5 pb-32 pt-6">
      <PageHeader title="Écouter" backHref="/" backLabel="Retour à l'accueil" />

      <Section title="Quoi écouter ?">
        {COLLECTION_GROUPS.map((group) => {
          const groupSources = sources.filter((s) => s.type === group.type);
          if (groupSources.length === 0) return null;
          return (
            <div key={group.type} className="flex flex-col gap-2">
              <h3 className="text-sm text-muted">{group.label}</h3>
              <div className="flex flex-wrap gap-2">
                {groupSources.map((s) => (
                  <Chip key={s.id} selected={s.id === source.id} onClick={() => setPreferences({ sourceId: s.id })}>
                    {s.label}
                  </Chip>
                ))}
              </div>
            </div>
          );
        })}
      </Section>

      {patterns.length > 1 && (
        <Section title="Comment ?">
          <div className="flex flex-wrap gap-2">
            {patterns.map((p) => (
              <Chip key={p.id} selected={p.id === pattern.id} onClick={() => setPreferences({ patternId: p.id })}>
                {p.name}
              </Chip>
            ))}
          </div>
          <p className="text-sm text-muted">{pattern.description}</p>
        </Section>
      )}

      <Section title="Combien de temps ?">
        <div className="flex flex-wrap items-center gap-2">
          {DURATIONS.map((minutes) => (
            <Chip
              key={minutes}
              selected={prefs.durationMinutes === minutes}
              onClick={() => setPreferences({ durationMinutes: minutes })}
            >
              {minutes} min
            </Chip>
          ))}
          <label className="flex items-center gap-2 text-sm text-muted">
            Autre
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              value={prefs.durationMinutes}
              onChange={(event) => {
                const minutes = Number(event.target.value);
                if (minutes >= 1 && minutes <= 600) setPreferences({ durationMinutes: minutes });
              }}
              className="w-20 rounded-2xl bg-surface px-3 py-3 text-base text-foreground"
            />
            min
          </label>
        </div>
      </Section>

      <Section title="Ordre">
        <div className="flex gap-2">
          <Chip selected={prefs.order === "sequential"} onClick={() => setPreferences({ order: "sequential" })}>
            Dans l&apos;ordre
          </Chip>
          <Chip selected={prefs.order === "random"} onClick={() => setPreferences({ order: "random" })}>
            Aléatoire
          </Chip>
        </div>
      </Section>

      <Section title="Réglages">
        <Slider
          label="Vitesse de la voix"
          value={prefs.rate}
          min={0.6}
          max={1.2}
          step={0.05}
          display={`×${prefs.rate.toFixed(2).replace(".", ",")}`}
          onChange={(rate) => setPreferences({ rate })}
        />
        <Slider
          label="Longueur des pauses"
          value={prefs.pauseFactor}
          min={0.5}
          max={2.5}
          step={0.25}
          display={`×${prefs.pauseFactor.toFixed(2).replace(".", ",")}`}
          onChange={(pauseFactor) => setPreferences({ pauseFactor })}
        />
      </Section>

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-background via-background to-transparent px-5 pb-6 pt-8">
        <button
          type="button"
          onClick={start}
          className="mx-auto flex min-h-16 w-full max-w-md items-center justify-center rounded-3xl bg-accent text-xl font-semibold text-accent-foreground"
        >
          Lancer l&apos;écoute
        </button>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-12 rounded-2xl px-4 py-2 text-base ${
        selected ? "bg-accent text-accent-foreground" : "bg-surface text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex justify-between text-sm">
        <span>{props.label}</span>
        <span className="text-muted">{props.display}</span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
        className="h-10 accent-accent"
      />
    </label>
  );
}
