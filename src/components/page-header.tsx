import Link from "next/link";
import { focusRing } from "./ui";

export function PageHeader({ title, backHref, backLabel }: { title: string; backHref: string; backLabel: string }) {
  return (
    <header className="flex items-center gap-3">
      <Link href={backHref} className={`-ml-2 rounded-full px-3 py-2 text-2xl ${focusRing}`} aria-label={backLabel}>
        ←
      </Link>
      <h1 className="text-2xl font-semibold">{title}</h1>
    </header>
  );
}
