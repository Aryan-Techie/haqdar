import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNativeProvider } from "@/lib/voice/native";
import { isExternalHref } from "@/lib/native";

type W = { Capacitor?: unknown };
const w = window as unknown as W;

function mockCapacitor(plugins: Record<string, unknown>, native = true) {
  w.Capacitor = { isNativePlatform: () => native, Plugins: plugins };
}

const okStt = (over: Record<string, unknown> = {}) => ({
  available: vi.fn().mockResolvedValue({ available: true }),
  checkPermissions: vi.fn().mockResolvedValue({ speechRecognition: "granted" }),
  requestPermissions: vi.fn().mockResolvedValue({ speechRecognition: "granted" }),
  start: vi.fn().mockResolvedValue({ matches: ["sixty five"] }),
  stop: vi.fn().mockResolvedValue(undefined),
  ...over,
});

beforeEach(() => {
  delete w.Capacitor;
  vi.resetModules();
});
afterEach(() => {
  delete w.Capacitor;
});

describe("native voice adapter", () => {
  it("listens with the hi-IN / en-IN locale and returns the transcript", async () => {
    const stt = okStt();
    mockCapacitor({ SpeechRecognition: stt });
    const p = createNativeProvider();
    expect(p.name).toBe("native");
    expect(p.supportsListening()).toBe(true);
    await expect(p.listen("hi")).resolves.toBe("sixty five");
    expect(stt.start).toHaveBeenCalledWith(expect.objectContaining({ language: "hi-IN", partialResults: false }));
    await p.listen("en");
    expect(stt.start).toHaveBeenLastCalledWith(expect.objectContaining({ language: "en-IN" }));
  });

  it("requests permission when not granted and rejects not-allowed when denied", async () => {
    const stt = okStt({
      checkPermissions: vi.fn().mockResolvedValue({ speechRecognition: "prompt" }),
      requestPermissions: vi.fn().mockResolvedValue({ speechRecognition: "denied" }),
    });
    mockCapacitor({ SpeechRecognition: stt });
    await expect(createNativeProvider().listen("en")).rejects.toMatchObject({ code: "not-allowed" });
    expect(stt.requestPermissions).toHaveBeenCalled();
    expect(stt.start).not.toHaveBeenCalled();
  });

  it("maps empty results to no-speech and plugin errors to codes", async () => {
    mockCapacitor({ SpeechRecognition: okStt({ start: vi.fn().mockResolvedValue({ matches: [] }) }) });
    await expect(createNativeProvider().listen("en")).rejects.toMatchObject({ code: "no-speech" });
    mockCapacitor({ SpeechRecognition: okStt({ start: vi.fn().mockRejectedValue(new Error("No match")) }) });
    await expect(createNativeProvider().listen("en")).rejects.toMatchObject({ code: "no-speech" });
    mockCapacitor({ SpeechRecognition: okStt({ available: vi.fn().mockResolvedValue({ available: false }) }) });
    await expect(createNativeProvider().listen("en")).rejects.toMatchObject({ code: "unsupported" });
  });

  it("rejects unsupported and hides the mic when the plugin is missing", async () => {
    mockCapacitor({});
    const p = createNativeProvider();
    expect(p.supportsListening()).toBe(false);
    await expect(p.listen("en")).rejects.toMatchObject({ code: "unsupported" });
  });

  it("speaks via TextToSpeech with the locale, never rejects, and cancel stops both", async () => {
    const tts = { speak: vi.fn().mockResolvedValue(undefined), stop: vi.fn().mockResolvedValue(undefined) };
    const stt = okStt();
    mockCapacitor({ TextToSpeech: tts, SpeechRecognition: stt });
    const p = createNativeProvider();
    await p.speak("namaste", "hi");
    expect(tts.speak).toHaveBeenCalledWith(expect.objectContaining({ text: "namaste", lang: "hi-IN" }));
    tts.speak.mockRejectedValueOnce(new Error("boom"));
    await expect(p.speak("x", "en")).resolves.toBeUndefined();
    p.cancel();
    expect(tts.stop).toHaveBeenCalled();
  });

  it("stopListening stops the recogniser only while listening", async () => {
    let finish: (v: { matches: string[] }) => void = () => {};
    const stt = okStt({ start: vi.fn().mockReturnValue(new Promise((r) => (finish = r))) });
    mockCapacitor({ SpeechRecognition: stt });
    const p = createNativeProvider();
    p.stopListening?.();
    expect(stt.stop).not.toHaveBeenCalled();
    const pending = p.listen("en");
    await vi.waitFor(() => expect(stt.start).toHaveBeenCalled());
    p.stopListening?.();
    expect(stt.stop).toHaveBeenCalledTimes(1);
    finish({ matches: ["yes"] });
    await expect(pending).resolves.toBe("yes");
  });
});

describe("getVoiceProvider selection", () => {
  it("returns the browser provider outside Capacitor", async () => {
    const { getVoiceProvider } = await import("@/lib/voice");
    expect(getVoiceProvider().name).toBe("browser");
  });

  it("returns the native provider inside Capacitor and loads the adapter lazily", async () => {
    const stt = okStt();
    mockCapacitor({ SpeechRecognition: stt });
    const { getVoiceProvider } = await import("@/lib/voice");
    const p = getVoiceProvider();
    expect(p.name).toBe("native");
    expect(p.supportsListening()).toBe(true);
    await expect(p.listen("hi")).resolves.toBe("sixty five");
  });

  it("is not native when Capacitor reports a web platform", async () => {
    mockCapacitor({}, false);
    const { getVoiceProvider } = await import("@/lib/voice");
    expect(getVoiceProvider().name).toBe("browser");
  });
});

describe("isExternalHref", () => {
  const base = "http://10.0.2.2:3000/results";
  it("flags other origins and ignores same-origin, mailto and tel", () => {
    expect(isExternalHref("https://www.india.gov.in/x", base)).toBe(true);
    expect(isExternalHref("/schemes/abc", base)).toBe(false);
    expect(isExternalHref("http://10.0.2.2:3000/a", base)).toBe(false);
    expect(isExternalHref("mailto:a@b.c", base)).toBe(false);
    expect(isExternalHref("tel:100", base)).toBe(false);
  });
});
