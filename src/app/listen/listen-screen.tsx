"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Accordion } from "@/components/accordion";
import { FilterChips } from "@/components/filter-chips";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/page-header";
import { SelectCard } from "@/components/select-card";
import { cardClass, cardShape, focusRing, primaryButtonClass } from "@/components/ui";
import { familyCountLabel, familyTitle, itemsOf, type Collection, type FamilyHeading } from "@/lib/content/collections";
import { createBrowserPlayer } from "@/lib/player/browser";
import { lapFactory } from "@/lib/player/compile";
import { choosePattern, patternsFor } from "@/lib/player/patterns";
import type { Player } from "@/lib/player/player";
import { preloadVoices } from "@/lib/speech/speak";
import { openAccordion, useAccordion } from "@/lib/storage/accordion";
import { useLocalStore } from "@/lib/storage/local-store";
import { preferencesStore, setPreferences } from "@/lib/storage/preferences";
import { markListened, markPartListened } from "@/lib/storage/progress";
import { SessionView } from "./session-view";

const DURATIONS = [5, 10, 30];

type Session = { player: Player; title: string };

export function ListenScreen({ families, sources }: { families: FamilyHeading[]; sources: Collection[] }) {
  const prefs = useLocalStore(preferencesStore);
  const [session, setSession] = useState<Session | null>(null);
  const selectedFamilyId = (sources.find((s) => s.id === prefs.sourceId) ?? sources[0])?.familyId;
  const [openFamilyId, setOpenFamilyId] = useAccordion("listen", selectedFamilyId ?? null);

  useEffect(preloadVoices, []);
  // Whatever gets focus or is scrolled to stays above the fixed start button.
  useEffect(() => {
    const root = document.documentElement;
    root.style.scrollPaddingBottom = "10rem";
    return () => {
      root.style.scrollPaddingBottom = "";
    };
  }, []);
  // The family of the selected content opens by itself. Closing it never changes the selection.
  useEffect(() => {
    if (selectedFamilyId) openAccordion("listen", selectedFamilyId);
  }, [selectedFamilyId]);

  if (session) {
    return <SessionView player={session.player} title={session.title} onClose={() => setSession(null)} />;
  }

  if (sources.length === 0) {
    return <p className="p-6">Aucun contenu à écouter pour l&apos;instant.</p>;
  }

  const source = sources.find((s) => s.id === prefs.sourceId) ?? sources[0];
  const patterns = patternsFor(source.type);
  const pattern = choosePattern(source.type, prefs.patternId);
  const group = source.groups?.find((g) => g.id === prefs.groupId);
  // Rules (and modals) can be listened to one by one.
  const ruleChoices = source.type === "rule" ? itemsOf(source, group?.id).flatMap((i) => (i.type === "rule" ? [i] : [])) : [];
  const rule = ruleChoices.find((r) => r.id === prefs.itemId);

  const start = () => {
    const settings = { rate: prefs.rate, pauseFactor: prefs.pauseFactor };
    const player = createBrowserPlayer({
      durationMs: prefs.durationMinutes * 60_000,
      settings,
      createLap: lapFactory(rule ? [rule] : itemsOf(source, group?.id), pattern, prefs.order),
      onSegmentEnd: (segment) => {
        // A sentence of a text counts on its own; the text is listened to once all of them are.
        if (segment.part) markPartListened(segment.itemId, segment.part.index, segment.part.needed);
        else if (!segment.intro) markListened(segment.itemId);
      },
    });
    // Started from the click itself: browsers only allow audio after a user gesture.
    player.play();
    const part = rule?.title.fr ?? group?.label;
    setSession({ player, title: part ? `${source.label} · ${part}` : source.label });
  };

  return (
    // Bottom space: the fixed start button (and its fade) never covers the last settings.
    <Page className="pb-44">
      <PageHeader title="Écouter" backHref="/" backLabel="Retour à l'accueil" />

      <div className="flex flex-col gap-8">
        <Section title="Quoi écouter ?">
          <Accordion
            idPrefix="listen"
            headingLevel={3}
            openId={openFamilyId}
            onOpenChange={setOpenFamilyId}
            sections={families
              .map((family) => ({ family, groupSources: sources.filter((s) => s.familyId === family.id) }))
              .filter(({ groupSources }) => groupSources.length > 0)
              .map(({ family, groupSources }) => ({
                id: family.id,
                title: familyTitle(family),
                meta: (
                  <>
                    {familyCountLabel(family, groupSources)}
                    {family.id === source.familyId && (
                      <>
                        <br />
                        <span className="text-xs text-accent">✓ sélectionné</span>
                      </>
                    )}
                  </>
                ),
                content: groupSources.map((s) => (
                  <SelectCard key={s.id} selected={s.id === source.id} onClick={() => s.id !== source.id && setPreferences({ sourceId: s.id, groupId: undefined, itemId: undefined })}>
                    {s.label}
                  </SelectCard>
                )),
              }))}
          />
        </Section>

        {source.groups && source.groups.length > 1 && (
          <Section title="Quelle partie ?">
            <FilterChips
              label={`Sous-thèmes de ${source.label}`}
              options={source.groups}
              value={group?.id}
              onChange={(groupId) => setPreferences({ groupId, itemId: undefined })}
            />
          </Section>
        )}

        {ruleChoices.length > 1 && ruleChoices.length <= 15 && (
          <Section title="Quelle règle ?">
            <FilterChips
              label="Règle à écouter"
              options={ruleChoices.map((r) => ({ id: r.id, label: r.title.fr }))}
              value={rule?.id}
              onChange={(itemId) => setPreferences({ itemId })}
            />
          </Section>
        )}

        {patterns.length > 1 && (
          <Section title="Comment ?">
            {patterns.map((p) => (
              <SelectCard
                key={p.id}
                selected={p.id === pattern.id}
                description={p.description}
                onClick={() => setPreferences({ patternId: p.id })}
              >
                {p.name}
              </SelectCard>
            ))}
          </Section>
        )}

        <Section title="Combien de temps ?">
          <div className="grid grid-cols-3 gap-2">
            {DURATIONS.map((minutes) => (
              <SelectCard
                key={minutes}
                compact
                selected={prefs.durationMinutes === minutes}
                onClick={() => setPreferences({ durationMinutes: minutes })}
              >
                {minutes} min
              </SelectCard>
            ))}
          </div>
          <label
            className={`${cardShape} items-center justify-between gap-3 ${
              DURATIONS.includes(prefs.durationMinutes) ? "bg-surface" : "bg-accent/15 ring-2 ring-inset ring-accent"
            }`}
          >
            <span className="text-lg">Autre durée</span>
            <span className="flex items-center gap-2 text-sm text-muted">
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
                className={`w-20 rounded-2xl bg-background px-3 py-2 text-base text-foreground ${focusRing}`}
              />
              min
            </span>
          </label>
        </Section>

        <Section title="Ordre">
          <div className="grid grid-cols-2 gap-2">
            <SelectCard compact selected={prefs.order === "sequential"} onClick={() => setPreferences({ order: "sequential" })}>
              Dans l&apos;ordre
            </SelectCard>
            <SelectCard compact selected={prefs.order === "random"} onClick={() => setPreferences({ order: "random" })}>
              Aléatoire
            </SelectCard>
          </div>
        </Section>

        <Section title="Réglages">
          <div className={`${cardClass} flex-col gap-4 py-4`}>
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
          </div>
        </Section>
      </div>

      {/* Same width as the page column; the fade lets clicks through, only the button catches them. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 bg-linear-to-t from-background via-background to-transparent pb-6 pt-8">
        <div className="mx-auto w-full max-w-md px-5">
          <button type="button" onClick={start} className={`${primaryButtonClass} pointer-events-auto`}>
            Lancer l&apos;écoute
          </button>
        </div>
      </div>
    </Page>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
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
      <span className="flex justify-between gap-3">
        <span>{props.label}</span>
        <span className="text-sm text-muted tabular-nums">{props.display}</span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
        className={`h-10 rounded-full accent-accent ${focusRing}`}
      />
    </label>
  );
}
