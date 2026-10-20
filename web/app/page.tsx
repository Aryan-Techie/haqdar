"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageChooser } from "@/components/LanguageChooser";
import { SuggestedSchemes } from "@/components/SuggestedSchemes";
import { VoiceCard } from "@/components/VoiceCard";
import { fmt, t, useLang } from "@/lib/i18n";
import { useProfile } from "@/lib/profile";
import { useMatchingResults } from "@/lib/results";
import { optionLabel, vocab } from "@/lib/vocab";

const svg = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

const CATEGORY_ICONS: Record<string, ReactNode> = {
  pension: svg(<><circle cx="12" cy="7" r="3" /><path d="M6 21v-3a6 6 0 0112 0v3M18 14l3 7" /></>),
  health: svg(<path d="M12 21s-8-5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 6-8 11-8 11z" />),
  education: svg(<><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c3 2.5 9 2.5 12 0v-5" /></>),
  farm: svg(<><path d="M12 22V9" /><path d="M12 13c-4 0-6-2-6-6 4 0 6 2 6 6zM12 17c4 0 6-2 6-6-4 0-6 2-6 6z" /></>),
  women: svg(<><circle cx="12" cy="8" r="5" /><path d="M12 13v8M9 18h6" /></>),
};

export default function Home() {
  const [lang] = useLang();
  const { profile } = useProfile();
  const matching = useMatchingResults();
  const eligible = matching ? matching.results.filter((r) => r.verdict === "eligible").length : -1;
  const stateName = profile.state ? optionLabel("state", profile.state, lang) : null;

  const tiles: { href: string; label: string; sub?: string; icon: ReactNode; strong?: boolean }[] = [
    {
      href: "/results",
      label: t("home.tileEligible", lang),
      sub: eligible >= 0 ? fmt(t("home.eligibleCount", lang), { n: eligible }) : t("home.eligibleNone", lang),
      icon: svg(<><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>),
      strong: eligible > 0,
    },
    { href: "/saved", label: t("home.tileSaved", lang), icon: svg(<path d="M6 3h12v18l-6-4-6 4z" />) },
    {
      href: "/offices",
      label: t("home.tileOffices", lang),
      icon: svg(<><path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>),
    },
  ];

  return (
    <div className="flex flex-col gap-7">
      <LanguageChooser />

      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
          {t("home.greeting", lang)}
          <span className="text-brand-600">.</span>
        </h1>
        <p className="text-lg text-ink-soft">{t("home.tagline", lang)}</p>
        {stateName ? (
          <p className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-paper-deep px-3 py-1 text-sm font-bold text-ink-soft">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" />
            </svg>
            {fmt(t("home.yourState", lang), { state: stateName })}
          </p>
        ) : null}
      </header>

      <VoiceCard />

      <nav aria-label={t("home.tileEligible", lang)} className="grid grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-[1.25rem] border p-3 text-center shadow-sm transition-shadow hover:shadow-md ${
              tile.strong ? "border-ok bg-ok-bg text-ink" : "border-line bg-white text-ink"
            }`}
          >
            <span className={tile.strong ? "text-ok" : "text-brand-700"}>{tile.icon}</span>
            <span className="text-base font-extrabold leading-tight">{tile.label}</span>
            {tile.sub ? <span className="text-sm font-semibold leading-tight text-ink-soft">{tile.sub}</span> : null}
          </Link>
        ))}
      </nav>

      <SuggestedSchemes />

      <section aria-labelledby="topics-title" className="flex flex-col gap-3">
        <div>
          <h2 id="topics-title" className="text-xl font-extrabold">
            {t("home.categories", lang)}
          </h2>
          <p className="text-base text-ink-soft">{t("home.topicsHint", lang)}</p>
        </div>
        <ul className="flex flex-wrap gap-2">
          {vocab.categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/chat?interest=${c.id}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-line bg-white px-4 text-base font-bold text-ink transition-colors hover:border-ink"
              >
                <span className="text-brand-700 [&_svg]:h-5 [&_svg]:w-5">{CATEGORY_ICONS[c.id]}</span>
                {lang === "hi" && c.hi ? c.hi : c.en}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
