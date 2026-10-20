import { describe, expect, it } from "vitest";
import { localize, t } from "@/lib/i18n";
import { dictionary } from "@/lib/strings";

describe("localize", () => {
  it("returns the requested language", () => {
    expect(localize({ en: "Pension", hi: "पेंशन" }, "hi")).toBe("पेंशन");
  });
  it("falls back to English when hi is missing", () => {
    expect(localize({ en: "Pension" }, "hi")).toBe("Pension");
  });
});

describe("t", () => {
  it("looks up nested keys", () => {
    expect(t("nav.home", "en")).toBe("Home");
    expect(t("nav.home", "hi")).toBe("होम");
  });
  it("falls back to English when a key is missing in Hindi", () => {
    const en = dictionary.en as Record<string, Record<string, string>>;
    en.testonly = { onlyEn: "English only" };
    expect(t("testonly.onlyEn", "hi")).toBe("English only");
    delete en.testonly;
  });
  it("returns the key itself when unknown everywhere", () => {
    expect(t("nope.missing", "en")).toBe("nope.missing");
  });
  it("has Hindi for every English key", () => {
    const walk = (a: unknown, b: unknown, path: string): string[] => {
      if (typeof a === "string") return typeof b === "string" ? [] : [path];
      return Object.keys(a as object).flatMap((k) =>
        walk((a as Record<string, unknown>)[k], (b as Record<string, unknown> | undefined)?.[k], `${path}.${k}`),
      );
    };
    expect(walk(dictionary.en, dictionary.hi, "")).toEqual([]);
  });
});
