"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { dictionary } from "@/lib/strings";
import { createStore } from "@/lib/store";
import type { LangCode } from "@/lib/types";

const KEY = "haqdar:lang";
const store = createStore<LangCode>(KEY, "en", (raw) => (raw === "hi" ? "hi" : "en"));

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in node) node = (node as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof node === "string" ? node : undefined;
}

export function getLang(): LangCode {
  return store.get();
}

/** True once the user has picked a language (used for the first-run chooser). */
export function isLangChosen(): boolean {
  return store.has();
}

export function setLang(lang: LangCode): void {
  store.set(lang, (v) => v);
}

/** UI string for `key` in `lang` (default: current language). Falls back to English, then to the key. */
export function t(key: string, lang: LangCode = getLang()): string {
  return lookup(dictionary[lang], key) ?? lookup(dictionary.en, key) ?? key;
}

/** Replace `{name}` placeholders. */
export function fmt(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function localize(text: { en: string; hi?: string }, lang: LangCode): string {
  return (lang === "hi" && text.hi) || text.en;
}

export function useLang(): [LangCode, (l: LangCode) => void] {
  const lang = useSyncExternalStore(store.subscribe, store.get, store.getServer);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const set = useCallback((l: LangCode) => setLang(l), []);
  return [lang, set];
}
