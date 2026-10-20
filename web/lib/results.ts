"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import * as api from "@/lib/api";
import { fmt, t } from "@/lib/i18n";
import { useProfile } from "@/lib/profile";
import { profileFieldFor, vocab } from "@/lib/vocab";
import type { EvaluateResponse, LangCode, Pred, Profile, Result } from "@/lib/types";

export const RESULTS_KEY = "haqdar:results";

/** An evaluation plus the profile (and vocabulary version) that produced it, so staleness can be detected. */
export interface StoredResults extends EvaluateResponse {
  profile: Profile;
  interests: string[];
  vocab_version: string;
}

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

function readRaw(): string | null {
  try {
    return sessionStorage.getItem(RESULTS_KEY);
  } catch {
    return null;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Validates the stored shape; anything old or malformed is dropped (returns null) rather than crashing the page. */
export function parseResults(raw: string | null): StoredResults | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (!isObject(d) || !Array.isArray(d.results) || !Array.isArray(d.next_fields)) return null;
    if (!isObject(d.coverage) || typeof d.coverage.has_state_schemes !== "boolean") return null;
    if (!isObject(d.profile) || typeof d.vocab_version !== "string") return null;
    return {
      results: d.results as Result[],
      next_fields: d.next_fields as string[],
      coverage: d.coverage as EvaluateResponse["coverage"],
      profile: d.profile as Profile,
      interests: Array.isArray(d.interests) ? (d.interests as string[]) : [],
      vocab_version: d.vocab_version,
    };
  } catch {
    return null;
  }
}

/** Save an evaluation together with the profile that produced it. */
export function saveResults(response: EvaluateResponse, profile: Profile, interests: string[] = []): void {
  const value: StoredResults = { ...response, profile: { ...profile }, interests, vocab_version: vocab.version };
  try {
    sessionStorage.setItem(RESULTS_KEY, JSON.stringify(value));
  } catch {
    /* storage unavailable: /results recomputes from the profile */
  }
  listeners.forEach((l) => l());
}

const profileKey = (p: Profile) =>
  JSON.stringify(Object.entries(p).filter(([, v]) => v !== undefined && v !== null).sort(([a], [b]) => (a < b ? -1 : 1)));

/** Deep-equal on the answered fields, ignoring key order. */
export function sameProfile(a: Profile, b: Profile): boolean {
  return profileKey(a) === profileKey(b);
}

/** The stored evaluation only when it was produced by the current profile and vocabulary; never triggers a request. */
export function useMatchingResults(): StoredResults | null {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const { profile } = useProfile();
  const stored = useMemo(() => parseResults(raw), [raw]);
  return stored && stored.vocab_version === vocab.version && sameProfile(stored.profile, profile) ? stored : null;
}

const inflight = new Map<string, Promise<void>>();

function recompute(profile: Profile, interests: string[]): Promise<void> {
  const key = profileKey(profile) + "|" + interests.join(",");
  let p = inflight.get(key);
  if (!p) {
    p = api
      .evaluate(profile, interests.length ? interests : undefined)
      .then((r) => saveResults(r, profile, interests))
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

export type ResultsStatus = "ready" | "loading" | "none" | "error";

/**
 * Results for the current profile. When the stored evaluation is stale (the profile changed since), it is recomputed
 * automatically; consumers never see a stale evaluation. `none` means there is nothing to evaluate (empty profile).
 */
export function useResults(): { results: StoredResults | null; status: ResultsStatus; retry: () => void } {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const { profile } = useProfile();
  const fresh = useMatchingResults();
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const nonEmpty = Object.keys(profile).length > 0;
  const key = `${profileKey(profile)}#${attempt}`;
  const interests = useMemo(() => parseResults(raw)?.interests ?? [], [raw]);

  useEffect(() => {
    if (fresh || !nonEmpty || failed === key) return;
    let live = true;
    recompute(profile, interests).catch(() => {
      if (live) setFailed(key);
    });
    return () => {
      live = false;
    };
  }, [fresh, nonEmpty, failed, key, profile, interests]);

  const status: ResultsStatus = fresh ? "ready" : !nonEmpty ? "none" : failed === key ? "error" : "loading";
  return { results: fresh, status, retry: () => setAttempt((n) => n + 1) };
}

const noop = () => () => {};

/** True once we are on the client (sessionStorage readable); avoids flashing the empty state during hydration. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

/** Localised, de-duplicated field names for predicates or profile fields. */
export function fieldNames(fields: string[], lang: LangCode): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of fields) {
    const pf = profileFieldFor(f);
    if (seen.has(pf)) continue;
    seen.add(pf);
    const key = `fieldName.${pf}`;
    const label = t(key, lang);
    out.push(label === key ? pf : label);
  }
  return out.join(", ");
}

const preds = (p: Pred[]) => p.map((x) => x.field);

/** One sentence per polarity: plain predicates ("Matches your ...") and negated ones ("Not excluded by ..."). */
function predLine(list: Pred[], plainKey: string, negatedKey: string, lang: LangCode): string[] {
  const plain = list.filter((p) => !p.negated);
  const negated = list.filter((p) => p.negated);
  const out: string[] = [];
  if (plain.length) out.push(fmt(t(plainKey, lang), { fields: fieldNames(preds(plain), lang) }));
  if (negated.length) out.push(fmt(t(negatedKey, lang), { fields: fieldNames(preds(negated), lang) }));
  return out;
}

/** Plain one-line reason for a result, in the user's language. */
export function whyLine(result: Result, lang: LangCode): string {
  if (result.verdict === "maybe") {
    return fmt(t("results.missing", lang), { fields: fieldNames(result.unknown_fields, lang) });
  }
  if (result.verdict === "eligible") {
    return result.passed.length
      ? predLine(result.passed, "results.whyPassed", "results.whyPassedNot", lang).join("; ")
      : t("results.whyAll", lang);
  }
  if (result.reason.code === "state_unavailable") return t("results.whyStateUnavailable", lang);
  return result.failed.length
    ? predLine(result.failed, "results.whyFailed", "results.whyFailedNot", lang).join("; ")
    : t("results.whyFailed", lang).replace(/:?\s*\{fields\}/, "");
}

export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function formatDate(iso: string, lang: LangCode): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}
