import type { ReactNode } from "react";

/**
 * Main column of a page: same width, side margins and spacing everywhere.
 * `className` adds to it (bottom space, alignment), it never replaces it.
 */
export function Page({ children, className = "pb-10" }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 pt-6 ${className}`}>{children}</main>;
}
