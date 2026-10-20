"use client";

import Link from "next/link";
import { t, useLang } from "@/lib/i18n";
import type { LangCode } from "@/lib/types";

const LANGS: { code: LangCode; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "hi", label: "हिं" },
];

export function TopStrip({ city }: { city?: string | null }) {
  const [lang, setLang] = useLang();
  return (
    <header className="sticky top-0 z-30 bg-ink text-paper">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2">
        <Link href="/" className="flex min-h-11 items-center gap-2 text-xl font-extrabold tracking-tight" aria-label={t("app.name", lang)}>
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-lg text-ink">ह</span>
          {t("app.name", lang)}
        </Link>
        {city ? (
          <span className="ml-1 truncate rounded-full bg-ink-soft px-3 py-1 text-sm text-paper" title={t("common.city", lang)}>
            {city}
          </span>
        ) : null}
        <div role="group" aria-label={t("common.language", lang)} className="ml-auto flex overflow-hidden rounded-full border-2 border-paper/40">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              aria-pressed={lang === l.code}
              onClick={() => setLang(l.code)}
              className={`min-h-11 min-w-11 px-3 text-base font-bold transition-colors ${
                lang === l.code ? "bg-brand text-ink" : "bg-transparent text-paper hover:bg-ink-soft"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
