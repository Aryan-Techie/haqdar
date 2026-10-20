import type { LangCode } from "@/lib/types";

export interface VoiceProvider {
  name: "browser" | "slng" | "native";
  /** False when the platform cannot capture speech (the mic is then hidden and typing works). */
  supportsListening(): boolean;
  /** Resolves with the transcript. Rejects with a VoiceError (`code`) on failure. */
  listen(lang: LangCode): Promise<string>;
  /** Ends the current listen early so it resolves with what was heard (no-op when idle). */
  stopListening?(): void;
  /** Speaks aloud. Resolves when finished; never rejects for unsupported platforms. */
  speak(text: string, lang: LangCode): Promise<void>;
  /** Stops listening and speaking immediately. */
  cancel(): void;
}

export type VoiceErrorCode = "not-allowed" | "no-speech" | "aborted" | "unsupported" | "not-configured" | "network" | "unknown";

export class VoiceError extends Error {
  code: VoiceErrorCode;
  constructor(code: VoiceErrorCode, message?: string) {
    super(message ?? code);
    this.name = "VoiceError";
    this.code = code;
  }
}

export const speechLocale = (lang: LangCode): string => (lang === "hi" ? "hi-IN" : "en-IN");
