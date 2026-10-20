"use client";

import { fmt, t, useLang } from "@/lib/i18n";

export const CONSENT_VERSION = "2026-10-20";

/** The consent text and the checkbox that gates verification. Controlled by the parent. */
export function ConsentSheet({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const [lang] = useLang();
  return (
    <section aria-labelledby="consent-title" className="rounded-2xl border border-line bg-paper-deep p-4">
      <h3 id="consent-title" className="text-base font-extrabold">
        {t("account.consentTitle", lang)}
      </h3>
      <p className="mt-1 text-sm leading-relaxed">{t("account.consentBody", lang)}</p>
      <p className="mt-2 text-xs text-ink-muted">
        {fmt(t("account.consentRetention", lang), { version: CONSENT_VERSION })}
      </p>
      <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-base font-bold">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-6 w-6 shrink-0 accent-brand-600"
        />
        {t("account.consentAccept", lang)}
      </label>
    </section>
  );
}
