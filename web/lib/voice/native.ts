import { nativePlugin } from "@/lib/native";
import { speechLocale, VoiceError, type VoiceErrorCode, type VoiceProvider } from "@/lib/voice/types";
import type { LangCode } from "@/lib/types";

// Shapes of @capacitor-community/speech-recognition and @capacitor-community/text-to-speech (reached through window.Capacitor).
interface SpeechRecognitionPlugin {
  available(): Promise<{ available: boolean }>;
  checkPermissions(): Promise<{ speechRecognition: string }>;
  requestPermissions(): Promise<{ speechRecognition: string }>;
  start(opts: { language?: string; maxResults?: number; prompt?: string; partialResults?: boolean; popup?: boolean }): Promise<{ matches?: string[] }>;
  stop(): Promise<void>;
  removeAllListeners?(): Promise<void>;
}
interface TextToSpeechPlugin {
  speak(opts: { text: string; lang?: string; rate?: number; pitch?: number; volume?: number; category?: string; queueStrategy?: number }): Promise<void>;
  stop(): Promise<void>;
}

function mapError(e: unknown): VoiceError {
  if (e instanceof VoiceError) return e;
  const msg = String((e as { message?: unknown } | null)?.message ?? e ?? "").toLowerCase();
  let code: VoiceErrorCode = "unknown";
  if (msg.includes("permission") || msg.includes("denied") || msg.includes("not-allowed")) code = "not-allowed";
  else if (msg.includes("no match") || msg.includes("no speech") || msg.includes("speech timeout") || msg.includes("didn't understand")) code = "no-speech";
  else if (msg.includes("network")) code = "network";
  else if (msg.includes("not available") || msg.includes("unavailable") || msg.includes("not supported")) code = "unsupported";
  else if (msg.includes("cancel") || msg.includes("abort") || msg.includes("stopped")) code = "aborted";
  return new VoiceError(code, msg || code);
}

/** Native speech via Capacitor plugins. Plugins are resolved lazily so importing this module anywhere is safe. */
export function createNativeProvider(): VoiceProvider {
  let listening = false;
  let cancelled = false;
  let permitted = false;

  const stt = () => nativePlugin<SpeechRecognitionPlugin>("SpeechRecognition");
  const tts = () => nativePlugin<TextToSpeechPlugin>("TextToSpeech");

  async function ensurePermission(p: SpeechRecognitionPlugin): Promise<void> {
    if (permitted) return;
    let state = (await p.checkPermissions()).speechRecognition;
    if (state !== "granted") state = (await p.requestPermissions()).speechRecognition;
    if (state !== "granted") throw new VoiceError("not-allowed");
    permitted = true;
  }

  return {
    name: "native",
    supportsListening: () => stt() !== undefined,

    async listen(lang: LangCode) {
      const p = stt();
      if (!p) throw new VoiceError("unsupported");
      cancelled = false;
      try {
        if (!(await p.available()).available) throw new VoiceError("unsupported");
        await ensurePermission(p);
        if (cancelled) throw new VoiceError("aborted");
        listening = true;
        const res = await p.start({ language: speechLocale(lang), maxResults: 1, partialResults: false, popup: false });
        const heard = (res.matches ?? []).join(" ").trim();
        if (cancelled) throw new VoiceError("aborted");
        if (!heard) throw new VoiceError("no-speech");
        return heard;
      } catch (e) {
        throw mapError(e);
      } finally {
        listening = false;
      }
    },

    stopListening() {
      if (listening) void stt()?.stop().catch(() => {});
    },

    async speak(text: string, lang: LangCode) {
      const p = tts();
      if (!p || !text) return;
      try {
        await p.speak({ text, lang: speechLocale(lang), rate: 1, pitch: 1, volume: 1, category: "ambient" });
      } catch {
        // Speech output is best effort; the chat works without it.
      }
    },

    cancel() {
      cancelled = true;
      if (listening) void stt()?.stop().catch(() => {});
      void tts()?.stop().catch(() => {});
    },
  };
}
