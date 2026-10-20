import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ getMe: vi.fn(), putMe: vi.fn() }));

import * as api from "@/lib/api";
import { getProfile, resetProfileStore, syncProfileOnSignIn } from "./profile";

const seed = (p: object) => localStorage.setItem("haqdar:profile", JSON.stringify(p));
const me = (profile: object) => ({ id: 1, phone: "1", profile, language: null }) as never;

beforeEach(() => {
  localStorage.clear();
  resetProfileStore();
  vi.mocked(api.putMe).mockResolvedValue({});
});
afterEach(() => vi.clearAllMocks());

describe("syncProfileOnSignIn", () => {
  it("loads the server profile when local is empty", async () => {
    vi.mocked(api.getMe).mockResolvedValue(me({ state: "UP", age: 30 }));
    await syncProfileOnSignIn("en");
    expect(getProfile()).toEqual({ state: "UP", age: 30 });
    expect(api.putMe).not.toHaveBeenCalled();
  });

  it("merges with local winning and PUTs when both have fields", async () => {
    seed({ age: 41 });
    resetProfileStore();
    vi.mocked(api.getMe).mockResolvedValue(me({ state: "UP", age: 30 }));
    await syncProfileOnSignIn("hi");
    expect(getProfile()).toEqual({ state: "UP", age: 41 });
    expect(api.putMe).toHaveBeenCalledWith({ state: "UP", age: 41 }, "hi");
  });

  it("PUTs local when the server profile is empty", async () => {
    seed({ age: 41 });
    resetProfileStore();
    vi.mocked(api.getMe).mockResolvedValue(me({}));
    await syncProfileOnSignIn("en");
    expect(getProfile()).toEqual({ age: 41 });
    expect(api.putMe).toHaveBeenCalledWith({ age: 41 }, "en");
  });
});
