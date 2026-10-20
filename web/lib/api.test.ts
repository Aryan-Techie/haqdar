import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, downloadKit, evaluate, invalidFields } from "@/lib/api";

afterEach(() => vi.unstubAllGlobals());

describe("api.evaluate", () => {
  it("posts the profile to /api/evaluate", async () => {
    const body = { results: [], next_fields: [], coverage: { state: "HR", has_state_schemes: true } };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await evaluate({ age: 65, state: "HR" }, ["pension"]);
    expect(out).toEqual(body);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/evaluate");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ profile: { age: 65, state: "HR" }, interests: ["pension"] });
  });

  it("throws an ApiError carrying detail on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "bad age" }), { status: 422 })),
    );
    const err = await evaluate({ age: -1 }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.detail).toBe("bad age");
  });
});

describe("kit language and 422 fields", () => {
  it("downloadKit sends the language in the POST body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("pdf", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await downloadKit("pm-kisan", "hi");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/kit/pm-kisan");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ lang: "hi" });
  });

  it("invalidFields names the profile fields of a 422", () => {
    const detail = JSON.stringify([
      { loc: ["body", "profile", "disability"], msg: "bad" },
      { loc: ["body", "profile", "age"], msg: "bad" },
      { loc: ["body", "interests", 0], msg: "bad" },
    ]);
    expect(invalidFields(new ApiError(422, detail))).toEqual(["disability", "age"]);
    expect(invalidFields(new ApiError(500, detail))).toEqual([]);
    expect(invalidFields(new ApiError(422, "not json"))).toEqual([]);
  });
});
