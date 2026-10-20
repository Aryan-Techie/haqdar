import { createBrowserProvider } from "@/lib/voice/browser";
import { createSlngProvider } from "@/lib/voice/slng";
import { VoiceError, type VoiceProvider } from "@/lib/voice/types";
import { isNativePlatform } from "@/lib/native";
import type { LangCode } from "@/lib/types";

export type { VoiceProvider } from "@/lib/voice/types";
export { VoiceError } from "@/lib/voice/types";

/** SLNG first, with a graceful fall back to the browser when the server is not configured or the platform cannot record. */
function withBrowserFallback(primary: VoiceProvider, fallback: VoiceProvider): VoiceProvider {
  let usingFallback = false;
  const current = () => (usingFallback ? fallback : primary);
  return {
    name: primary.name,
    supportsListening: () => primary.supportsListening() || fallback.supportsListening(),
    async listen(lang: LangCode) {
      if (!usingFallback && primary.supportsListening()) {
        try {
          return await primary.listen(lang);
        } catch (e) {
          if (!(e instanceof VoiceError) || e.code !== "not-configured") throw e;
          usingFallback = true;
        }
      }
      return fallback.listen(lang);
    },
    stopListening: () => current().stopListening?.(),
    async speak(text: string, lang: LangCode) {
      if (!usingFallback) {
        try {
          return await primary.speak(text, lang);
        } catch (e) {
          if (e instanceof VoiceError && e.code === "aborted") return;
          usingFallback = true;
        }
      }
      return fallback.speak(text, lang);
    },
    cancel() {
      primary.cancel();
      fallback.cancel();
    },
  };
}

/**
 * Inside the Capacitor shell: native speech. The adapter module is loaded by dynamic import on first use, so the plain web
 * bundle only carries this thin wrapper. `supportsListening` must be synchronous, so it only asks whether we are native.
 */
function lazyNativeProvider(): VoiceProvider {
  let loaded: Promise<VoiceProvider> | null = null;
  const load = () => (loaded ??= import("@/lib/voice/native").then((m) => m.createNativeProvider()));
  let inner: VoiceProvider | null = null;
  void load().then((p) => (inner = p));
  return {
    name: "native",
    supportsListening: () => isNativePlatform(),
    listen: async (lang) => (await load()).listen(lang),
    stopListening: () => inner?.stopListening?.(),
    speak: async (text, lang) => (await load()).speak(text, lang),
    cancel: () => inner?.cancel(),
  };
}

let instance: VoiceProvider | null = null;

/** Native inside the Capacitor shell; otherwise chosen by NEXT_PUBLIC_VOICE_PROVIDER ("browser" default, or "slng"). Created lazily, so it is safe to import on the server. */
export function getVoiceProvider(): VoiceProvider {
  if (!instance) {
    const browser = createBrowserProvider();
    if (isNativePlatform()) return (instance = lazyNativeProvider());
    instance = process.env.NEXT_PUBLIC_VOICE_PROVIDER === "slng" ? withBrowserFallback(createSlngProvider(), browser) : browser;
  }
  return instance;
}
