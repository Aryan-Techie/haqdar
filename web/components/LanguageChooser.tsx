"use client";

import { useEffect, useRef, useState } from "react";
import { isLangChosen, setLang, t, useLang } from "@/lib/i18n";
import type { LangCode } from "@/lib/types";

/** First-run language choice. Shown once; the pick is stored by setLang and can be changed from the top strip. */
export function LanguageChooser() {
  const [lang] = useLang();
  const [open, setOpen] = useState(false);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Storage is only readable on the client, so decide after mount.
    const id = requestAnimationFrame(() => setOpen(!isLangChosen()));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (open) first.current?.focus();
  }, [open]);

  if (!open) return null;

  const choose = (l: LangCode) => {
    setLang(l);
    setOpen(false);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="lang-title" className="fixed inset-0 z-50 flex flex-col justify-end bg-ink/80 sm:justify-center">
      <div className="mx-auto w-full max-w-md rounded-t-[2rem] bg-paper p-6 pb-10 sm:rounded-[2rem]">
        <span aria-hidden className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-3xl font-extrabold text-ink">
          ह
        </span>
        <h2 id="lang-title" className="text-2xl font-extrabold">
          Choose your language
          <span className="mt-1 block text-xl">अपनी भाषा चुनें</span>
        </h2>
        <p className="mt-2 text-base text-ink-soft">{t("home.chooseLanguageHint", lang)}</p>
        <div className="mt-5 grid gap-3">
          <button
            ref={first}
            type="button"
            onClick={() => choose("hi")}
            className="min-h-16 rounded-2xl bg-brand px-5 text-2xl font-extrabold text-ink hover:bg-brand-400 active:bg-brand-600"
            lang="hi"
          >
            हिन्दी
          </button>
          <button
            type="button"
            onClick={() => choose("en")}
            className="min-h-16 rounded-2xl border-2 border-ink bg-white px-5 text-2xl font-extrabold text-ink hover:bg-paper-deep"
            lang="en"
          >
            English
          </button>
        </div>
      </div>
    </div>
  );
}
