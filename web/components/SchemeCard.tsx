"use client";

import Link from "next/link";
import { fmt, localize, t, useLang } from "@/lib/i18n";
import { sourceHost, whyLine } from "@/lib/results";
import { categoryLabel } from "@/lib/vocab";
import type { Result, Scheme } from "@/lib/types";
import { VerdictChip } from "./VerdictChip";

interface Props {
  scheme: Scheme;
  result?: Result;
  saved?: boolean;
  onSave?: (scheme: Scheme) => void;
}

export function SchemeCard({ scheme, result, saved = false, onSave }: Props) {
  const [lang] = useLang();
  const name = localize(scheme.name, lang);
  const why = result ? whyLine(result, lang) : null;
  return (
    <article data-testid="scheme-card" data-verdict={result?.verdict} className="relative rounded-[1.25rem] border border-line bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={`/schemes/${scheme.id}`}
        className={`block rounded-[1.25rem] p-4 ${onSave ? "pr-16" : ""}`}
        aria-label={name}
      >
        <div className="flex flex-wrap items-center gap-2">
          {result ? (
            <VerdictChip verdict={result.verdict} />
          ) : (
            <span className="rounded-full bg-paper-deep px-3 py-1 text-sm font-semibold text-ink-soft">
              {categoryLabel(scheme.category, lang)}
            </span>
          )}
          {scheme.verification.status !== "hand_verified" ? (
            <span className="rounded-full border border-dashed border-ink-muted px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
              {t("detail.verificationPending", lang)}
            </span>
          ) : null}
        </div>
        <h3 className="mt-2 text-lg font-extrabold leading-snug">{name}</h3>
        <p className="mt-1 text-base text-ink-soft">{localize(scheme.benefit, lang)}</p>
        {why ? (
          <p className="mt-3 border-t border-line pt-2.5 text-sm font-semibold text-ink">
            <span className="mr-1.5 text-ink-muted">{t("results.why", lang)}:</span>
            {why}
          </p>
        ) : null}
        <p className="mt-2 text-xs font-semibold text-ink-muted">
          {t("results.source", lang)}: {sourceHost(scheme.source_url)}
        </p>
      </Link>
      {onSave ? (
        <button
          type="button"
          onClick={() => onSave(scheme)}
          aria-pressed={saved}
          aria-label={fmt(t(saved ? "results.unsaveNamed" : "results.saveNamed", lang), { name })}
          className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full text-ink hover:bg-paper-deep"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
            <path d="M6 3h12v18l-6-4-6 4z" />
          </svg>
        </button>
      ) : null}
    </article>
  );
}
