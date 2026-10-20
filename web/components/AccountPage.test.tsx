import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, getMe: vi.fn(), putMe: vi.fn() };
});

import * as api from "@/lib/api";
import { setLang, t } from "@/lib/i18n";
import AccountPage from "@/app/account/page";

beforeEach(() => {
  setLang("en");
  localStorage.setItem("haqdar:token", "tok");
  localStorage.setItem("haqdar:profile", JSON.stringify({ age: 40 }));
  localStorage.setItem("haqdar:results", JSON.stringify({ results: [] }));
  localStorage.setItem("haqdar:saved", JSON.stringify(["pm-kisan"]));
  vi.mocked(api.getMe).mockResolvedValue({ id: 1, phone: "9876543210", profile: {}, language: null });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe("Account sign-out", () => {
  it("Sign out keeps the profile and saved results on this device", async () => {
    render(<AccountPage />);
    fireEvent.click(await screen.findByRole("button", { name: t("account.signOut", "en") }));
    await waitFor(() => expect(localStorage.getItem("haqdar:token")).toBeNull());
    expect(localStorage.getItem("haqdar:profile")).not.toBeNull();
    expect(localStorage.getItem("haqdar:results")).not.toBeNull();
    expect(localStorage.getItem("haqdar:saved")).not.toBeNull();
  });

  it("Sign out and clear this device removes profile, results, saved and token", async () => {
    render(<AccountPage />);
    fireEvent.click(await screen.findByRole("button", { name: t("account.signOutClear", "en") }));
    await waitFor(() => expect(localStorage.getItem("haqdar:token")).toBeNull());
    for (const k of ["haqdar:profile", "haqdar:results", "haqdar:saved"]) expect(localStorage.getItem(k)).toBeNull();
  });
});
