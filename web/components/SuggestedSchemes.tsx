"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSchemes } from "@/lib/api";
import { localize, t, useLang } from "@/lib/i18n";
import { useProfile } from "@/lib/profile";
import { Chip } from "@/components/Chip";
import { categoryLabel } from "@/lib/vocab";
import type { Scheme } from "@/lib/types";

const SHOWN = 4;

/** Featured schemes by benefit_weight from the cached /schemes list, narrowed to the user's state when we know it. */
export function SuggestedSchemes() {
  const [lang] = useLang();
  const { profile } = useProfile();
  const [schemes, setSchemes] = useState<Scheme[] | null>(null);

  useEffect(() => {
    let live = true;
    getSchemes()
      .then((s) => live && setSchemes(s))
      .catch(() => live && setSchemes([]));
    return () => {
      live = false;
    };
  }, []);

  const shown = useMemo(() => {
    if (!schemes) return [];
    const mine = schemes.filter((s) => !profile.state || s.states.includes("*") || s.states.includes(profile.state));
    return [...mine].sort((a, b) => b.benefit_weight - a.benefit_weight).slice(0, SHOWN);
  }, [schemes, profile.state]);

  return (
    <section aria-labelledby="suggested-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="suggested-title" className="text-xl font-extrabold">
          {t("home.suggested", lang)}
        </h2>
        <Link href="/search" className="inline-flex min-h-11 items-center px-1 text-base font-bold text-brand-700 underline underline-offset-4">
          {t("common.seeAll", lang)}
        </Link>
      </div>
      {schemes === null ? (
        <p className="text-base text-ink-muted" role="status">
          {t("home.suggestedLoading", lang)}
        </p>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-muted p-4 text-base text-ink-soft">{t("home.suggestedEmpty", lang)}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((s) => (
            <li key={s.id}>
              <Link
                href={`/schemes/${s.id}`}
                className="flex min-h-11 items-start gap-3 rounded-[1.25rem] border border-line bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-bold leading-snug">{localize(s.name, lang)}</span>
                  <span className="mt-1 block text-base leading-snug text-ink-soft">{localize(s.benefit, lang)}</span>
                  <span className="mt-2 flex flex-wrap gap-2">
                    <Chip>{categoryLabel(s.category, lang)}</Chip>
                    <Chip>{t(s.level === "central" ? "home.levelCentral" : "home.levelState", lang)}</Chip>
                  </span>
                </span>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-1 shrink-0 text-ink-muted">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
