import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import * as api from "@/lib/api";
import { resetProfileStore, useProfile } from "@/lib/profile";
import { parseResults, RESULTS_KEY, saveResults, sameProfile, useMatchingResults, useResults } from "@/lib/results";
import { vocab } from "@/lib/vocab";
import type { EvaluateResponse } from "@/lib/types";

vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), evaluate: vi.fn() }));

const response = (tag: string): EvaluateResponse => ({
  results: [{ scheme_id: tag, verdict: "eligible" } as never],
  next_fields: [],
  coverage: { state: "HR", has_state_schemes: true },
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetProfileStore();
  vi.mocked(api.evaluate).mockReset();
});
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetProfileStore();
});

describe("parseResults", () => {
  it("drops old-shape or malformed values instead of crashing", () => {
    expect(parseResults(JSON.stringify({ results: [{ scheme_id: "pm-kisan", verdict: "eligible" }] }))).toBeNull();
    expect(parseResults(JSON.stringify({ results: [], next_fields: [], coverage: {} }))).toBeNull();
    expect(parseResults("{")).toBeNull();
    expect(parseResults(null)).toBeNull();
  });
  it("accepts what saveResults writes", () => {
    saveResults(response("a"), { state: "HR" }, ["pension"]);
    const back = parseResults(sessionStorage.getItem(RESULTS_KEY));
    expect(back?.profile).toEqual({ state: "HR" });
    expect(back?.interests).toEqual(["pension"]);
    expect(back?.vocab_version).toBe(vocab.version);
  });
});

describe("sameProfile", () => {
  it("ignores key order and empty values", () => {
    expect(sameProfile({ age: 3, state: "HR" }, { state: "HR", age: 3 })).toBe(true);
    expect(sameProfile({ age: 3 }, { age: 4 })).toBe(false);
  });
});

describe("stale results", () => {
  it("serves stored results when the profile is unchanged, without a request", () => {
    localStorage.setItem("haqdar:profile", JSON.stringify({ state: "HR", occupation: "farmer" }));
    resetProfileStore();
    saveResults(response("farmer"), { state: "HR", occupation: "farmer" });
    const { result } = renderHook(() => useResults());
    expect(result.current.status).toBe("ready");
    expect(result.current.results?.results[0].scheme_id).toBe("farmer");
    expect(api.evaluate).not.toHaveBeenCalled();
  });

  it("recomputes after the profile changes and never shows the stale evaluation", async () => {
    localStorage.setItem("haqdar:profile", JSON.stringify({ state: "HR", occupation: "farmer" }));
    resetProfileStore();
    saveResults(response("farmer"), { state: "HR", occupation: "farmer" });
    vi.mocked(api.evaluate).mockResolvedValue(response("student"));
    const { result } = renderHook(() => ({ r: useResults(), p: useProfile(), m: useMatchingResults() }));
    expect(result.current.r.status).toBe("ready");

    act(() => result.current.p.setField("occupation", "student"));
    expect(result.current.r.results).toBeNull(); // stale evaluation is not exposed
    expect(result.current.m).toBeNull();
    await waitFor(() => expect(result.current.r.status).toBe("ready"));
    expect(result.current.r.results?.results[0].scheme_id).toBe("student");
    expect(api.evaluate).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.evaluate).mock.calls[0][0]).toEqual({ state: "HR", occupation: "student" });
  });

  it("recomputes when the stored results come from another vocabulary version", async () => {
    localStorage.setItem("haqdar:profile", JSON.stringify({ state: "HR" }));
    resetProfileStore();
    sessionStorage.setItem(RESULTS_KEY, JSON.stringify({ ...response("old"), profile: { state: "HR" }, interests: [], vocab_version: "1" }));
    vi.mocked(api.evaluate).mockResolvedValue(response("new"));
    const { result } = renderHook(() => useResults());
    expect(result.current.results).toBeNull();
    await waitFor(() => expect(result.current.results?.results[0].scheme_id).toBe("new"));
  });

  it("reports an error and can retry", async () => {
    localStorage.setItem("haqdar:profile", JSON.stringify({ state: "HR" }));
    resetProfileStore();
    vi.mocked(api.evaluate).mockRejectedValueOnce(new api.ApiError(0, "network")).mockResolvedValue(response("ok"));
    const { result } = renderHook(() => useResults());
    await waitFor(() => expect(result.current.status).toBe("error"));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });

  it("has nothing to show for an empty profile", () => {
    saveResults(response("x"), { state: "HR" });
    const { result } = renderHook(() => useResults());
    expect(result.current.status).toBe("none");
    expect(api.evaluate).not.toHaveBeenCalled();
  });
});
