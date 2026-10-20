"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import * as api from "@/lib/api";
import { getToken, setToken } from "@/lib/auth";
import { fmt, t, useLang } from "@/lib/i18n";
import { syncProfileOnSignIn } from "@/lib/profile";
import { Button } from "@/components/Button";
import { CONSENT_VERSION, ConsentSheet } from "@/components/ConsentSheet";

export { CONSENT_VERSION };

type Opener = (done: (ok: boolean) => void) => void;
let host: Opener | null = null;
let pending: Promise<boolean> | null = null;

/** Opens the sign-in sheet (mounted once by <SignInSheetHost/>). Resolves true after a verified, consented sign-in. */
export const signInSheet = {
  open(): Promise<boolean> {
    if (pending) return pending;
    if (!host) return Promise.resolve(false);
    const open = host;
    pending = new Promise<boolean>((resolve) => {
      open((ok) => {
        pending = null;
        resolve(ok);
      });
    });
    return pending;
  },
};

export function SignInSheetHost() {
  const [done, setDone] = useState<((ok: boolean) => void) | null>(null);
  useEffect(() => {
    host = (cb) => setDone(() => cb);
    return () => {
      host = null;
    };
  }, []);
  if (!done) return null;
  const finish = (ok: boolean) => {
    done(ok);
    setDone(null);
  };
  return <SheetFrame onClose={() => finish(false)}><SignInSheet onResult={finish} /></SheetFrame>;
}

function SheetFrame({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const [lang] = useLang();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("account.signInTitle", lang)}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-xl font-extrabold">{t("account.signInTitle", lang)}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close", lang)}
            className="grid min-h-11 min-w-11 place-items-center rounded-full text-2xl hover:bg-paper-deep"
          >
            <span aria-hidden>×</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputCls =
  "min-h-12 w-full rounded-xl border-2 border-line bg-white px-4 text-lg tracking-wide placeholder:text-ink-muted focus:border-ink";

export function SignInSheet({ onResult }: { onResult: (ok: boolean) => void }) {
  const [lang] = useLang();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const phoneOk = /^\+?\d{10,13}$/.test(phone.replace(/[\s-]/g, ""));

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!phoneOk) return setError(t("account.phoneInvalid", lang));
    setBusy(true);
    setError(null);
    try {
      const r = (await api.requestOtp(phone.replace(/[\s-]/g, ""))) as { sent: boolean; dev_hint?: unknown };
      const h = r.dev_hint;
      setHint(typeof h === "string" || typeof h === "number" ? String(h) : h ? t("account.devCodeHint", lang) : null);
      setStep("code");
    } catch (err) {
      setError(messageFor(err, lang));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!consent) return setError(t("account.consentRequired", lang));
    setBusy(true);
    setError(null);
    try {
      const r = await api.verifyOtp(phone.replace(/[\s-]/g, ""), code.trim(), { version: CONSENT_VERSION, accepted: true });
      setToken(r.token);
      await syncProfileOnSignIn(lang);
      onResult(true);
    } catch (err) {
      setError(err instanceof api.ApiError && err.status === 401 ? t("account.wrongCode", lang) : messageFor(err, lang));
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="mb-4 text-base text-ink-soft">{t("account.signInReason", lang)}</p>
      {step === "phone" ? (
        <form onSubmit={send} className="space-y-3" noValidate>
          <label className="block text-sm font-bold" htmlFor="si-phone">
            {t("account.phone", lang)}
          </label>
          <input
            id="si-phone"
            className={inputCls}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t("account.phoneHint", lang)}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoFocus
          />
          <ErrorLine text={error} />
          <Button type="submit" className="w-full" disabled={busy || !phone}>
            {busy ? t("account.sending", lang) : t("account.sendCode", lang)}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3" noValidate>
          <p className="text-sm font-semibold text-ok">{t("account.codeSent", lang)}</p>
          {hint ? (
            <p className="rounded-xl bg-warn-bg px-3 py-2 text-sm font-semibold text-warn">
              {/^\d{4,8}$/.test(hint) ? fmt(t("account.devHint", lang), { code: hint }) : hint}
            </p>
          ) : null}
          <label className="block text-sm font-bold" htmlFor="si-code">
            {t("account.code", lang)}
          </label>
          <input
            id="si-code"
            ref={codeRef}
            className={`${inputCls} text-center text-2xl tracking-[0.5em]`}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="······"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <ConsentSheet checked={consent} onChange={setConsent} />
          <ErrorLine text={error} />
          <Button type="submit" className="w-full" disabled={busy || !consent || code.length !== 6}>
            {busy ? t("account.verifying", lang) : t("account.verify", lang)}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setStep("phone");
              setCode("");
              setError(null);
            }}
          >
            {t("account.changePhone", lang)}
          </Button>
        </form>
      )}
    </div>
  );
}

function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-xl bg-bad-bg px-3 py-2 text-sm font-semibold text-bad">
      {text}
    </p>
  );
}

function messageFor(err: unknown, lang: "en" | "hi"): string {
  if (err instanceof api.ApiError) {
    if (err.status === 0) return t("errors.network", lang);
    if (err.status === 422) return t("errors.invalidInput", lang);
    if (err.status >= 500) return t("errors.server", lang);
  }
  return t("errors.generic", lang);
}

/** null until mounted (token lives in localStorage), then whether a token exists. */
export function useSignedIn(): [boolean | null, (v: boolean) => void] {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    // Reading localStorage is only possible after mount; this avoids a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSignedIn(!!getToken());
  }, []);
  return [signedIn, setSignedIn];
}
