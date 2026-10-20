"use client";

import { fmt, t, useLang } from "@/lib/i18n";
import { formatDate, sourceHost } from "@/lib/results";

export function SourceLink({ url, lastVerified }: { url: string; lastVerified?: string }) {
  const [lang] = useLang();
  const host = sourceHost(url);
  return (
    <div className="flex flex-col gap-1">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-2 break-all font-bold underline decoration-2 underline-offset-4"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
        </svg>
        {host}
        <span className="sr-only"> ({t("detail.opensNew", lang)})</span>
      </a>
      {lastVerified ? (
        <p className="text-sm text-ink-muted">{fmt(t("detail.lastVerified", lang), { date: formatDate(lastVerified, lang) })}</p>
      ) : null}
    </div>
  );
}
