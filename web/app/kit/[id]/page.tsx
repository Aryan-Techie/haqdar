"use client";

import { use, useEffect, useState } from "react";
import * as api from "@/lib/api";
import { clearToken } from "@/lib/auth";
import { saveBlob } from "@/lib/download";
import { fmt, localize, t, useLang } from "@/lib/i18n";
import type { Scheme } from "@/lib/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { signInSheet, useSignedIn } from "@/components/SignInSheet";

const tickKey = (id: string) => `haqdar:kit:${id}`;

function readTicks(id: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(tickKey(id)) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeTicks(id: string, ticks: string[]) {
  try {
    localStorage.setItem(tickKey(id), JSON.stringify(ticks));
  } catch {
    /* storage unavailable: ticks last for this visit only */
  }
}

export default function KitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lang] = useLang();
  const [signedIn, setSignedIn] = useSignedIn();
  const [scheme, setScheme] = useState<Scheme | null | "missing">(null);
  const [ticks, setTicks] = useState<string[]>([]);
  const [busy, setBusy] = useState<"kit" | "ics" | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  useEffect(() => {
    // Ticks live in localStorage, readable only after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTicks(readTicks(id));
    let live = true;
    api
      .getScheme(id)
      .then((s) => live && setScheme(s))
      .catch(() => live && setScheme("missing"));
    return () => {
      live = false;
    };
  }, [id]);

  function toggle(key: string) {
    const next = ticks.includes(key) ? ticks.filter((k) => k !== key) : [...ticks, key];
    setTicks(next);
    writeTicks(id, next);
  }

  async function signIn() {
    if (await signInSheet.open()) setSignedIn(true);
  }

  async function run(kind: "kit" | "ics") {
    setBusy(kind);
    setNote(null);
    try {
      if (kind === "kit") {
        saveBlob(await api.downloadKit(id, lang), `${t("kit.sheetFile", lang).replace(".pdf", "")}-${id}.pdf`);
        setNote({ tone: "ok", text: t("kit.downloaded", lang) });
      } else {
        saveBlob(await api.downloadIcs(id), `${t("kit.reminderFile", lang).replace(".ics", "")}-${id}.ics`);
        setNote({ tone: "ok", text: t("kit.reminderAdded", lang) });
      }
    } catch (e) {
      if (e instanceof api.ApiError && e.status === 401) {
        clearToken();
        setSignedIn(false);
      } else {
        setNote({ tone: "bad", text: t(e instanceof api.ApiError && e.status === 0 ? "errors.network" : "errors.generic", lang) });
      }
    } finally {
      setBusy(null);
    }
  }

  if (scheme === "missing") {
    return (
      <div className="space-y-3">
        <p role="alert" className="font-semibold text-bad">{t("kit.notFound", lang)}</p>
        <Button href="/saved" variant="secondary">{t("saved.title", lang)}</Button>
      </div>
    );
  }
  if (scheme === null || signedIn === null) {
    return <p role="status" className="text-ink-muted">{t("common.loading", lang)}</p>;
  }

  const name = localize(scheme.name, lang);
  const done = scheme.documents.filter((d, i) => ticks.includes(docKey(d.name.en, i))).length;
  const steps = scheme.how_to_apply;
  const stepList = lang === "hi" && steps.hi?.length ? steps.hi : steps.en;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">{t("kit.title", lang)}</h1>
        <p className="mt-1 text-base font-semibold text-ink-soft">{fmt(t("kit.forScheme", lang), { name })}</p>
      </div>

      {signedIn === false ? (
        <Card tone="brand">
          <p className="text-base">{t("kit.signInPrompt", lang)}</p>
          <Button className="mt-3" onClick={signIn}>{t("kit.signIn", lang)}</Button>
        </Card>
      ) : null}

      <section aria-labelledby="kit-docs" className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="kit-docs" className="text-lg font-extrabold">{t("kit.checklist", lang)}</h2>
          {scheme.documents.length ? (
            <span className="text-sm font-bold text-ink-muted" aria-live="polite">
              {fmt(t("kit.progress", lang), { done, total: scheme.documents.length })}
            </span>
          ) : null}
        </div>
        {scheme.documents.length ? (
          <>
            <p className="text-sm text-ink-muted">{t("kit.tickHint", lang)}</p>
            <ul className="space-y-2">
              {scheme.documents.map((d, i) => {
                const key = docKey(d.name.en, i);
                const on = ticks.includes(key);
                return (
                  <li key={key}>
                    <label className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border-2 p-3 ${on ? "border-ok bg-ok-bg" : "border-line bg-white"}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(key)}
                        className="mt-0.5 h-6 w-6 shrink-0 accent-brand-600"
                      />
                      <span className="min-w-0">
                        <span className={`block text-base font-bold ${on ? "line-through decoration-2" : ""}`}>{localize(d.name, lang)}</span>
                        <span className="block text-xs font-semibold text-ink-muted">
                          {t(d.required ? "detail.mustHave" : "detail.ifApplicable", lang)}
                        </span>
                        {d.note ? <span className="block text-sm text-ink-soft">{localize(d.note, lang)}</span> : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="text-ink-muted">{t("kit.noDocuments", lang)}</p>
        )}
      </section>

      {stepList.length ? (
        <section aria-labelledby="kit-steps" className="space-y-2">
          <h2 id="kit-steps" className="text-lg font-extrabold">{t("kit.steps", lang)}</h2>
          <ol className="list-decimal space-y-1.5 pl-6 text-base">
            {stepList.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </section>
      ) : null}

      {scheme.deadline ? (
        <p className="rounded-xl bg-warn-bg px-3 py-2 text-sm font-bold text-warn">
          {fmt(t("kit.deadline", lang), { date: scheme.deadline })}
        </p>
      ) : null}

      <section className="space-y-3">
        {note ? (
          <p role="status" className={`rounded-xl px-3 py-2 text-sm font-semibold ${note.tone === "ok" ? "bg-ok-bg text-ok" : "bg-bad-bg text-bad"}`}>
            {note.text}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button onClick={() => (signedIn ? run("kit") : signIn())} disabled={busy !== null}>
            {busy === "kit" ? t("kit.preparing", lang) : t("kit.download", lang)}
          </Button>
          {scheme.deadline ? (
            <Button variant="secondary" onClick={() => (signedIn ? run("ics") : signIn())} disabled={busy !== null}>
              {busy === "ics" ? t("kit.preparing", lang) : t("kit.addReminder", lang)}
            </Button>
          ) : null}
          <Button variant="secondary" href="/offices">{t("kit.nearestOffice", lang)}</Button>
        </div>
        <p className="text-sm text-ink-muted">{t("kit.disclaimer", lang)} {t("kit.notOfficial", lang)}</p>
      </section>
    </div>
  );
}

function docKey(nameEn: string, index: number): string {
  return `${index}:${nameEn}`;
}
