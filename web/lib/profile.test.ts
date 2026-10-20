import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { addAsked, getAsked, resetProfileStore, sanitizeProfile, useProfile } from "@/lib/profile";
import { vocab } from "@/lib/vocab";

afterEach(() => {
  vi.restoreAllMocks();
  resetProfileStore();
  localStorage.clear();
});

describe("useProfile", () => {
  it("sets, counts and clears fields and persists them", () => {
    const { result } = renderHook(() => useProfile());
    expect(result.current.answeredCount).toBe(0);
    act(() => result.current.setField("age", 65));
    act(() => result.current.setField("state", "HR"));
    expect(result.current.profile).toEqual({ age: 65, state: "HR" });
    expect(result.current.answeredCount).toBe(2);
    expect(JSON.parse(localStorage.getItem("haqdar:profile")!)).toEqual({ age: 65, state: "HR" });
    act(() => result.current.clear());
    expect(result.current.profile).toEqual({});
  });

  it("works when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    resetProfileStore();
    const { result } = renderHook(() => useProfile());
    expect(result.current.profile).toEqual({});
    act(() => result.current.setField("gender", "female"));
    expect(result.current.profile).toEqual({ gender: "female" });
    expect(result.current.answeredCount).toBe(1);
  });
});

describe("stale saved answers", () => {
  it("drops values that are no longer valid against the vocabulary", () => {
    expect(sanitizeProfile({ state: "HR", disability: "yes", age: 200, gender: "robot", bogus: 1, bpl: "true", occupation: "farmer" })).toEqual({
      state: "HR",
      occupation: "farmer",
    });
    expect(sanitizeProfile({ disability: "yes_80_plus", age: 40.5 })).toEqual({ disability: "yes_80_plus" });
    expect(sanitizeProfile([1, 2])).toEqual({});
  });

  it("cleans an old saved profile on load and writes back the version", () => {
    localStorage.setItem("haqdar:profile", JSON.stringify({ state: "HR", age: 52, disability: "yes" }));
    resetProfileStore();
    const { result } = renderHook(() => useProfile());
    expect(result.current.profile).toEqual({ state: "HR", age: 52 });
    expect(JSON.parse(localStorage.getItem("haqdar:profile")!)).toEqual({ state: "HR", age: 52 });
    expect(localStorage.getItem("haqdar:profile:vocab")).toBe(vocab.version);
    expect(vocab.version).toBe("2");
  });

  it("stores the vocabulary version with the profile", () => {
    const { result } = renderHook(() => useProfile());
    act(() => result.current.setField("age", 30));
    expect(localStorage.getItem("haqdar:profile:vocab")).toBe(vocab.version);
  });

  it("remembers asked fields and clears them with the profile", () => {
    const { result } = renderHook(() => useProfile());
    addAsked("gender");
    addAsked("gender");
    addAsked("nonsense-field-is-kept-out-on-reload");
    expect(getAsked()).toContain("gender");
    act(() => result.current.clear());
    expect(getAsked()).toEqual([]);
  });
});
