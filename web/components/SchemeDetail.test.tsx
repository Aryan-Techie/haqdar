import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { reportProblemHref, SchemeDetail } from "./SchemeDetail";
import { setLang } from "@/lib/i18n";
import { clearToken, setToken } from "@/lib/auth";
import { signInSheet } from "@/components/SignInSheet";
import * as api from "@/lib/api";
import { makeResult, makeScheme } from "./test-fixtures";

vi.mock("@/lib/api", () => ({
  getSaved: vi.fn().mockResolvedValue([]),
  saveScheme: vi.fn().mockResolvedValue(undefined),
  unsaveScheme: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  clearToken();
  setLang("en");
});

describe("SchemeDetail", () => {
  it("shows Verification pending for sourced records and not for hand_verified", () => {
    const { unmount } = render(<SchemeDetail scheme={makeScheme()} />);
    expect(screen.getAllByText("Verification pending").length).toBeGreaterThan(0);
    unmount();
    render(<SchemeDetail scheme={makeScheme({ verification: { status: "hand_verified", hi_reviewed: true } })} />);
    expect(screen.queryByText("Verification pending")).toBeNull();
  });

  it("hides the reminder control when deadline is null and shows it otherwise", () => {
    const { unmount } = render(<SchemeDetail scheme={makeScheme({ deadline: null })} />);
    expect(screen.queryByText("Add reminder")).toBeNull();
    expect(screen.getByText("No deadline listed")).toBeTruthy();
    unmount();
    render(<SchemeDetail scheme={makeScheme({ deadline: "2027-03-31" })} />);
    expect(screen.getByText("Add reminder")).toBeTruthy();
    expect(screen.getByText(/31 Mar 2027/)).toBeTruthy();
  });

  it("renders banners from the stored verdict, neutral without one", () => {
    const { unmount } = render(<SchemeDetail scheme={makeScheme()} />);
    expect(screen.getByText("Check whether you qualify")).toBeTruthy();
    unmount();
    render(<SchemeDetail scheme={makeScheme()} result={makeResult()} />);
    expect(screen.getByText("You are eligible")).toBeTruthy();
  });

  it("marks must-have documents and links the kit and source", () => {
    render(<SchemeDetail scheme={makeScheme()} />);
    fireEvent.click(screen.getByRole("button", { name: "Documents" }));
    expect(screen.getByText("Must have")).toBeTruthy();
    expect(screen.getByText("If applicable")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Get my kit" }).getAttribute("href")).toBe("/kit/pm-kisan");
    expect(screen.getByRole("link", { name: /pmkisan\.gov\.in/ }).getAttribute("href")).toContain("pmkisan.gov.in");
    expect(screen.getByText(/Last verified 20 Oct 2026/)).toBeTruthy();
  });

  it("opens the sign-in sheet when saving without a token and does not save if declined", async () => {
    const open = vi.spyOn(signInSheet, "open").mockResolvedValue(false);
    render(<SchemeDetail scheme={makeScheme()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(api.saveScheme).not.toHaveBeenCalled();
  });

  it("saves after sign-in succeeds", async () => {
    vi.spyOn(signInSheet, "open").mockImplementation(async () => {
      setToken("tok");
      return true;
    });
    render(<SchemeDetail scheme={makeScheme()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.saveScheme).toHaveBeenCalledWith("pm-kisan"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Saved" })).toBeTruthy());
  });

  it("falls back to copying the link when Web Share is missing", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    render(<SchemeDetail scheme={makeScheme()} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(await screen.findByText("Link copied")).toBeTruthy();
  });

  it("has a Report a problem mailto link with no recipient and the scheme facts", () => {
    const scheme = makeScheme();
    render(<SchemeDetail scheme={scheme} />);
    const link = screen.getByRole("link", { name: "Report a problem" }) as HTMLAnchorElement;
    const href = link.getAttribute("href")!;
    expect(href.startsWith("mailto:?subject=")).toBe(true);
    expect(href).toBe(reportProblemHref(scheme));
    const params = new URLSearchParams(href.slice("mailto:?".length));
    expect(params.get("subject")).toContain("pm-kisan");
    const body = params.get("body")!;
    expect(body).toContain("Scheme id: pm-kisan");
    expect(body).toContain("PM-KISAN");
    expect(body).toContain(scheme.source_url);
    expect(body).toContain("Last verified: 2026-10-20");
  });
});
