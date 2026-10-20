import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SchemeCard } from "./SchemeCard";
import { setLang } from "@/lib/i18n";
import { makeResult, makeScheme } from "./test-fixtures";

afterEach(() => {
  cleanup();
  setLang("en");
});

describe("SchemeCard", () => {
  it("shows verdict chip, source host and a why line for eligible", () => {
    render(<SchemeCard scheme={makeScheme()} result={makeResult()} />);
    expect(screen.getByText("Eligible")).toBeTruthy();
    expect(screen.getByText(/pmkisan\.gov\.in/)).toBeTruthy();
    expect(screen.getByText(/Matches your occupation/)).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/schemes/pm-kisan");
  });

  it("lists missing fields for maybe, in English", () => {
    const r = makeResult({ verdict: "maybe", unknown_fields: ["land_acres", "income_band"], reason: { code: "missing_info", detail: "" } });
    render(<SchemeCard scheme={makeScheme()} result={r} />);
    expect(screen.getByText("Maybe")).toBeTruthy();
    expect(screen.getByText(/We still need: land owned, household income/)).toBeTruthy();
  });

  it("lists missing fields in Hindi", () => {
    setLang("hi");
    const r = makeResult({ verdict: "maybe", unknown_fields: ["income_band"], reason: { code: "missing_info", detail: "" } });
    render(<SchemeCard scheme={makeScheme()} result={r} />);
    expect(screen.getByText("पीएम-किसान")).toBeTruthy();
    expect(screen.getByText(/घर की आमदनी/)).toBeTruthy();
    expect(screen.getByText("शायद पात्र")).toBeTruthy();
  });

  it("shows the plain reason for ineligible", () => {
    const r = makeResult({
      verdict: "ineligible",
      passed: [],
      failed: [{ field: "age", op: "gte", value: 60 }],
      reason: { code: "rule_failed", detail: "" },
    });
    render(<SchemeCard scheme={makeScheme()} result={r} />);
    expect(screen.getByText("Not eligible")).toBeTruthy();
    expect(screen.getByText(/Does not match your age/)).toBeTruthy();
  });

  it("explains state_unavailable", () => {
    const r = makeResult({ verdict: "ineligible", passed: [], reason: { code: "state_unavailable", detail: "" } });
    render(<SchemeCard scheme={makeScheme()} result={r} />);
    expect(screen.getByText(/Not available in your state yet/)).toBeTruthy();
  });

  it("calls onSave without navigating", () => {
    const onSave = vi.fn();
    render(<SchemeCard scheme={makeScheme()} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /Save PM-KISAN/ }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
