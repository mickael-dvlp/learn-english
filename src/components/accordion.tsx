"use client";

import type { ReactNode } from "react";
import { focusRing } from "./ui";

export type AccordionSection = {
  /** Stable id (a family id): also used to build the header and panel ids. */
  id: string;
  title: ReactNode;
  /** Short text on the right of the header (count, progress). */
  meta?: ReactNode;
  content: ReactNode;
};

type Props = {
  /** Distinguishes several accordions on the same page and keeps the DOM ids unique. */
  idPrefix: string;
  sections: AccordionSection[];
  /** Open section, or null when everything is closed. One section at most is open. */
  openId: string | null;
  onOpenChange: (id: string | null) => void;
  /** Heading level of the section titles (3 when the accordion sits under another h2). */
  headingLevel?: 2 | 3;
};

/**
 * Collapsible sections, one open at a time. Each header is a real button (aria-expanded,
 * aria-controls); a closed panel is `inert`, so its links are neither focusable nor read.
 * The opening is a short height transition, disabled with prefers-reduced-motion.
 */
export function Accordion({ idPrefix, sections, openId, onOpenChange, headingLevel = 2 }: Props) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <div className="flex flex-col gap-2">
      {sections.map((section) => {
        const open = section.id === openId;
        const headerId = `${idPrefix}-header-${section.id}`;
        const panelId = `${idPrefix}-panel-${section.id}`;
        return (
          <section key={section.id} className="flex flex-col">
            <Heading>
              <button
                id={headerId}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => onOpenChange(open ? null : section.id)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left ${focusRing}`}
              >
                <span
                  aria-hidden
                  className={`w-4 text-center text-xl text-muted transition-transform duration-200 motion-reduce:transition-none ${
                    open ? "rotate-90" : ""
                  }`}
                >
                  ›
                </span>
                <span className="flex-1 text-lg font-semibold">{section.title}</span>
                {section.meta && <span className="shrink-0 text-right text-sm text-muted">{section.meta}</span>}
              </button>
            </Heading>
            <div
              id={panelId}
              role="region"
              aria-labelledby={headerId}
              inert={!open}
              className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
                open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              {/* Small inner padding so that focus outlines are not clipped by overflow-hidden. */}
              <div className="overflow-hidden">
                <div className="flex flex-col gap-3 px-1 pb-4 pt-1">{section.content}</div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
