"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";
import { saveBlob } from "@/lib/download";
import { fmt, t, useLang } from "@/lib/i18n";
import { clearLocalData, getProfile, useProfile } from "@/lib/profile";
import { optionLabel, vocab, fieldQuestion } from "@/lib/vocab";
import type { ProfileValue } from "@/lib/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { signInSheet, useSignedIn } from "@/components/SignInSheet";

const selectCls =
  "min-h-11 w-full rounded-xl border-2 border-line bg-white px-3 text-base font-semibold focus:border-ink";

export default function AccountPage() {
  const [lang, setLang] = useLang();
  const [signedIn, setSignedIn] = useSignedIn();
  const { profile, setField } = useProfile();
  const [phone, setPhone] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api
      .getMe()
      .then((me) => live && setPhone(me.phone))
      .catch((e) => {
        if (live && e instanceof api.ApiError && e.status === 401) {
          clearToken();
          setSignedIn(false);
        }
      });
    return () => {
      live = false;
    };
  }, [signedIn, setSignedIn]);

  async function signIn() {
    if (await signInSheet.open()) {
      setSignedIn(true);
    }
  }

  async function sync() {
    if (!getToken()) return;
    try {
      await api.putMe(getProfile(), lang);
      setNote({ tone: "ok", text: t("account.savedToAccount", lang) });
    } catch {
      setNote({ tone: "bad", text: t("account.saveFailed", lang) });
    }
  }

  function edit(field: string, raw: string) {
    let value: ProfileValue | undefined;
    if (raw !== "") {
      const type = vocab.fields[field].type;
      if (type === "integer") {
        const n = Number(raw);
        const { min = 0, max = 120 } = vocab.fields[field];
        if (!Number.isInteger(n) || n < min || n > max) return;
        value = n;
      } else if (type === "boolean") value = raw === "true";
      else value = raw;
    }
    setField(field, value);
    void sync();
  }

  function changeLang(l: "en" | "hi") {
    setLang(l);
    if (getToken()) api.putMe(getProfile(), l).catch(() => {});
  }

  async function exportData() {
    setBusy("export");
    setNote(null);
    try {
      const data = await api.exportMe();
      saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), t("account.exportFile", lang));
    } catch {
      setNote({ tone: "bad", text: t("errors.generic", lang) });
    } finally {
      setBusy(null);
    }
  }

  async function deleteAll() {
    setBusy("delete");
    setNote(null);
    try {
      await api.deleteMe();
      clearToken();
      clearLocalData();
      setSignedIn(false);
      setPhone(null);
      setConfirming(false);
      setNote({ tone: "ok", text: t("account.deleted", lang) });
    } catch (e) {
      setNote({ tone: "bad", text: e instanceof api.ApiError && e.status === 0 ? t("errors.network", lang) : t("errors.generic", lang) });
    } finally {
      setBusy(null);
    }
  }

  function signOut() {
    clearToken();
    setSignedIn(false);
    setPhone(null);
  }

  function signOutAndClear() {
    clearLocalData();
    signOut();
  }

  const fields = Object.keys(vocab.fields);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">{t("account.title", lang)}</h1>

      {note ? (
        <p
          role="status"
          className={`rounded-xl px-3 py-2 text-sm font-semibold ${note.tone === "ok" ? "bg-ok-bg text-ok" : "bg-bad-bg text-bad"}`}
        >
          {note.text}
        </p>
      ) : null}

      {signedIn === false ? (
        <Card tone="brand">
          <p className="text-base">{t("account.signedOutBody", lang)}</p>
          <Button className="mt-3 w-full sm:w-auto" onClick={signIn}>
            {t("account.signIn", lang)}
          </Button>
        </Card>
      ) : signedIn ? (
        <Card tone="ink" className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-paper/70">{t("account.signedInHeading", lang)}</p>
            <p className="text-lg font-bold">
              {phone ? fmt(t("account.signedInAs", lang), { phone }) : t("common.loading", lang)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={signOut}>
              {t("account.signOut", lang)}
            </Button>
            <Button variant="secondary" onClick={signOutAndClear}>
              {t("account.signOutClear", lang)}
            </Button>
          </div>
          <p className="w-full text-sm text-paper/70">{t("account.signOutKeepHint", lang)}</p>
        </Card>
      ) : null}

      <section aria-labelledby="lang-h" className="space-y-2">
        <h2 id="lang-h" className="text-lg font-extrabold">{t("common.language", lang)}</h2>
        <p className="text-sm text-ink-muted">{t("account.languageHint", lang)}</p>
        <div className="flex gap-2">
          {(["en", "hi"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => changeLang(l)}
              className={`min-h-11 flex-1 rounded-full border-2 px-4 text-base font-bold ${
                lang === l ? "border-ink bg-ink text-paper" : "border-line bg-white hover:border-ink"
              }`}
            >
              {t(l === "en" ? "common.english" : "common.hindi", lang)}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="profile-h" className="space-y-2">
        <h2 id="profile-h" className="text-lg font-extrabold">{t("account.profile", lang)}</h2>
        <p className="text-sm text-ink-muted">{t("account.profileHint", lang)}</p>
        <ul className="space-y-3">
          {fields.map((field) => {
            const f = vocab.fields[field];
            const v = profile[field as keyof typeof profile];
            const id = `pf-${field}`;
            return (
              <li key={field} className="rounded-2xl border border-line bg-white p-3">
                <label htmlFor={id} className="mb-1.5 block text-sm font-bold text-ink-soft">
                  {fieldQuestion(field, lang)}
                </label>
                {f.type === "integer" ? (
                  <input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={f.min}
                    max={f.max}
                    step={1}
                    placeholder={t("account.notAnswered", lang)}
                    value={typeof v === "number" ? v : ""}
                    onChange={(e) => edit(field, e.target.value)}
                    className={selectCls}
                  />
                ) : (
                  <select
                    id={id}
                    value={v === undefined ? "" : String(v)}
                    onChange={(e) => edit(field, e.target.value)}
                    className={selectCls}
                  >
                    <option value="">{t("account.notAnswered", lang)}</option>
                    {f.type === "boolean" ? (
                      <>
                        <option value="true">{t("common.yes", lang)}</option>
                        <option value="false">{t("common.no", lang)}</option>
                      </>
                    ) : (
                      f.options?.map((o) => (
                        <option key={o.id} value={o.id}>
                          {optionLabel(field, o.id, lang)}
                        </option>
                      ))
                    )}
                  </select>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {signedIn ? (
        <section aria-labelledby="data-h" className="space-y-3">
          <h2 id="data-h" className="text-lg font-extrabold">{t("account.privacy", lang)}</h2>
          <p className="text-sm text-ink-muted">{t("account.privacyBody", lang)}</p>
          <Button variant="secondary" className="w-full" onClick={exportData} disabled={busy !== null}>
            {busy === "export" ? t("account.exporting", lang) : t("account.export", lang)}
          </Button>
          {confirming ? (
            <div role="alertdialog" aria-label={t("account.delete", lang)} className="rounded-2xl border-2 border-bad bg-bad-bg p-4">
              <p className="text-base font-semibold text-bad">{t("account.deleteConfirm", lang)}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={deleteAll}
                  disabled={busy !== null}
                  className="min-h-11 rounded-full bg-bad px-5 py-2.5 text-base font-bold text-white disabled:opacity-50"
                >
                  {busy === "delete" ? t("account.deleting", lang) : t("account.deleteYes", lang)}
                </button>
                <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy !== null}>
                  {t("account.keep", lang)}
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="min-h-11 w-full rounded-full border-2 border-bad px-5 py-2.5 text-base font-bold text-bad hover:bg-bad-bg"
            >
              {t("account.delete", lang)}
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
}
