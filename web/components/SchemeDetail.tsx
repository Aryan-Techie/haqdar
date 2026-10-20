"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { getToken } from "@/lib/auth";
import { fmt, localize, t, useLang } from "@/lib/i18n";
import { fieldNames, formatDate } from "@/lib/results";
import { categoryLabel } from "@/lib/vocab";
import type { Result, Scheme } from "@/lib/types";
import { signInSheet } from "@/components/SignInSheet";
import { Accordion } from "./Accordion";
import { Button } from "./Button";
import { DocChecklist } from "./DocChecklist";
import { SourceLink } from "./SourceLink";

function Banner({ result }: { result?: Result }) {
  const [lang] = useLang();
  const base = "flex gap-3 rounded-[1.25rem] border-2 p-4";
  const icon = (d: string) => (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 shrink-0">
      <path d={d} />
    </svg>
  );
  if (!result) {
    return (
      <div role="status" className={`${base} border-line bg-paper-deep`}>
        {icon("M12 8v5M12 16.5v.1M12 3a9 9 0 100 18 9 9 0 000-18z")}
        <div>
          <p className="text-lg font-extrabold">{t("detail.bannerNeutral", lang)}</p>
          <p className="text-ink-soft">{t("detail.bannerNeutralHint", lang)}</p>
          <Button href="/chat" variant="secondary" className="mt-3">
            {t("detail.bannerNeutralCta", lang)}
          </Button>
        </div>
      </div>
    );
  }
  if (result.verdict === "eligible") {
    return (
      <div role="status" data-verdict="eligible" className={`${base} border-ok bg-ok-bg text-ok`}>
        {icon("M5 12.5l4.5 4.5L19 7.5")}
        <p className="text-lg font-extrabold">{t("detail.bannerEligible", lang)}</p>
      </div>
    );
  }
  if (result.verdict === "maybe") {
    return (
      <div role="status" data-verdict="maybe" className={`${base} border-dashed border-warn bg-warn-bg text-warn`}>
        {icon("M9.5 9a2.5 2.5 0 114 2c-.9.7-1.5 1.2-1.5 2.3M12 17.2v.1")}
        <div>
          <p className="text-lg font-extrabold">
            {fmt(t("detail.bannerMaybe", lang), { fields: fieldNames(result.unknown_fields, lang) })}
          </p>
          <Button href="/chat" variant="secondary" className="mt-3">
            {t("detail.bannerNeutralCta", lang)}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div role="status" data-verdict="ineligible" className={`${base} border-bad bg-bad-bg text-bad`}>
      {icon("M7 7l10 10M17 7L7 17")}
      <p className="text-lg font-extrabold">{t("detail.bannerIneligible", lang)}</p>
    </div>
  );
}

/** mailto: with no recipient (the user picks one), carrying what a reviewer needs to find the record. */
export function reportProblemHref(scheme: Scheme): string {
  const subject = `Haqdar: problem with ${scheme.name.en} (${scheme.id})`;
  const body = [
    "Please describe what looks wrong:",
    "",
    "",
    "---",
    `Scheme id: ${scheme.id}`,
    `Scheme name: ${scheme.name.en}`,
    `Source: ${scheme.source_url}`,
    `Last verified: ${scheme.last_verified}`,
  ].join("\n");
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function SchemeDetail({ scheme, result }: { scheme: Scheme; result?: Result }) {
  const [lang] = useLang();
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const name = localize(scheme.name, lang);

  useEffect(() => {
    if (!getToken()) return;
    let live = true;
    api.getSaved().then((ids) => live && setSaved(ids.includes(scheme.id))).catch(() => {});
    return () => {
      live = false;
    };
  }, [scheme.id]);

  async function toggleSave() {
    setNote(null);
    try {
      if (!getToken()) {
        const ok = await signInSheet.open();
        if (!ok || !getToken()) return;
      }
      if (saved) await api.unsaveScheme(scheme.id);
      else await api.saveScheme(scheme.id);
      setSaved(!saved);
    } catch {
      setNote(t("detail.saveFailed", lang));
    }
  }

  async function share() {
    setNote(null);
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: name, text: localize(scheme.benefit, lang), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote(t("detail.linkCopied", lang));
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setNote(t("detail.shareFailed", lang));
    }
  }

  const plain = scheme.eligibility_plain;
  const eligibility = (lang === "hi" && plain.hi?.length ? plain.hi : plain.en) ?? [];
  const steps = scheme.how_to_apply;
  const howTo = (lang === "hi" && steps.hi?.length ? steps.hi : steps.en) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">{categoryLabel(scheme.category, lang)}</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight">{name}</h1>
        <p className="mt-2 rounded-2xl bg-brand-100 p-3 text-lg font-semibold text-ink">
          <span className="sr-only">{t("detail.benefit", lang)}: </span>
          {localize(scheme.benefit, lang)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={share}>
            {t("common.share", lang)}
          </Button>
          <Button variant="secondary" onClick={toggleSave} aria-pressed={saved}>
            {t(saved ? "common.saved" : "common.save", lang)}
          </Button>
          {scheme.verification.status !== "hand_verified" ? (
            <span className="inline-flex min-h-11 items-center rounded-full border-2 border-dashed border-ink-muted px-3 text-sm font-bold text-ink-soft">
              {t("detail.verificationPending", lang)}
            </span>
          ) : null}
        </div>
        <p role="status" className="min-h-6 text-sm font-semibold text-ink-soft">
          {note}
        </p>
      </header>

      <Banner result={result} />

      <Accordion title={t("detail.about", lang)} defaultOpen>
        <p>{localize(scheme.description, lang)}</p>
      </Accordion>
      <Accordion title={t("detail.whoCanApply", lang)} defaultOpen>
        <ul className="list-disc space-y-1.5 pl-5">
          {eligibility.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </Accordion>
      <Accordion title={t("detail.documents", lang)}>
        <DocChecklist documents={scheme.documents} />
      </Accordion>
      <Accordion title={t("detail.howToApply", lang)}>
        <ol className="list-decimal space-y-1.5 pl-5">
          {howTo.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
        {scheme.apply_url ? (
          <Button href={scheme.apply_url} variant="primary" className="mt-4">
            {t("detail.applyOnline", lang)}
          </Button>
        ) : null}
      </Accordion>

      <section className="rounded-[1.25rem] border border-line bg-white p-4">
        <h2 className="text-lg font-bold">{t("detail.deadline", lang)}</h2>
        {scheme.deadline ? (
          <>
            <p className="text-lg font-semibold">{formatDate(scheme.deadline, lang)}</p>
            <Button href={`/kit/${scheme.id}`} variant="ghost" className="-ml-3 mt-1">
              {t("kit.addReminder", lang)}
            </Button>
          </>
        ) : (
          <p className="text-ink-soft">{t("detail.noDeadline", lang)}</p>
        )}
      </section>

      <section className="rounded-[1.25rem] border border-line bg-white p-4">
        <h2 className="text-lg font-bold">{t("detail.officialSource", lang)}</h2>
        <SourceLink url={scheme.source_url} lastVerified={scheme.last_verified} />
        {scheme.verification.status !== "hand_verified" ? (
          <p className="mt-2 text-sm text-ink-soft">{t("detail.pendingHint", lang)}</p>
        ) : null}
        <a
          href={reportProblemHref(scheme)}
          className="mt-1 inline-flex min-h-11 items-center font-bold underline decoration-2 underline-offset-4"
        >
          {t("detail.reportProblem", lang)}
        </a>
      </section>

      <Button href={`/kit/${scheme.id}`} className="w-full text-lg">
        {t("detail.getKit", lang)}
      </Button>
    </div>
  );
}
