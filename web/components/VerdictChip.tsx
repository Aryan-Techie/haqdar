"use client";

import { t, useLang } from "@/lib/i18n";
import type { Verdict } from "@/lib/types";

const look: Record<Verdict, { cls: string; key: string; icon: React.ReactNode }> = {
  eligible: {
    cls: "bg-ok-bg text-ok border-ok",
    key: "results.verdictEligible",
    icon: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  },
  maybe: {
    cls: "bg-warn-bg text-warn border-warn border-dashed",
    key: "results.verdictMaybe",
    icon: (
      <>
        <path d="M9.5 9a2.5 2.5 0 114 2c-.9.7-1.5 1.2-1.5 2.3" />
        <path d="M12 17.2v.1" />
      </>
    ),
  },
  ineligible: {
    cls: "bg-bad-bg text-bad border-bad",
    key: "results.verdictIneligible",
    icon: <path d="M7 7l10 10M17 7L7 17" />,
  },
};

/** Status chip. Colour is never the only cue: each state has its own icon, wording and border style. */
export function VerdictChip({ verdict, className = "" }: { verdict: Verdict; className?: string }) {
  const [lang] = useLang();
  const v = look[verdict];
  return (
    <span
      data-verdict={verdict}
      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-bold ${v.cls} ${className}`}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {v.icon}
      </svg>
      {t(v.key, lang)}
    </span>
  );
}
