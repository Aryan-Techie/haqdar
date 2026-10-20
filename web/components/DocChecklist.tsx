"use client";

import { useState } from "react";
import { localize, t, useLang } from "@/lib/i18n";
import type { SchemeDocument } from "@/lib/types";

export function DocChecklist({ documents }: { documents: SchemeDocument[] }) {
  const [lang] = useLang();
  const [done, setDone] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  return (
    <div>
      <p className="mb-2 text-sm text-ink-muted">{t("detail.checklistHint", lang)}</p>
      <ul className="divide-y divide-line">
        {documents.map((d, i) => {
          const checked = done.has(i);
          return (
            <li key={i}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(i)}
                  className="mt-0.5 h-6 w-6 shrink-0 accent-ink"
                />
                <span className="min-w-0 flex-1">
                  <span className={checked ? "text-ink-muted line-through" : ""}>{localize(d.name, lang)}</span>
                  {d.note ? <span className="block text-sm text-ink-muted">{localize(d.note, lang)}</span> : null}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    d.required ? "bg-ink text-paper" : "border border-line bg-paper-deep text-ink-soft"
                  }`}
                >
                  {t(d.required ? "detail.mustHave" : "detail.ifApplicable", lang)}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
