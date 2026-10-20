"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as api from "@/lib/api";
import { clearToken } from "@/lib/auth";
import { fmt, localize, t, useLang } from "@/lib/i18n";
import { categoryLabel } from "@/lib/vocab";
import type { Scheme } from "@/lib/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { signInSheet, useSignedIn } from "@/components/SignInSheet";

type Load = { state: "loading" } | { state: "error"; text: string } | { state: "ready"; schemes: Scheme[] };

export default function SavedPage() {
  const [lang] = useLang();
  const [signedIn, setSignedIn] = useSignedIn();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [q, setQ] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    Promise.all([api.getSaved(), api.getSchemes()])
      .then(([ids, all]) => {
        if (!live) return;
        const byId = new Map(all.map((s) => [s.id, s]));
        setLoad({ state: "ready", schemes: ids.flatMap((id) => byId.get(id) ?? []) });
      })
      .catch((e) => {
        if (!live) return;
        if (e instanceof api.ApiError && e.status === 401) {
          clearToken();
          setSignedIn(false);
          return;
        }
        setLoad({ state: "error", text: e instanceof api.ApiError && e.status === 0 ? "errors.network" : "errors.generic" });
      });
    return () => {
      live = false;
    };
  }, [signedIn, attempt, setSignedIn]);

  const shown = useMemo(() => {
    if (load.state !== "ready") return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return load.schemes;
    return load.schemes.filter((s) =>
      [s.name.en, s.name.hi ?? "", s.benefit.en, s.benefit.hi ?? "", ...(s.tags ?? [])].some((x) => x.toLowerCase().includes(needle)),
    );
  }, [load, q]);

  async function remove(id: string) {
    if (load.state !== "ready") return;
    const before = load;
    setLoad({ state: "ready", schemes: load.schemes.filter((s) => s.id !== id) });
    try {
      await api.unsaveScheme(id);
    } catch {
      setLoad(before);
    }
  }

  async function signIn() {
    if (await signInSheet.open()) {
      setLoad({ state: "loading" });
      setSignedIn(true);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">{t("saved.title", lang)}</h1>

      {signedIn === false ? (
        <Card tone="brand">
          <p className="text-base">{t("saved.signInPrompt", lang)}</p>
          <Button className="mt-3" onClick={signIn}>
            {t("saved.signIn", lang)}
          </Button>
        </Card>
      ) : signedIn === null || load.state === "loading" ? (
        <p role="status" className="text-ink-muted">{t("common.loading", lang)}</p>
      ) : load.state === "error" ? (
        <Card tone="paper">
          <p role="alert" className="font-semibold text-bad">{t(load.text, lang)}</p>
          <Button variant="secondary" className="mt-3" onClick={() => { setLoad({ state: "loading" }); setAttempt((n) => n + 1); }}>
            {t("common.retry", lang)}
          </Button>
        </Card>
      ) : load.schemes.length === 0 ? (
        <Card tone="paper">
          <p className="text-base">{t("saved.empty", lang)}</p>
          <Button href="/" className="mt-3">{t("nav.home", lang)}</Button>
        </Card>
      ) : (
        <>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("saved.searchPlaceholder", lang)}
            aria-label={t("saved.searchPlaceholder", lang)}
            className="min-h-12 w-full rounded-xl border-2 border-line bg-white px-4 text-base focus:border-ink"
          />
          {shown.length === 0 ? (
            <p className="text-ink-muted">{t("saved.noMatch", lang)}</p>
          ) : (
            <ul className="space-y-3">
              {shown.map((s) => {
                const name = localize(s.name, lang);
                return (
                  <li key={s.id}>
                    <Card tone="paper">
                      <Chip>{categoryLabel(s.category, lang)}</Chip>
                      <h2 className="mt-2 text-lg font-extrabold leading-snug">
                        <Link href={`/schemes/${encodeURIComponent(s.id)}`} className="inline-block min-h-11 hover:underline">
                          {name}
                        </Link>
                      </h2>
                      <p className="mt-1 text-sm text-ink-soft">{localize(s.benefit, lang)}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button href={`/kit/${encodeURIComponent(s.id)}`}>{t("detail.getKit", lang)}</Button>
                        <Button
                          variant="secondary"
                          onClick={() => remove(s.id)}
                          aria-label={fmt(t("saved.removeFor", lang), { name })}
                        >
                          {t("common.remove", lang)}
                        </Button>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
