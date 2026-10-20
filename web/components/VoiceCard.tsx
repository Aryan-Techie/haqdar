"use client";

import "./chat.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { interestFromText } from "@/lib/chat/interest";
import { t, useLang } from "@/lib/i18n";

/** The home hero: a large "ask in your voice" card that opens the chat, with a typed-question shortcut. */
export function VoiceCard() {
  const [lang] = useLang();
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const interest = interestFromText(q);
    router.push(interest ? `/chat?interest=${interest}` : "/chat");
  };

  return (
    <section aria-labelledby={`${id}-title`} className="overflow-hidden rounded-[1.75rem] bg-brand text-ink shadow-md">
      <Link
        href="/chat"
        className="flex items-center gap-4 p-5 transition-colors hover:bg-brand-400 active:bg-brand-600 sm:gap-6 sm:p-6"
      >
        <span aria-hidden className="orb-breathe grid h-20 w-20 shrink-0 place-items-center rounded-full bg-ink text-brand sm:h-24 sm:w-24">
          <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0014 0M12 18v3" />
          </svg>
        </span>
        <span className="min-w-0">
          <span id={`${id}-title`} className="block text-2xl font-extrabold leading-tight sm:text-3xl">
            {t("home.voiceTitle", lang)}
          </span>
          <span className="mt-1 block text-base font-semibold italic text-ink-soft">{t("home.voiceSample", lang)}</span>
          <span className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-base font-bold text-paper">
            {t("home.voiceCta", lang)}
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </span>
      </Link>
      <form onSubmit={submit} className="flex gap-2 border-t-2 border-ink/15 bg-brand-100 p-3">
        <label htmlFor={`${id}-q`} className="sr-only">
          {t("home.typeLabel", lang)}
        </label>
        <input
          id={`${id}-q`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          enterKeyHint="go"
          autoComplete="off"
          placeholder={t("home.typePlaceholder", lang)}
          className="min-h-11 min-w-0 flex-1 rounded-full border-2 border-brand-200 bg-white px-4 text-base font-semibold text-ink placeholder:text-ink-muted focus:border-ink"
        />
        <button type="submit" className="min-h-11 min-w-16 rounded-full bg-ink px-4 text-base font-bold text-paper hover:bg-ink-soft">
          {t("home.typeSubmit", lang)}
        </button>
      </form>
    </section>
  );
}
