"use client";

import { useCallback, useSyncExternalStore } from "react";
import { createStore } from "@/lib/store";

const store = createStore<boolean>("haqdar:voice", false, (raw) => raw === "1");

/** Whether the user turned "read questions aloud" on. Off by default, remembered on this device. */
export function useVoiceOn(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(store.subscribe, store.get, store.getServer);
  const set = useCallback((v: boolean) => store.set(v, (x) => (x ? "1" : "0")), []);
  return [on, set];
}
