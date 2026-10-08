import type { ReactNode } from "react";
import { SpeakButton } from "@/components/speak-button";
import type { Bilingual, ContentItem, Rule, Verb, Word } from "@/lib/content/schema";
import { POS_LABELS } from "../labels";

/** Reading card for a word, a verb or a rule. */
export function ItemCard({ item }: { item: ContentItem }) {
  switch (item.type) {
    case "word":
      return <WordCard word={item} />;
    case "verb":
      return <VerbCard verb={item} />;
    case "rule":
      return <RuleCard rule={item} />;
    case "text":
      return null; // Texts have their own reader.
  }
}

function WordCard({ word }: { word: Word }) {
  return (
    <article className="flex flex-col gap-6">
      <Badges>
        <Badge>{word.level}</Badge>
        {word.pos && <Badge>{POS_LABELS[word.pos]}</Badge>}
      </Badges>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-4xl font-semibold">{word.en}</h2>
        <SpeakButton text={word.speakEn ?? word.en} />
      </div>
      <p className="text-2xl text-muted">{word.fr}</p>
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
        <Badge>{verb.level}</Badge>
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
        <SpeakButton text={`${verb.base}, ${verb.past}, ${verb.pastParticiple}`} />
      </div>
      <p className="text-2xl text-muted">{verb.fr}</p>
      {verb.example && <Example example={verb.example} />}
    </article>
  );
}

function RuleCard({ rule }: { rule: Rule }) {
  return (
    <article className="flex flex-col gap-5">
      <Badges>
        <Badge>{rule.level}</Badge>
        <Badge>{rule.kind === "conjugation" ? "conjugaison" : "règle spéciale"}</Badge>
      </Badges>
      <div>
        <h2 className="text-3xl font-semibold">{rule.title.fr}</h2>
        <p className="text-muted">{rule.title.en}</p>
      </div>
      <p className="text-lg leading-relaxed">{rule.explanation}</p>
      <div className="flex flex-col gap-3">
        {rule.examples.map((example) => (
          <Example key={example.en} example={example} />
        ))}
      </div>
    </article>
  );
}

function Example({ example }: { example: Bilingual }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface p-4">
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-lg">{example.en}</p>
        <p className="text-muted">{example.fr}</p>
      </div>
      <SpeakButton text={example.en} className="bg-background" />
    </div>
  );
}

function Badges({ children }: { children: ReactNode }) {
  return <div className="flex gap-2">{children}</div>;
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-surface px-3 py-1 text-sm text-muted">{children}</span>;
}
