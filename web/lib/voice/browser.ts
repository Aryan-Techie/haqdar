import { speechLocale, VoiceError, type VoiceErrorCode, type VoiceProvider } from "@/lib/voice/types";
import type { LangCode } from "@/lib/types";

// Minimal Web Speech API typings (not in lib.dom for all targets).
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

// All window access is lazy so importing this module on the server is safe.
function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis;
}

const ERROR_CODES: Record<string, VoiceErrorCode> = {
  "not-allowed": "not-allowed",
  "service-not-allowed": "not-allowed",
  "no-speech": "no-speech",
  "audio-capture": "unsupported",
  aborted: "aborted",
  network: "network",
  "language-not-supported": "unsupported",
};

export function createBrowserProvider(): VoiceProvider {
  let active: Recognition | null = null;

  return {
    name: "browser",
    supportsListening: () => recognitionCtor() !== null,

    listen(lang: LangCode) {
      const Ctor = recognitionCtor();
      if (!Ctor) return Promise.reject(new VoiceError("unsupported"));
      active?.abort();
      return new Promise<string>((resolve, reject) => {
        const rec = new Ctor();
        active = rec;
        rec.lang = speechLocale(lang);
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        rec.continuous = false;
        let heard = "";
        let failed = false;
        rec.onresult = (e) => {
          heard = Array.from(e.results)
            .map((r) => r[0].transcript)
            .join(" ")
            .trim();
        };
        rec.onerror = (e) => {
          failed = true;
          reject(new VoiceError(ERROR_CODES[e.error] ?? "unknown", e.error));
        };
        rec.onend = () => {
          if (active === rec) active = null;
          if (failed) return;
          if (heard) resolve(heard);
          else reject(new VoiceError("no-speech"));
        };
        try {
          rec.start();
        } catch {
          failed = true;
          active = null;
          reject(new VoiceError("unknown"));
        }
      });
    },

    stopListening() {
      active?.stop();
    },

    speak(text: string, lang: LangCode) {
      const s = synth();
      if (!s || typeof SpeechSynthesisUtterance === "undefined") return Promise.resolve();
      return new Promise<void>((resolve) => {
        s.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const locale = speechLocale(lang);
        u.lang = locale;
        const voice = s.getVoices().find((v) => v.lang.replace("_", "-").toLowerCase() === locale.toLowerCase());
        if (voice) u.voice = voice;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        s.speak(u);
      });
    },

    cancel() {
      active?.abort();
      active = null;
      synth()?.cancel();
    },
  };
}
