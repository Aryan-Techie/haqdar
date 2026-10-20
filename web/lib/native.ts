/**
 * Helpers for running inside the Capacitor Android shell (see /android).
 *
 * No `@capacitor/*` package is a dependency of the web app. The shell loads this app through `server.url`, and Capacitor's
 * injected native bridge exposes every installed plugin on `window.Capacitor` (via `registerPlugin` / `Plugins`). We call
 * through that global, so the web bundle carries no plugin code and plain browsers never touch any of this.
 */

export interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  registerPlugin?: (name: string) => unknown;
  Plugins?: Record<string, unknown>;
}

function cap(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isNativePlatform(): boolean {
  try {
    return cap()?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

/** The plugin proxy for `name` (e.g. "SpeechRecognition", "TextToSpeech", "App", "Browser"), or undefined when unavailable. */
export function nativePlugin<T>(name: string): T | undefined {
  const c = cap();
  if (!c) return undefined;
  const existing = c.Plugins?.[name];
  if (existing) return existing as T;
  try {
    return c.registerPlugin?.(name) as T | undefined;
  } catch {
    return undefined;
  }
}

interface AppPlugin {
  addListener(event: "backButton", cb: (e: { canGoBack: boolean }) => void): unknown;
  exitApp(): Promise<void>;
}
interface BrowserPlugin {
  open(opts: { url: string }): Promise<void>;
}
interface SplashPlugin {
  hide(): Promise<void>;
}

/** True when `href` resolves to a different origin than `base` (and is http(s)). Exported for tests. */
export function isExternalHref(href: string, base: string): boolean {
  try {
    const u = new URL(href, base);
    return (u.protocol === "http:" || u.protocol === "https:") && u.origin !== new URL(base).origin;
  } catch {
    return false;
  }
}

let done = false;

/** One-time shell setup: back button (history back, exit at home), external links in the system browser, splash hide. */
export function setupNative(): void {
  if (done || typeof window === "undefined" || !isNativePlatform()) return;
  done = true;

  const app = nativePlugin<AppPlugin>("App");
  app?.addListener("backButton", () => {
    const atHome = window.location.pathname === "/" || window.location.pathname === "";
    if (!atHome && window.history.length > 1) window.history.back();
    else if (!atHome) window.location.replace(window.location.origin);
    else void app.exitApp();
  });

  const browser = nativePlugin<BrowserPlugin>("Browser");
  document.addEventListener(
    "click",
    (e) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || !browser || e.defaultPrevented) return;
      if (isExternalHref(a.href, window.location.href)) {
        e.preventDefault();
        void browser.open({ url: a.href });
      }
    },
    true,
  );

  void nativePlugin<SplashPlugin>("SplashScreen")?.hide().catch(() => {});
}
