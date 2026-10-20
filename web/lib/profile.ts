"use client";

import { useCallback, useSyncExternalStore } from "react";
import * as api from "@/lib/api";
import { createStore } from "@/lib/store";
import { vocab } from "@/lib/vocab";
import type { Profile, ProfileValue } from "@/lib/types";

const EMPTY: Profile = {};
const KEY = "haqdar:profile";

const VERSION_KEY = "haqdar:profile:vocab";

/** Keep only fields and values that are valid against the current vocabulary (drops unknown keys, retired option ids, out-of-range ages). */
export function sanitizeProfile(raw: unknown): Profile {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY;
  const out: Record<string, ProfileValue> = {};
  for (const [field, value] of Object.entries(raw as Record<string, unknown>)) {
    const def = vocab.fields[field];
    if (!def) continue;
    if (def.type === "enum") {
      if (typeof value === "string" && def.options?.some((o) => o.id === value)) out[field] = value;
    } else if (def.type === "integer") {
      if (typeof value === "number" && Number.isInteger(value) && value >= (def.min ?? -Infinity) && value <= (def.max ?? Infinity)) {
        out[field] = value;
      }
    } else if (typeof value === "boolean") out[field] = value;
  }
  return out as Profile;
}

function writeVersion() {
  try {
    localStorage.setItem(VERSION_KEY, vocab.version);
  } catch {
    /* storage unavailable */
  }
}

const store = createStore<Profile>(KEY, EMPTY, (raw) => {
  const clean = sanitizeProfile(JSON.parse(raw));
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(VERSION_KEY);
  } catch {
    /* ignore */
  }
  // Saved under another vocabulary version, or holding retired values: write back what is still valid.
  if (stored !== vocab.version || JSON.stringify(clean) !== raw) {
    try {
      if (Object.keys(clean).length) localStorage.setItem(KEY, JSON.stringify(clean));
      else localStorage.removeItem(KEY);
      writeVersion();
    } catch {
      /* ignore */
    }
  }
  return clean;
});

const persist = (p: Profile) => {
  writeVersion();
  return Object.keys(p).length ? JSON.stringify(p) : null;
};

// ---- fields already asked (answered or skipped) in the chat, so skips are not re-asked -----------
const ASKED_KEY = "haqdar:asked";

const askedStore = createStore<string[]>(ASKED_KEY, [], (raw) => {
  const v = JSON.parse(raw);
  return Array.isArray(v) ? v.filter((f): f is string => typeof f === "string" && f in vocab.fields) : [];
});
const persistAsked = (a: string[]) => (a.length ? JSON.stringify(a) : null);

export function getAsked(): string[] {
  return askedStore.get();
}
export function addAsked(field: string): void {
  const cur = askedStore.get();
  if (!cur.includes(field)) askedStore.set([...cur, field], persistAsked);
}
export function setAsked(fields: string[]): void {
  askedStore.set(fields, persistAsked);
}
export function clearAsked(): void {
  askedStore.set([], persistAsked);
}

/** Remove everything Haqdar keeps on this device (profile, asked list, results, kit ticks, token); the language choice stays. */
export function clearLocalData(): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("haqdar:") && k !== "haqdar:lang") localStorage.removeItem(k);
    for (const k of Object.keys(sessionStorage)) if (k.startsWith("haqdar:")) sessionStorage.removeItem(k);
  } catch {
    /* storage unavailable */
  }
  store.reset();
  askedStore.reset();
}

export function getProfile(): Profile {
  return store.get();
}

const filled = (p: Profile | null | undefined): Profile =>
  Object.fromEntries(Object.entries(p ?? {}).filter(([, v]) => v !== undefined && v !== null)) as Profile;

/**
 * After sign-in: reconcile the local and server profiles.
 * server only -> load into local; both -> merge (local wins) and PUT; local only -> PUT local.
 * Never throws; a failed server call leaves the local profile as is.
 */
export async function syncProfileOnSignIn(lang?: "en" | "hi"): Promise<void> {
  const local = filled(store.get());
  let server: Profile = {};
  let serverOk = true;
  try {
    server = filled(sanitizeProfile((await api.getMe())?.profile));
  } catch {
    serverOk = false;
  }
  const hasLocal = Object.keys(local).length > 0;
  const hasServer = Object.keys(server).length > 0;
  try {
    if (hasServer && !hasLocal) {
      store.set(server, persist);
    } else if (hasServer && hasLocal) {
      const merged = { ...server, ...local };
      store.set(merged, persist);
      await api.putMe(merged, lang);
    } else if (hasLocal && (serverOk || !hasServer)) {
      await api.putMe(local, lang);
    }
  } catch {
    /* signed in anyway; local profile syncs on the next edit */
  }
}

export function resetProfileStore(): void {
  store.reset();
}

export function useProfile(): {
  profile: Profile;
  setField: (field: string, value: ProfileValue | undefined) => void;
  clear: () => void;
  answeredCount: number;
} {
  const profile = useSyncExternalStore(store.subscribe, store.get, store.getServer);
  const setField = useCallback((field: string, value: ProfileValue | undefined) => {
    const next: Record<string, unknown> = { ...store.get() };
    if (value === undefined) delete next[field];
    else next[field] = value;
    store.set(next as Profile, persist);
  }, []);
  const clear = useCallback(() => {
    store.set(EMPTY, persist);
    clearAsked();
  }, []);
  const answeredCount = Object.values(profile).filter((v) => v !== undefined && v !== null).length;
  return { profile, setField, clear, answeredCount };
}
