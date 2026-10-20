"use client";

import { useSyncExternalStore } from "react";
import { t, useLang } from "@/lib/i18n";

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

export function OfflineNotice() {
  const online = useOnline();
  const [lang] = useLang();
  if (online) return null;
  return (
    <div role="status" className="bg-warn-bg px-4 py-2 text-center text-sm font-semibold text-warn">
      {t("offline.notice", lang)}
    </div>
  );
}
