"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { t, useLang } from "@/lib/i18n";

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

const ITEMS = [
  { href: "/", key: "nav.home", icon: icon(<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>) },
  { href: "/saved", key: "nav.saved", icon: icon(<path d="M6 3h12v18l-6-4-6 4z" />) },
  { href: "/offices", key: "nav.offices", icon: icon(<><path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>) },
  { href: "/account", key: "nav.account", icon: icon(<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>) },
];

export function BottomNav() {
  const pathname = usePathname();
  const [lang] = useLang();
  return (
    <nav aria-label={t("nav.label", lang)} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-3xl grid-cols-4">
        {ITEMS.map((it) => {
          const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-2 text-xs font-bold ${
                  active ? "text-brand-700" : "text-ink-muted hover:text-ink"
                }`}
              >
                <span className={`grid h-7 w-12 place-items-center rounded-full ${active ? "bg-brand-100" : ""}`}>{it.icon}</span>
                {t(it.key, lang)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
