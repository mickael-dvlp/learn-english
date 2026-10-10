"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SpeakButton } from "@/components/speak-button";
import { focusRing } from "@/components/ui";
import type { Bilingual, ContentItem, Pair, Rule, RuleForm, Verb, Word } from "@/lib/content/schema";
import { useSpeakSequence } from "@/lib/speech/sequence";
import { setPreferences } from "@/lib/storage/preferences";
import { markListened } from "@/lib/storage/progress";
import { wordBadges } from "../labels";

/** Reading card for a word, a verb, a rule or a pronunciation pair. */
export function ItemCard({ item, collectionId }: { item: ContentItem; collectionId?: string }) {
  switch (item.type) {
    case "word":
      return <WordCard word={item} />;
    case "verb":
      return <VerbCard verb={item} />;
    case "rule":
      return <RuleCard rule={item} collectionId={collectionId} />;
    case "pair":
      return <PairCard pair={item} />;
    case "text":
      return null; // Texts have their own reader.
  }
}

/**
 * Words side by side, one 🔊 each, and "listen in turn" (A, B, A, B…). Heard in turn to the end,
 * the pair counts as listened to, as in the player.
 */
function PairCard({ pair }: { pair: Pair }) {
  const sequence = useSpeakSequence();
  const inTurn = [...pair.words, ...pair.words].map((word) => ({ text: word.en }));
  const playingWord = sequence.current === null ? null : sequence.current % pair.words.length;
  return (
    <article className="flex flex-col gap-5">
      <Badges>
        <Badge>prononciation</Badge>
      </Badges>
      <ul className={`grid gap-2 ${pair.words.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {pair.words.map((word, index) => (
          <li
            key={word.en}
            className={`flex flex-col items-center gap-1 rounded-3xl px-2 py-4 text-center ${
              playingWord === index ? "bg-accent/15 ring-2 ring-inset ring-accent" : "bg-surface"
            }`}
          >
            <span className="text-2xl font-semibold break-words">{word.en}</span>
            {word.ipa && <span className="text-sm text-muted">{word.ipa}</span>}
            <span className="text-muted">{word.fr}</span>
            <SpeakButton text={word.en} label={`Écouter « ${word.en} »`} className="mt-2 bg-background" />
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => (sequence.playing ? sequence.stop() : sequence.start(inTurn, { gapMs: 700, onEnd: (done) => done && markListened(pair.id) }))}
        className={`flex min-h-14 items-center justify-center gap-2 rounded-3xl bg-accent text-lg font-semibold text-accent-foreground ${focusRing}`}
      >
        {sequence.playing ? "■ Arrêter" : "▶ Écouter en alternance"}
      </button>
      <p className="text-lg leading-relaxed">{pair.explanation}</p>
      <div className="flex flex-col gap-3">
        {pair.words.map((word) => word.example && <Example key={word.en} example={word.example} />)}
      </div>
    </article>
  );
}

function WordCard({ word }: { word: Word }) {
  return (
    <article className="flex flex-col gap-6">
      <Badges>
        {wordBadges(word).map((label) => (
          <Badge key={label}>{label}</Badge>
        ))}
      </Badges>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-4xl font-semibold">{word.en}</h2>
        <SpeakButton text={word.speakEn ?? word.en} />
      </div>
      <p className="text-2xl text-muted">{word.fr}</p>
      {word.note && <Note>{word.note}</Note>}
      {word.example && <Example example={word.example} />}
    </article>
  );
}

function VerbCard({ verb }: { verb: Verb }) {
  const forms = [
    { label: "Base", value: verb.base },
    { label: "Prétérit", value: verb.past },
    { label: "Participe passé", value: verb.pastParticiple },
  ];
  return (
    <article className="flex flex-col gap-6">
      <Badges>
        <Badge>{verb.regular ? "régulier" : "irrégulier"}</Badge>
      </Badges>
      <div className="flex items-start justify-between gap-4">
        <dl className="grid flex-1 grid-cols-3 gap-2">
          {forms.map((form) => (
            <div key={form.label} className="flex flex-col gap-1">
              <dt className="text-xs text-muted">{form.label}</dt>
              <dd className="text-2xl font-semibold">{form.value}</dd>
            </div>
          ))}
        </dl>
        <SpeakButton text={verb.speak ?? `${verb.base}, ${verb.past}, ${verb.pastParticiple}`} />
      </div>
      <p className="text-2xl text-muted">{verb.fr}</p>
      {verb.note && <Note>{verb.note}</Note>}
      {verb.example && <Example example={verb.example} />}
    </article>
  );
}

const RULE_KINDS: Record<Rule["kind"], string> = { conjugation: "conjugaison", special: "règle", modal: "verbe modal" };
const FORM_LABELS: Record<RuleForm["kind"], string> = { affirmative: "Affirmatif", negative: "Négatif", question: "Question" };

/**
 * A rule or a modal: what it is for, its structure, its three forms, examples, a frequent mistake.
 * Every English sentence has a speak button, except the wrong one of the mistake.
 */
function RuleCard({ rule, collectionId }: { rule: Rule; collectionId?: string }) {
  return (
    <article className="flex flex-col gap-5">
      <Badges>
        <Badge>{RULE_KINDS[rule.kind]}</Badge>
      </Badges>
      <div>
        <h2 className="text-3xl font-semibold">{rule.title.fr}</h2>
        <p className="text-muted">{rule.title.en}</p>
      </div>
      {rule.meaning && <p className="text-lg font-semibold text-accent">{rule.meaning}</p>}
      <p className="text-lg leading-relaxed">{rule.explanation}</p>
      {rule.structure && (
        <p className="rounded-2xl border-2 border-dashed border-accent/40 px-4 py-3 text-center text-lg font-semibold">
          {rule.structure}
        </p>
      )}
      {rule.forms && rule.forms.length > 0 && (
        <RuleSection title="Les trois formes">
          {rule.forms.map((form) => (
            <Example key={form.en} example={form} label={FORM_LABELS[form.kind]} />
          ))}
        </RuleSection>
      )}
      <RuleSection title="Exemples">
        {rule.examples.map((example) => (
          <Example key={example.en} example={example} />
        ))}
      </RuleSection>
      {rule.mistake && (
        <RuleSection title="Erreur fréquente">
          <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
            <p className="text-muted">
              <span aria-hidden>✗ </span>
              <span className="sr-only">Incorrect : </span>
              <s>{rule.mistake.wrong}</s>
            </p>
            <div className="flex items-center gap-3">
              <p className="flex-1 text-lg">
                <span aria-hidden className="text-accent">
                  ✓{" "}
                </span>
                <span className="sr-only">Correct : </span>
                {rule.mistake.right}
              </p>
              <SpeakButton text={rule.mistake.right} className="bg-background" />
            </div>
            {rule.mistake.note && <p className="text-sm text-muted">{rule.mistake.note}</p>}
          </div>
        </RuleSection>
      )}
      {collectionId && (
        <Link
          href="/listen"
          onClick={() => setPreferences({ sourceId: collectionId, groupId: rule.group, itemId: rule.id })}
          className={`flex min-h-12 items-center justify-center rounded-2xl bg-surface px-4 font-semibold ${focusRing}`}
        >
          🎧 Écouter cette règle
        </Link>
      )}
    </article>
  );
}

function RuleSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-muted">{title}</h3>
      {children}
    </section>
  );
}

/** An English sentence and its translation, with a speak button; `label` names its form (Négatif…). */
function Example({ example, label }: { example: Bilingual; label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface p-4">
      <div className="flex flex-1 flex-col gap-1">
        {label && <p className="text-xs font-semibold uppercase tracking-wide text-accent">{label}</p>}
        <p className="text-lg">{example.en}</p>
        <p className="text-muted">{example.fr}</p>
      </div>
      <SpeakButton text={example.en} className="bg-background" />
    </div>
  );
}

/** A usage note: shown, never read aloud. */
function Note({ children }: { children: ReactNode }) {
  return (
    <p className="-mt-3 text-sm text-muted">
      <span aria-hidden>ⓘ </span>
      {children}
    </p>
  );
}

function Badges({ children }: { children: ReactNode }) {
  return <div className="flex min-h-7 flex-wrap gap-2">{children}</div>;
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-surface px-3 py-1 text-sm text-muted">{children}</span>;
}
