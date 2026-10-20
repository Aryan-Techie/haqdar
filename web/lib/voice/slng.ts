import { speechLocale, VoiceError, type VoiceProvider } from "@/lib/voice/types";
import type { LangCode } from "@/lib/types";

const MAX_RECORD_MS = 8000;

function canRecord(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

async function failure(res: Response): Promise<VoiceError> {
  if (res.status === 503) return new VoiceError("not-configured", "voice provider not configured");
  return new VoiceError(res.status === 0 ? "network" : "unknown", `voice request failed (${res.status})`);
}

/**
 * Records with MediaRecorder and posts to our API's /voice/stt; speaks via /voice/tts. The API proxies SLNG with the key held
 * server-side and answers 503 until it is configured (surfaced as VoiceError "not-configured").
 */
export function createSlngProvider(): VoiceProvider {
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let audio: HTMLAudioElement | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;

  const release = () => {
    clearTimeout(timer);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    recorder = null;
  };

  return {
    name: "slng",
    supportsListening: canRecord,

    async listen(lang: LangCode) {
      if (!canRecord()) throw new VoiceError("unsupported");
      cancelled = false;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        throw new VoiceError("not-allowed");
      }
      const media = stream;
      const blob = await new Promise<Blob>((resolve, reject) => {
        const chunks: BlobPart[] = [];
        const rec = new MediaRecorder(media);
        recorder = rec;
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onerror = () => reject(new VoiceError("unknown"));
        rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
        rec.start();
        timer = setTimeout(() => rec.state === "recording" && rec.stop(), MAX_RECORD_MS);
      });
      release();
      if (cancelled || blob.size === 0) throw new VoiceError(cancelled ? "aborted" : "no-speech");

      const body = new FormData();
      body.append("audio", blob, "answer.webm");
      body.append("lang", speechLocale(lang));
      let res: Response;
      try {
        res = await fetch("/api/voice/stt", { method: "POST", body });
      } catch {
        throw new VoiceError("network");
      }
      if (!res.ok) throw await failure(res);
      const { text } = (await res.json()) as { text?: string };
      if (!text?.trim()) throw new VoiceError("no-speech");
      return text.trim();
    },

    stopListening() {
      if (recorder?.state === "recording") recorder.stop();
    },

    async speak(text: string, lang: LangCode) {
      if (typeof window === "undefined") return;
      let res: Response;
      try {
        res = await fetch("/api/voice/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, lang: speechLocale(lang) }),
        });
      } catch {
        throw new VoiceError("network");
      }
      if (!res.ok) throw await failure(res);
      const url = URL.createObjectURL(await res.blob());
      await new Promise<void>((resolve) => {
        audio?.pause();
        const a = new Audio(url);
        audio = a;
        const done = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        a.onended = done;
        a.onerror = done;
        a.play().catch(done);
      });
    },

    cancel() {
      cancelled = true;
      if (recorder?.state === "recording") recorder.stop();
      else release();
      audio?.pause();
      audio = null;
    },
  };
}
