"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import { fmt, t } from "@/lib/i18n";
import { questionSpec } from "@/lib/chat/questions";
import { matchAnswer, norm } from "@/lib/voice/match";
import { vocab } from "@/lib/vocab";
import type { LangCode, ProfileValue } from "@/lib/types";

type Props = {
  field: string;
  lang: LangCode;
  /** Current answer when editing; highlighted. */
  value?: ProfileValue;
  onSubmit: (value: ProfileValue) => void;
};

const LONG_LIST = 12;

const optionBtn =
  "flex min-h-12 w-full items-center rounded-2xl border-2 px-4 py-2 text-left text-[1.0625rem] font-semibold transition-colors";
const optionIdle = "border-line bg-white text-ink hover:border-ink active:bg-paper-deep";
const optionOn = "border-ink bg-ink text-paper";

export function QuestionInput({ field, lang, value, onSubmit }: Props) {
  const spec = useMemo(() => questionSpec(field, lang), [field, lang]);
  if (spec.kind === "integer") return <AgeInput field={field} lang={lang} value={value} onSubmit={onSubmit} />;
  if (spec.kind === "boolean") {
    return (
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={spec.text}>
        {[true, false].map((b) => (
          <button
            key={String(b)}
            type="button"
            aria-pressed={value === b}
            onClick={() => onSubmit(b)}
            className={`${optionBtn} justify-center text-center ${value === b ? optionOn : optionIdle}`}
          >
            {b ? t("common.yes", lang) : t("common.no", lang)}
          </button>
        ))}
      </div>
    );
  }
  if (spec.options.length > LONG_LIST) return <SearchList field={field} lang={lang} value={value} onSubmit={onSubmit} />;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label={spec.text}>
      {spec.options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onSubmit(o.id)}
          className={`${optionBtn} ${value === o.id ? optionOn : optionIdle}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AgeInput({ field, lang, value, onSubmit }: Props) {
  const id = useId();
  const [text, setText] = useState(value === undefined ? "" : String(value));
  const [error, setError] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const m = matchAnswer(field, text, lang);
    if (!m) return setError(true);
    setError(false);
    onSubmit(m.value);
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-semibold text-ink-soft">
        {t("chat.ageHint", lang)}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(false);
          }}
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="send"
          aria-invalid={error}
          aria-describedby={error ? `${id}-err` : undefined}
          placeholder="65"
          className={`min-h-12 min-w-0 flex-1 rounded-2xl border-2 bg-white px-4 text-xl font-bold text-ink placeholder:text-ink-muted/60 ${
            error ? "border-bad" : "border-line focus:border-ink"
          }`}
        />
        <button
          type="submit"
          className="min-h-12 min-w-24 rounded-2xl bg-ink px-5 text-base font-bold text-paper hover:bg-ink-soft active:bg-ink-soft"
        >
          {t("chat.send", lang)}
        </button>
      </div>
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-base font-semibold text-bad">
          {t("chat.ageInvalid", lang)}
        </p>
      ) : null}
    </form>
  );
}

/** Long enum (the 36 states): type to filter, then tap. Enter picks the first match. */
function SearchList({ field, lang, value, onSubmit }: Props) {
  const id = useId();
  const [q, setQ] = useState("");
  const spec = useMemo(() => questionSpec(field, lang), [field, lang]);
  const matches = useMemo(() => {
    const n = norm(q);
    if (!n) return spec.options;
    const direct = spec.options.filter((o) => {
      const def = vocab.fields[field]?.options?.find((x) => x.id === o.id);
      return [def?.en, def?.hi].some((l) => l && norm(l).includes(n));
    });
    if (direct.length) return direct;
    const m = matchAnswer(field, q, lang);
    return m ? spec.options.filter((o) => o.id === m.value) : [];
  }, [q, spec, field, lang]);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-semibold text-ink-soft">
        {t("chat.searchStateLabel", lang)}
      </label>
      <input
        id={id}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches.length > 0) {
            e.preventDefault();
            onSubmit(matches[0].id);
          }
        }}
        autoComplete="off"
        enterKeyHint="go"
        placeholder={t("chat.searchState", lang)}
        aria-controls={`${id}-list`}
        className="min-h-12 rounded-2xl border-2 border-line bg-white px-4 text-lg font-semibold text-ink placeholder:text-ink-muted/60 focus:border-ink"
      />
      <p className="sr-only" role="status" aria-live="polite">
        {fmt(t("chat.matches", lang), { n: matches.length })}
      </p>
      <ul id={`${id}-list`} className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto overscroll-contain sm:grid-cols-2">
        {matches.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              aria-pressed={value === o.id}
              onClick={() => onSubmit(o.id)}
              className={`${optionBtn} ${value === o.id ? optionOn : optionIdle}`}
            >
              {o.label}
            </button>
          </li>
        ))}
        {matches.length === 0 ? <li className="px-1 py-2 text-base font-semibold text-ink-muted">{t("chat.noMatch", lang)}</li> : null}
      </ul>
    </div>
  );
}
