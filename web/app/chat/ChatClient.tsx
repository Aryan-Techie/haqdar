"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { MicButton } from "@/components/MicButton";
import { QuestionInput } from "@/components/QuestionInput";
import * as api from "@/lib/api";
import { getToken } from "@/lib/auth";
import { nextQuestion, MAX_EXTRA } from "@/lib/chat/flow";
import { parseInterests } from "@/lib/chat/interest";
import { useVoiceOn } from "@/lib/chat/prefs";
import { answerLabel, questionSpec, threadOrder } from "@/lib/chat/questions";
import { fmt, t, useLang } from "@/lib/i18n";
import { addAsked, getAsked, setAsked, useProfile } from "@/lib/profile";
import { fieldNames, saveResults, useMatchingResults } from "@/lib/results";
import { vocab } from "@/lib/vocab";
import { getVoiceProvider, VoiceError } from "@/lib/voice";
import { isDontKnow, matchAnswer } from "@/lib/voice/match";
import type { EvaluateResponse, Profile, ProfileValue } from "@/lib/types";

const noopSubscribe = () => () => {};

type Phase = "ask" | "offer" | "working" | "error";

const speakerIcon = (on: boolean) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 9v6h4l5 4V5L8 9z" />
    {on ? <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
  </svg>
);

export function ChatClient() {
  const router = useRouter();
  const params = useSearchParams();
  const interests = useMemo(() => parseInterests(params.get("interest")), [params]);
  const [lang] = useLang();
  const { profile, setField, clear, answeredCount } = useProfile();
  const [voiceOn, setVoiceOn] = useVoiceOn();
  const matching = useMatchingResults();
  const wantExtras = params.get("extras") === "1"; // from the results page: go straight to the extra questions
  const [booted, setBooted] = useState(!wantExtras);

  const provider = useMemo(() => getVoiceProvider(), []);
  const canListen = useSyncExternalStore(noopSubscribe, () => provider.supportsListening(), () => false);

  const [history, setHistory] = useState<string[]>([]); // fields asked (answered or skipped), in order
  const [decided, setDecided] = useState(false); // returning user chose "use saved" or "start over"
  const [extras, setExtras] = useState(false); // user agreed to the engine-chosen extra questions
  const [nextFields, setNextFields] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("ask");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [misses, setMisses] = useState<{ field: string; count: number }>({ field: "", count: 0 });
  const [micBlocked, setMicBlocked] = useState(false);
  const [invalid, setInvalid] = useState(false); // the server rejected some saved answers (422)
  const probe = useRef<{ key: string; response: EvaluateResponse } | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const needsResume = !decided && answeredCount > 0 && history.length === 0;
  const answered = useCallback((f: string) => (profile as Record<string, unknown>)[f] !== undefined, [profile]);
  const frontier = phase === "ask" && !needsResume ? nextQuestion(profile, extras ? nextFields : [], history) : null;
  const current = needsResume ? null : (editing ?? frontier);

  // ---- progress -----------------------------------------------------------------------------
  const order = useMemo(() => threadOrder(history, answered), [history, answered]);
  const extraCount = extras ? Math.min(MAX_EXTRA, nextFields.filter((f) => f in vocab.fields && !vocab.fixed_order.includes(f)).length) : 0;
  const total = Math.min(vocab.max_questions, vocab.fixed_order.length + extraCount);
  const position = current ? (editing ? Math.max(1, order.indexOf(current) + 1) : Math.min(total, order.length + 1)) : total;

  // ---- finishing ------------------------------------------------------------------------------
  const finish = useCallback(
    (response: EvaluateResponse, p: Profile) => {
      saveResults(response, p, interests);
      // Signed in: the server profile (used for the kit PDF) must match what was just answered.
      if (getToken()) void api.putMe(p, lang).catch(() => {});
      router.push("/results");
    },
    [router, interests, lang],
  );

  const evaluate = useCallback(
    async (p: Profile): Promise<EvaluateResponse> => {
      const key = JSON.stringify(p) + interests.join(",");
      if (probe.current?.key === key) return probe.current.response;
      const response = await api.evaluate(p, interests.length ? interests : undefined);
      probe.current = { key, response };
      return response;
    },
    [interests],
  );

  /** An evaluate call failed: a 422 means saved answers are out of date, so drop them; anything else is a retryable error. */
  const fail = useCallback(
    (e: unknown) => {
      const bad = api.invalidFields(e);
      if (bad.length) {
        for (const f of bad) setField(f, undefined);
        setHistory((h) => h.filter((f) => !bad.includes(f)));
        setAsked(getAsked().filter((f) => !bad.includes(f)));
        probe.current = null;
        setInvalid(true);
        setError(fmt(t("errors.invalidAnswers", lang), { fields: fieldNames(bad, lang) }));
      } else {
        setInvalid(false);
        setError(e instanceof api.ApiError && e.status === 0 ? t("errors.network", lang) : t("errors.server", lang));
      }
      setPhase("error");
    },
    [setField, lang],
  );

  /** Called when a question was just answered or skipped (or the user asked to continue): move on or evaluate. */
  const advance = useCallback(
    async (p: Profile, h: string[], withExtras: boolean, fields: string[]) => {
      if (nextQuestion(p, withExtras ? fields : [], h) !== null) return;
      setPhase("working");
      setError(null);
      try {
        const response = await evaluate(p);
        if (!withExtras && nextQuestion(p, response.next_fields, h) !== null) {
          setNextFields(response.next_fields);
          setPhase("offer");
        } else finish(response, p);
      } catch (e) {
        fail(e);
      }
    },
    [evaluate, finish, fail],
  );

  const commit = useCallback(
    (field: string, value: ProfileValue | undefined) => {
      provider.cancel();
      setListening(false);
      setNotice(null);
      const p: Profile = { ...profile };
      if (value === undefined) delete (p as Record<string, unknown>)[field];
      else (p as Record<string, unknown>)[field] = value;
      setField(field, value);
      addAsked(field);

      if (editing) {
        setEditing(null);
        void advance(p, history, extras, nextFields); // no-op mid-flow; re-checks schemes after the offer or an error
        return;
      }
      const h = history.includes(field) ? history : [...history, field];
      setHistory(h);
      void advance(p, h, extras, nextFields);
    },
    [provider, profile, setField, editing, history, advance, extras, nextFields],
  );

  // ---- voice ----------------------------------------------------------------------------------
  const spec = current ? questionSpec(current, lang) : null;

  useEffect(() => {
    if (!voiceOn || !current) return;
    void provider.speak(questionSpec(current, lang).text, lang).catch(() => {});
    return () => provider.cancel();
  }, [voiceOn, current, lang, provider]);

  useEffect(() => () => provider.cancel(), [provider]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [current, phase, history.length, needsResume]);

  const missCount = current && misses.field === current ? misses.count : 0;
  const showMic = canListen && !micBlocked && missCount < 2 && !!current;

  const onMic = async () => {
    if (!current) return;
    if (listening) {
      provider.stopListening?.();
      return;
    }
    provider.cancel();
    setNotice(null);
    setListening(true);
    const field = current;
    try {
      const heard = await provider.listen(lang);
      const m = matchAnswer(field, heard, lang);
      if (m) {
        setMisses({ field, count: 0 });
        commit(field, m.value);
        return;
      }
      if (isDontKnow(heard)) {
        // "I don't know" is not an answer: offer the buttons and a skip instead of guessing.
        setMisses({ field, count: 2 });
        setNotice(t("chat.dontKnow", lang));
        return;
      }
      const count = (misses.field === field ? misses.count : 0) + 1;
      setMisses({ field, count });
      setNotice(
        count >= 2
          ? `${fmt(t("chat.heard", lang), { text: heard })} ${t("chat.useButtons", lang)}`
          : `${fmt(t("chat.heard", lang), { text: heard })} ${t("chat.notUnderstood", lang)}`,
      );
      if (count < 2 && voiceOn) void provider.speak(questionSpec(field, lang).text, lang).catch(() => {});
    } catch (e) {
      const code = e instanceof VoiceError ? e.code : "unknown";
      if (code === "aborted") return;
      if (code === "not-allowed" || code === "unsupported" || code === "not-configured") {
        setMicBlocked(true);
        setNotice(t("chat.micDenied", lang));
      } else if (code === "no-speech") {
        const count = (misses.field === field ? misses.count : 0) + 1;
        setMisses({ field, count });
        setNotice(count >= 2 ? t("chat.useButtons", lang) : t("chat.micNoSpeech", lang));
      } else setNotice(t("chat.micFailed", lang));
    } finally {
      setListening(false);
    }
  };

  // ---- navigation within the conversation ---------------------------------------------------
  const canGoBack = !needsResume && phase !== "working" && (editing ? order.indexOf(editing) > 0 : order.length > 0);
  const goBack = () => {
    provider.cancel();
    setNotice(null);
    setListening(false);
    const idx = editing ? order.indexOf(editing) : order.length;
    if (idx > 0) setEditing(order[idx - 1]);
  };
  const edit = (f: string) => {
    provider.cancel();
    setNotice(null);
    setListening(false);
    setEditing(f);
  };

  const startOver = () => {
    provider.cancel();
    clear();
    probe.current = null;
    setInvalid(false);
    setHistory([]);
    setExtras(false);
    setNextFields([]);
    setEditing(null);
    setNotice(null);
    setError(null);
    setMisses({ field: "", count: 0 });
    setDecided(true);
    setPhase("ask");
  };

  const useSaved = () => {
    const asked = getAsked();
    setDecided(true);
    setHistory(asked); // skipped questions stay skipped
    void advance(profile, asked, false, nextFields);
  };

  const acceptExtras = () => {
    setExtras(true);
    setPhase("ask");
  };

  /** "See my schemes" from the offer: evaluate the current answers (cached when unchanged) and go. */
  const seeNow = async () => {
    setPhase("working");
    setError(null);
    try {
      finish(await evaluate(profile), profile);
    } catch (e) {
      fail(e);
    }
  };

  const retry = () => {
    setPhase("ask");
    void advance(profile, history, extras, nextFields);
  };

  // Arrived from "Answer N more questions": load the engine's ranking and go straight to the extras.
  useEffect(() => {
    if (!wantExtras || booted) return;
    let live = true;
    void (async () => {
      try {
        const fields = matching?.next_fields ?? (await evaluate(profile)).next_fields;
        if (!live) return;
        const asked = getAsked();
        setNextFields(fields);
        setExtras(true);
        setHistory(asked);
        setDecided(true);
        setBooted(true);
        void advance(profile, asked, true, fields);
      } catch {
        if (live) setBooted(true); // fall back to the normal flow
      }
    })();
    return () => {
      live = false;
    };
  }, [wantExtras, booted, matching, profile, evaluate, advance]);

  const remaining = Math.min(MAX_EXTRA, nextFields.filter((f) => f in vocab.fields && !vocab.fixed_order.includes(f) && !answered(f) && !history.includes(f)).length);
  const panelVisible = needsResume || phase === "error" || (phase === "offer" && !editing) || !!current;
  const pct = Math.round(((position - (current ? 1 : 0)) / total) * 100);

  if (!booted) {
    return (
      <p role="status" className="flex items-center gap-2 py-10 font-semibold">
        <span aria-hidden className="h-3 w-3 animate-pulse rounded-full bg-brand" />
        {t("chat.working", lang)}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header: back, progress, voice toggle */}
      <div className="sticky top-[3.75rem] z-20 -mx-4 flex flex-col gap-2 bg-paper/95 px-4 pb-3 pt-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            disabled={!canGoBack}
            aria-label={t("chat.backAria", lang)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-ink text-ink transition-colors hover:bg-paper-deep disabled:cursor-not-allowed disabled:opacity-30"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-extrabold" aria-live="polite">
              {current ? fmt(t("chat.progress", lang), { n: position, total }) : t("chat.title", lang)}
            </p>
            <div
              role="progressbar"
              aria-label={t("chat.progressLabel", lang)}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={current ? position - 1 : total}
              className="mt-1 h-2 overflow-hidden rounded-full bg-paper-deep"
            >
              <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${current ? pct : 100}%` }} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (voiceOn) provider.cancel();
              setVoiceOn(!voiceOn);
            }}
            aria-pressed={voiceOn}
            aria-label={voiceOn ? t("chat.voiceOff", lang) : t("chat.voiceOn", lang)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-bold transition-colors ${
              voiceOn ? "border-ink bg-ink text-brand" : "border-line bg-white text-ink hover:border-ink"
            }`}
          >
            {speakerIcon(voiceOn)}
            {voiceOn ? t("chat.voiceShortOn", lang) : t("chat.voiceShortOff", lang)}
          </button>
        </div>
      </div>

      {/* Conversation */}
      <div className="flex flex-col gap-3" role="log" aria-label={t("chat.title", lang)}>
        <ChatBubble from="agent">{t("chat.intro", lang)}</ChatBubble>

        {needsResume ? (
          <>
            <ChatBubble from="agent">
              <span className="block">{fmt(t("chat.resumeTitle", lang), { n: answeredCount })}</span>
              <span className="mt-1 block text-base font-normal text-ink-soft">{t("chat.resumeHint", lang)}</span>
            </ChatBubble>
          </>
        ) : (
          order.map((f) => {
            const v = (profile as Record<string, unknown>)[f] as ProfileValue | undefined;
            const label = answerLabel(f, v, lang);
            return (
              <div key={f} className="flex flex-col gap-2">
                <ChatBubble from="agent">{questionSpec(f, lang).text}</ChatBubble>
                <ChatBubble
                  from="user"
                  muted={v === undefined}
                  active={editing === f}
                  onEdit={phase === "working" ? undefined : () => edit(f)}
                  editLabel={fmt(t("chat.editAnswer", lang), { answer: label })}
                >
                  {label}
                </ChatBubble>
              </div>
            );
          })
        )}

        {phase === "offer" && !editing ? (
          <ChatBubble from="agent">
            {remaining > 1
              ? fmt(t("chat.sharpen", lang), { n: remaining })
              : t("chat.sharpenOne", lang)}
          </ChatBubble>
        ) : null}

        {phase === "working" ? (
          <ChatBubble from="agent">
            <span role="status" className="flex items-center gap-2">
              <span aria-hidden className="h-3 w-3 animate-pulse rounded-full bg-brand" />
              {t("chat.working", lang)}
            </span>
          </ChatBubble>
        ) : null}

        {phase === "error" ? (
          <ChatBubble from="agent">
            <span role="alert">
              <span className="block">{t(invalid ? "chat.invalidTitle" : "chat.errorTitle", lang)}</span>
              <span className="mt-1 block text-base font-normal text-ink-soft">
                {error} {t("chat.errorHint", lang)}
              </span>
            </span>
          </ChatBubble>
        ) : null}

        {current && spec ? <ChatBubble from="agent">{editing ? <><span className="block text-sm font-bold uppercase tracking-wide text-brand-700">{t("chat.editing", lang)}</span>{spec.text}</> : spec.text}</ChatBubble> : null}
      </div>

      {/* Answer panel */}
      {panelVisible ? (
      <div className="flex flex-col gap-3 rounded-[1.5rem] border border-line bg-paper-deep p-3" role="group" aria-label={t("chat.yourAnswer", lang)}>
        {needsResume ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={useSaved} className="min-h-12 rounded-2xl bg-brand px-5 text-base font-extrabold text-ink hover:bg-brand-400 active:bg-brand-600">
              {t("chat.useSaved", lang)}
            </button>
            <button type="button" onClick={startOver} className="min-h-12 rounded-2xl border-2 border-ink bg-white px-5 text-base font-extrabold text-ink hover:bg-paper">
              {t("chat.startOver", lang)}
            </button>
          </div>
        ) : null}

        {phase === "offer" && !editing ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={acceptExtras} className="min-h-12 rounded-2xl border-2 border-ink bg-white px-5 text-base font-extrabold text-ink hover:bg-paper">
              {remaining > 1 ? t("chat.moreQuestions", lang) : t("chat.moreOne", lang)}
            </button>
            <button type="button" onClick={() => void seeNow()} className="min-h-12 rounded-2xl bg-brand px-5 text-base font-extrabold text-ink hover:bg-brand-400 active:bg-brand-600">
              {t("chat.seeResults", lang)}
            </button>
          </div>
        ) : null}

        {phase === "error" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={retry} className="min-h-12 rounded-2xl bg-brand px-5 text-base font-extrabold text-ink hover:bg-brand-400">
              {t("common.retry", lang)}
            </button>
            <button type="button" onClick={startOver} className="min-h-12 rounded-2xl border-2 border-ink bg-white px-5 text-base font-extrabold text-ink hover:bg-paper">
              {t("chat.startOver", lang)}
            </button>
          </div>
        ) : null}

        {current && spec ? (
          <>
            {showMic ? (
              <div className="flex items-center gap-3">
                <MicButton listening={listening} onClick={onMic} label={t("chat.mic", lang)} stopLabel={t("chat.micStop", lang)} />
                <p className="text-base font-semibold text-ink-soft" role="status" aria-live="polite">
                  {listening ? t("chat.listening", lang) : t("chat.saySomething", lang)}
                </p>
              </div>
            ) : (
              <p className="px-1 text-base font-semibold text-ink-soft">{t("chat.tapOrType", lang)}</p>
            )}

            {notice ? (
              <p role="status" aria-live="polite" className="rounded-xl bg-warn-bg px-3 py-2 text-base font-semibold text-warn">
                {notice}
              </p>
            ) : null}

            <QuestionInput
              key={`${current}:${editing ? "edit" : "new"}`}
              field={current}
              lang={lang}
              value={editing ? ((profile as Record<string, unknown>)[current] as ProfileValue | undefined) : undefined}
              onSubmit={(v) => commit(current, v)}
            />

            <div className="flex items-center justify-between gap-2 pt-1">
              {editing ? (
                <button type="button" onClick={() => setEditing(null)} className="inline-flex min-h-11 items-center rounded-full px-4 text-base font-bold text-ink underline underline-offset-4">
                  {t("chat.cancelEdit", lang)}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => commit(current, undefined)}
                  aria-label={t("chat.skipAria", lang)}
                  className="inline-flex min-h-11 items-center rounded-full border-2 border-ink px-5 text-base font-bold text-ink hover:bg-paper"
                >
                  {t("common.skip", lang)}
                </button>
              )}
              <button type="button" onClick={startOver} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-ink-muted underline underline-offset-4 hover:text-ink">
                {t("chat.startOver", lang)}
              </button>
            </div>
          </>
        ) : null}
      </div>
      ) : null}
      <div ref={bottom} aria-hidden className="scroll-mb-32" />
    </div>
  );
}
