import { focusRing } from "./ui";

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** The value as shown (« ×0,90 », « 20 questions »). */
  display: string;
  onChange: (value: number) => void;
};

/** A setting on a range (voice speed, pauses, number of quiz questions), label and value above. */
export function Slider({ label, value, min, max, step, display, onChange }: Props) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex justify-between gap-3">
        <span>{label}</span>
        <span className="text-sm text-muted tabular-nums">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`h-10 rounded-full accent-accent ${focusRing}`}
      />
    </label>
  );
}
