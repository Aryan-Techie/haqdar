"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as api from "@/lib/api";
import { fmt, t, useLang } from "@/lib/i18n";
import { useResults } from "@/lib/results";
import type { Scheme } from "@/lib/types";
import { SchemeCard } from "@/components/SchemeCard";

const DEBOUNCE_MS = 300;

function SearchView() {
  const [lang] = useLang();
  const initial = useSearchParams().get("q") ?? "";
  const [q, setQ] = useState(initial);
  const [hits, setHits] = useState<Scheme[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const seq = useRef(0);
  const { results: stored } = useResults();

  useEffect(() => {
    const query = q.trim();
    const mine = ++seq.current;
    if (!query) {
      // Clearing the box resets the list; deferred so it is not a synchronous setState in the effect.
      const id = setTimeout(() => {
        if (seq.current === mine) {
          setHits(null);
          setBusy(false);
          setError(false);
        }
      }, 0);
      return () => clearTimeout(id);
    }
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const [ids, all] = await Promise.all([api.search(query), api.getSchemes()]);
        if (seq.current !== mine) return;
        const byId = new Map(all.map((s) => [s.id, s]));
        setHits(ids.map((i) => byId.get(i)).filter((s): s is Scheme => !!s));
        setError(false);
      } catch {
        if (seq.current === mine) setError(true);
      } finally {
        if (seq.current === mine) setBusy(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">{t("search.title", lang)}</h1>
      <div className="relative">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          type="search"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search.placeholder", lang)}
          aria-label={t("common.search", lang)}
          className="min-h-14 w-full rounded-full border-2 border-ink bg-white pl-12 pr-4 text-lg placeholder:text-ink-muted"
        />
      </div>

      <div aria-live="polite" className="flex flex-col gap-3">
        {error ? (
          <p className="font-semibold text-bad">{t("search.error", lang)}</p>
        ) : busy && !hits ? (
          <p className="text-ink-soft">{t("common.loading", lang)}</p>
        ) : hits === null ? (
          <p className="text-ink-soft">{t("search.hint", lang)}</p>
        ) : hits.length === 0 ? (
          <p className="py-6 text-center text-ink-soft">{t("search.noResults", lang)}</p>
        ) : (
          <>
            <p className="text-sm font-semibold text-ink-muted">{fmt(t("search.count", lang), { n: hits.length })}</p>
            {hits.map((s) => (
              <SchemeCard key={s.id} scheme={s} result={stored?.results.find((r) => r.scheme_id === s.id)} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchView />
    </Suspense>
  );
}
