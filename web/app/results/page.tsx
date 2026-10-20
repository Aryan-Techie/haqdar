"use client";

import { useEffect, useMemo, useState } from "react";
import * as api from "@/lib/api";
import { fmt, t, useLang } from "@/lib/i18n";
import { extraQuestions } from "@/lib/chat/flow";
import { getAsked } from "@/lib/profile";
import { useHydrated, useResults } from "@/lib/results";
import { optionLabel } from "@/lib/vocab";
import type { Scheme, Verdict } from "@/lib/types";
import { Button } from "@/components/Button";
import { SchemeCard } from "@/components/SchemeCard";

type Tab = "eligible" | "maybe" | "other";
const TABS: { id: Tab; key: string; empty: string }[] = [
  { id: "eligible", key: "results.tabEligible", empty: "results.emptyEligible" },
  { id: "maybe", key: "results.tabMaybe", empty: "results.emptyMaybe" },
  { id: "other", key: "results.tabOther", empty: "results.emptyOther" },
];
const tabOf = (v: Verdict): Tab => (v === "ineligible" ? "other" : v);

export default function ResultsPage() {
  const [lang] = useLang();
  const hydrated = useHydrated();
  const { results: stored, status, retry: retryResults } = useResults();
  const [schemes, setSchemes] = useState<Scheme[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<Tab | null>(null);

  useEffect(() => {
    let live = true;
    api
      .getSchemes()
      .then((s) => live && setSchemes(s))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [attempt]);

  const grouped = useMemo(() => {
    const byId = new Map((schemes ?? []).map((s) => [s.id, s]));
    const g: Record<Tab, { scheme: Scheme; result: NonNullable<typeof stored>["results"][number] }[]> = {
      eligible: [],
      maybe: [],
      other: [],
    };
    for (const r of stored?.results ?? []) {
      const scheme = byId.get(r.scheme_id);
      if (scheme) g[tabOf(r.verdict)].push({ scheme, result: r });
    }
    return g;
  }, [schemes, stored]);

  if (!hydrated) return null;

  if (!stored && status !== "none") {
    return (
      <div className="flex flex-col items-start gap-3 py-10">
        {status === "error" ? (
          <>
            <p className="font-semibold">{t("results.updateError", lang)}</p>
            <Button onClick={retryResults}>{t("common.retry", lang)}</Button>
          </>
        ) : (
          <p role="status" className="flex items-center gap-2 font-semibold">
            <span aria-hidden className="h-3 w-3 animate-pulse rounded-full bg-brand" />
            {t("results.updating", lang)}
          </p>
        )}
      </div>
    );
  }

  if (!stored) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">{t("results.emptyTitle", lang)}</h1>
        <p className="max-w-sm text-ink-soft">{t("results.noResults", lang)}</p>
        <Button href="/chat">{t("results.startChat", lang)}</Button>
      </div>
    );
  }

  const active: Tab = tab ?? (grouped.eligible.length ? "eligible" : grouped.maybe.length ? "maybe" : "eligible");
  const found = grouped.eligible.length + grouped.maybe.length;
  const more = extraQuestions(stored.profile, stored.next_fields, getAsked()).length;
  const state = stored.coverage.state;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-extrabold">{t("results.title", lang)}</h1>
        {schemes ? <p className="text-ink-soft">{fmt(t("results.countFound", lang), { n: found })}</p> : null}
      </header>

      {!stored.coverage.has_state_schemes && state ? (
        <p role="note" className="rounded-2xl border-2 border-brand-300 bg-brand-50 p-3 font-semibold">
          {fmt(t("results.stateNotice", lang), { state: optionLabel("state", state, lang) })}
        </p>
      ) : null}

      {more > 0 ? (
        <Button href="/chat?extras=1" variant="secondary" className="w-full">
          {t(more === 1 ? "results.answerOne" : "results.answerN", lang).replace("{n}", String(more))}
        </Button>
      ) : null}

      <div role="tablist" aria-label={t("results.tabsLabel", lang)} className="grid grid-cols-3 gap-1 rounded-full bg-paper-deep p-1">
        {TABS.map((tb) => {
          const on = active === tb.id;
          return (
            <button
              key={tb.id}
              role="tab"
              id={`tab-${tb.id}`}
              aria-selected={on}
              aria-controls="results-panel"
              onClick={() => setTab(tb.id)}
              className={`min-h-11 rounded-full px-2 text-base font-bold transition-colors ${on ? "bg-ink text-paper" : "text-ink hover:bg-white"}`}
            >
              {t(tb.key, lang)} <span className="tabular-nums opacity-80">({grouped[tb.id].length})</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="results-panel" aria-labelledby={`tab-${active}`} className="flex flex-col gap-3">
        {failed ? (
          <div className="flex flex-col items-start gap-3">
            <p className="font-semibold">{t("results.loadError", lang)}</p>
            <Button
              onClick={() => {
                setFailed(false);
                setAttempt((n) => n + 1);
              }}
            >
              {t("common.retry", lang)}
            </Button>
          </div>
        ) : !schemes ? (
          [0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-[1.25rem] bg-paper-deep" />)
        ) : grouped[active].length ? (
          grouped[active].map(({ scheme, result }) => <SchemeCard key={scheme.id} scheme={scheme} result={result} />)
        ) : (
          <p className="py-6 text-center text-ink-soft">{t(TABS.find((x) => x.id === active)!.empty, lang)}</p>
        )}
      </div>
    </div>
  );
}
