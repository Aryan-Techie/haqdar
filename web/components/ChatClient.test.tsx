import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as api from "@/lib/api";
import { clearToken, setToken } from "@/lib/auth";
import { setLang } from "@/lib/i18n";
import { resetProfileStore } from "@/lib/profile";
import { ChatClient } from "@/app/chat/ChatClient";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), evaluate: vi.fn(), putMe: vi.fn().mockResolvedValue({}) }));

const FULL = { state: "UP", age: 30, gender: "female", occupation: "student", income_band: "lt_1l", category: "sc" };

function seed(profile: Record<string, unknown>) {
  localStorage.setItem("haqdar:profile", JSON.stringify(profile));
  resetProfileStore();
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
  sessionStorage.clear();
  push.mockReset();
  vi.mocked(api.evaluate).mockReset();
  vi.mocked(api.putMe).mockClear();
  setLang("en");
});
afterEach(() => {
  cleanup();
  clearToken();
  localStorage.clear();
  resetProfileStore();
});

describe("ChatClient", () => {
  it("on a 422 names the dropped answers, shows Start over and removes them", async () => {
    // Only the server (not the web sanitizer) knows this value is bad here: simulate with a valid-looking one.
    seed({ ...FULL, bpl: true });
    vi.mocked(api.evaluate).mockRejectedValueOnce(
      new api.ApiError(422, JSON.stringify([{ loc: ["body", "profile", "bpl"], msg: "bad" }])),
    );
    render(<ChatClient />);
    fireEvent.click(screen.getByRole("button", { name: "Use my saved details" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/no longer valid/));
    expect(screen.getByRole("button", { name: "Start over" })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("haqdar:profile")!).bpl).toBeUndefined();
    expect(push).not.toHaveBeenCalled();
  });

  it("signed in: saves the answers to the server when the chat finishes", async () => {
    setToken("tok");
    seed(FULL);
    vi.mocked(api.evaluate).mockResolvedValue({ results: [], next_fields: [], coverage: { state: "UP", has_state_schemes: false } });
    render(<ChatClient />);
    fireEvent.click(screen.getByRole("button", { name: "Use my saved details" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/results"));
    expect(api.putMe).toHaveBeenCalledWith(FULL, "en");
    const stored = JSON.parse(sessionStorage.getItem("haqdar:results")!);
    expect(stored.profile).toEqual(FULL);
  });

  it("signed out: does not call putMe", async () => {
    seed(FULL);
    vi.mocked(api.evaluate).mockResolvedValue({ results: [], next_fields: [], coverage: { state: "UP", has_state_schemes: false } });
    render(<ChatClient />);
    fireEvent.click(screen.getByRole("button", { name: "Use my saved details" }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(api.putMe).not.toHaveBeenCalled();
  });
});
