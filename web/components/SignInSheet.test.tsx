import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, requestOtp: vi.fn(), verifyOtp: vi.fn(), putMe: vi.fn(), getMe: vi.fn() };
});
vi.mock("@/lib/auth", () => ({ setToken: vi.fn(), getToken: vi.fn(() => null), clearToken: vi.fn() }));

import * as api from "@/lib/api";
import { setToken } from "@/lib/auth";
import { setLang } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { CONSENT_VERSION, SignInSheet } from "./SignInSheet";

async function reachCodeStep(onResult = vi.fn()) {
  render(<SignInSheet onResult={onResult} />);
  fireEvent.change(screen.getByLabelText(t("account.phone", "en")), { target: { value: "9876543210" } });
  fireEvent.click(screen.getByRole("button", { name: t("account.sendCode", "en") }));
  await screen.findByLabelText(t("account.code", "en"));
  return onResult;
}

beforeEach(() => {
  setLang("en");
  vi.mocked(api.requestOtp).mockResolvedValue({ sent: true });
  vi.mocked(api.putMe).mockResolvedValue({});
  vi.mocked(api.getMe).mockResolvedValue({ id: 1, phone: "1", profile: {}, language: null });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SignInSheet", () => {
  it("keeps Verify disabled until consent is ticked", async () => {
    await reachCodeStep();
    fireEvent.change(screen.getByLabelText(t("account.code", "en")), { target: { value: "123456" } });
    const verify = screen.getByRole("button", { name: t("account.verify", "en") });
    expect((verify as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect((verify as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(new RegExp(CONSENT_VERSION))).toBeTruthy();
  });

  it("shows the error text on a wrong code and does not store a token", async () => {
    vi.mocked(api.verifyOtp).mockRejectedValue(new api.ApiError(401, "invalid code"));
    const onResult = await reachCodeStep();
    fireEvent.change(screen.getByLabelText(t("account.code", "en")), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: t("account.verify", "en") }));
    expect((await screen.findByRole("alert")).textContent).toContain(t("account.wrongCode", "en"));
    expect(setToken).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
  });

  it("stores the token with consent, syncs the profile and resolves true", async () => {
    vi.mocked(api.verifyOtp).mockResolvedValue({ token: "tok", user: { id: 1, phone: "9876543210" } });
    const onResult = await reachCodeStep();
    fireEvent.change(screen.getByLabelText(t("account.code", "en")), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: t("account.verify", "en") }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    expect(api.verifyOtp).toHaveBeenCalledWith("9876543210", "123456", { version: CONSENT_VERSION, accepted: true });
    expect(setToken).toHaveBeenCalledWith("tok");
  });

  it("shows the dev hint only when the API sends one", async () => {
    vi.mocked(api.requestOtp).mockResolvedValue({ sent: true, dev_hint: "123456" } as { sent: boolean });
    await reachCodeStep();
    expect(screen.getByText(/123456/)).toBeTruthy();
  });

  it("does not show a dev hint when the API sends none", async () => {
    await reachCodeStep();
    expect(screen.queryByText(/123456/)).toBeNull();
  });
});
