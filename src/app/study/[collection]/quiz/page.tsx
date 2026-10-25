import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { listCollections } from "@/lib/content/collections";
import { getContent } from "@/lib/content/load";
import { isQuizItem } from "@/lib/quiz/quiz";
import { QuizScreen } from "./quiz-screen";

/** Collections with something to translate (word themes, verbs). */
function quizCollections() {
  return listCollections(getContent()).filter((collection) => collection.items.some(isQuizItem));
}

export function generateStaticParams() {
  return quizCollections().map((collection) => ({ collection: collection.id }));
}

export async function generateMetadata({ params }: PageProps<"/study/[collection]/quiz">): Promise<Metadata> {
  const { collection: id } = await params;
  const collection = quizCollections().find((c) => c.id === id);
  return { title: `Quiz · ${collection?.label ?? "Étudier"} · Anglais` };
}

/** The quiz of a theme: every word of it (or every verb), the number of questions chosen first. */
export default function QuizPage({ params }: PageProps<"/study/[collection]/quiz">) {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <QuizContent params={params} />
    </Suspense>
  );
}

async function QuizContent({ params }: Pick<PageProps<"/study/[collection]/quiz">, "params">) {
  const { collection: id } = await params;
  const collection = quizCollections().find((c) => c.id === id);
  if (!collection) notFound();
  return <QuizScreen collectionId={collection.id} label={collection.label} items={collection.items.filter(isQuizItem)} />;
}
