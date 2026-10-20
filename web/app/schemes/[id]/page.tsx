"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import * as api from "@/lib/api";
import { t, useLang } from "@/lib/i18n";
import { useResults } from "@/lib/results";
import type { Scheme } from "@/lib/types";
import { Button } from "@/components/Button";
import { SchemeDetail } from "@/components/SchemeDetail";

type State = { status: "loading" } | { status: "ok"; scheme: Scheme } | { status: "missing" } | { status: "error" };

export default function SchemePage({ params }: PageProps<"/schemes/[id]">) {
  const { id } = use(params);
  const [lang] = useLang();
  const { results: stored } = useResults();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    api
      .getScheme(id)
      .then((scheme) => live && setState({ status: "ok", scheme }))
      .catch((e: unknown) => live && setState({ status: (e as api.ApiError)?.status === 404 ? "missing" : "error" }));
    return () => {
      live = false;
    };
  }, [id, attempt]);

  const retry = () => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  };

  return (
    <div>
      <Link href={stored ? "/results" : "/"} className="mb-2 inline-flex min-h-11 items-center gap-1 font-bold underline-offset-4 hover:underline">
        <span aria-hidden>←</span> {t(stored ? "detail.back" : "common.back", lang)}
      </Link>
      {state.status === "loading" ? (
        <div role="status" aria-busy className="space-y-3" aria-label={t("common.loading", lang)}>
          <div className="h-8 w-3/4 animate-pulse rounded-lg bg-paper-deep" />
          <div className="h-16 animate-pulse rounded-2xl bg-paper-deep" />
          <div className="h-32 animate-pulse rounded-2xl bg-paper-deep" />
        </div>
      ) : null}
      {state.status === "missing" ? <p className="py-8 text-lg font-semibold">{t("detail.notFound", lang)}</p> : null}
      {state.status === "error" ? (
        <div className="py-8">
          <p className="mb-3 text-lg font-semibold">{t("errors.network", lang)}</p>
          <Button onClick={retry}>{t("common.retry", lang)}</Button>
        </div>
      ) : null}
      {state.status === "ok" ? (
        <SchemeDetail scheme={state.scheme} result={stored?.results.find((r) => r.scheme_id === state.scheme.id)} />
      ) : null}
    </div>
  );
}
