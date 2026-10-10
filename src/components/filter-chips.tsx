import { focusRing } from "./ui";

type Props = {
  /** Accessible name of the group of filters. */
  label: string;
  options: { id: string; label: string }[];
  /** Selected option; undefined = "Tous". */
  value: string | undefined;
  onChange: (id: string | undefined) => void;
};

/**
 * Sub-theme filters (Study and Listen): "Tous" then one pill per sub-theme, real buttons with
 * aria-pressed. Selected = same orange outline, light background and check mark as SelectCard.
 */
export function FilterChips({ label, options, value, onChange }: Props) {
  const all = [{ id: undefined, label: "Tous" }, ...options];
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {all.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id ?? "all"}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            className={`flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm ${focusRing} ${
              selected ? "bg-accent/15 ring-2 ring-inset ring-accent" : "bg-surface"
            }`}
          >
            {selected && (
              <span aria-hidden className="text-accent">
                ✓
              </span>
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
