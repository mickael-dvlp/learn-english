import type { ReactNode } from "react";
import { cardShape } from "./ui";

type Props = {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Secondary line, in the color of the progress counters. */
  description?: ReactNode;
  /** Short option in a grid (« 5 min »): centered, check mark before the text. */
  compact?: boolean;
};

/**
 * A card that selects instead of navigating: same look as the study cards, real button with
 * aria-pressed. Selected = orange outline, light orange background and a check mark (not color alone).
 */
export function SelectCard({ selected, onClick, children, description, compact = false }: Props) {
  const state = selected ? "bg-accent/15 ring-2 ring-inset ring-accent" : "bg-surface";
  if (compact) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        className={`${cardShape} ${state} w-full items-center justify-center gap-1.5 whitespace-nowrap px-3 text-center text-lg`}
      >
        {selected && (
          <span aria-hidden className="text-accent">
            ✓
          </span>
        )}
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`${cardShape} ${state} w-full items-center gap-3 text-left`}
    >
      <span className="flex flex-1 flex-col gap-1">
        <span className="text-lg">{children}</span>
        {description && <span className="text-sm text-muted">{description}</span>}
      </span>
      <span
        aria-hidden
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm ${
          selected ? "bg-accent font-semibold text-accent-foreground" : "border-2 border-muted/50"
        }`}
      >
        {selected && "✓"}
      </span>
    </button>
  );
}
