import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import * as api from "@/lib/api";
import { setLang } from "@/lib/i18n";
import { resetProfileStore, setAsked } from "@/lib/profile";
import { saveResults } from "@/lib/results";
import ResultsPage from "@/app/results/page";
import type { EvaluateResponse } from "@/lib/types";
import { makeScheme } from "./test-fixtures";

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getSchemes: vi.fn(),
  evaluate: vi.fn(),
}));

const FULL = { state: "UP", age: 30, gender: "female", occupation: "student", income_band: "lt_1l", category: "sc" };
const FIXED = Object.keys(FULL);
const resp = (next_fields: string[]): EvaluateResponse => ({
  results: [{ scheme_id: "pm-kisan", verdict: "eligible", rank: 1, passed: [], failed: [], unknown_fields: [], reason: { code: "all_rules_pass", detail: "" }, rule_version: "1", source_url: "https://x.gov.in", profile_hash: "h" }],
  next_fields,
  coverage: { state: "UP", has_state_schemes: true },
}) as unknown as EvaluateResponse;

function seed(profile: Record<string, unknown>, next: string[], asked: string[]) {
  localStorage.setItem("haqdar:profile", JSON.stringify(profile));
  resetProfileStore();
  setAsked(asked);
  saveResults(resp(next), profile);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setLang("en");
  vi.mocked(api.getSchemes).mockResolvedValue([makeScheme()]);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  resetProfileStore();
});

describe("Results page", () => {
  it("offers the questions still allowed and links straight to the extras", async () => {
    seed(FULL, ["land_band", "bpl", "residence"], FIXED);
    render(<ResultsPage />);
    const btn = await screen.findByRole("link", { name: "Answer 2 more questions" });
    expect(btn.getAttribute("href")).toBe("/chat?extras=1");
  });

  it("does not count skipped questions and hides the button at the cap", async () => {
    seed(FULL, ["land_band", "bpl"], [...FIXED, "land_band"]);
    const { unmount } = render(<ResultsPage />);
    expect(await screen.findByRole("link", { name: "Answer 1 more question" })).toBeTruthy();
    unmount();
    cleanup();
    seed(FULL, ["land_band", "bpl"], [...FIXED, "land_band", "bpl"]);
    render(<ResultsPage />);
    await waitFor(() => expect(screen.getByRole("tablist")).toBeTruthy());
    expect(screen.queryByRole("link", { name: /more question/ })).toBeNull();
  });

  it("re-evaluates instead of showing results that belong to an older profile", async () => {
    seed(FULL, [], FIXED);
    localStorage.setItem("haqdar:profile", JSON.stringify({ ...FULL, occupation: "farmer" }));
    resetProfileStore();
    vi.mocked(api.evaluate).mockResolvedValue({ ...resp([]), results: [] });
    render(<ResultsPage />);
    expect(screen.getByRole("status").textContent).toMatch(/Updating your results/);
    await waitFor(() => expect(api.evaluate).toHaveBeenCalled());
    expect(vi.mocked(api.evaluate).mock.calls[0][0]).toEqual({ ...FULL, occupation: "farmer" });
  });
});
