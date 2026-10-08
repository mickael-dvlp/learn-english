import { plural } from "@/lib/format";

/** "3 / 9 vus · 2 écoutés" with a thin bar for the seen ratio. */
export function ProgressLine({ total, seen, listened }: { total: number; seen: number; listened: number }) {
  const label = total === 1 ? (seen ? "vu" : "pas encore vu") : `${seen} / ${total} vus`;
  return (
    <span className="flex flex-col gap-1.5 text-sm text-muted">
      <span>
        {label}
        {listened > 0 && ` · ${total === 1 ? "écouté" : plural(listened, "écouté")}`}
      </span>
      {total > 1 && (
        <span className="h-1 overflow-hidden rounded-full bg-background">
          <span className="block h-full rounded-full bg-accent" style={{ width: `${(seen / total) * 100}%` }} />
        </span>
      )}
    </span>
  );
}
