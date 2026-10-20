"use client";

import { useId, useState, type ReactNode } from "react";

export function Accordion({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="rounded-[1.25rem] border border-line bg-white">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          id={`${id}-button`}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-[1.25rem] px-4 py-3 text-left text-lg font-bold"
        >
          {title}
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </h2>
      <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-button`} hidden={!open} className="px-4 pb-4">
        {children}
      </div>
    </section>
  );
}
