import { describe, expect, it } from "vitest";
import { whyLine } from "./results";
import type { Result } from "./types";

const base = {
  scheme_id: "x", rank: 1, unknown_fields: [], rule_version: "1.0.0", source_url: "https://x.gov.in", profile_hash: "h",
} as unknown as Result;

describe("whyLine with negated predicates", () => {
  const neg = { field: "occupation", op: "eq", value: "government_employee", negated: true };

  it("eligible: negated passed predicate reads as not excluded", () => {
    const r = { ...base, verdict: "eligible", passed: [neg], failed: [], reason: { code: "all_rules_pass", detail: "" } } as Result;
    expect(whyLine(r, "en")).toMatch(/^Not excluded by/);
    expect(whyLine(r, "hi")).toContain("बाहर नहीं");
  });

  it("ineligible: negated failed predicate reads as not allowed, not as a mismatch", () => {
    const r = { ...base, verdict: "ineligible", passed: [], failed: [neg], reason: { code: "rule_failed", detail: "" } } as Result;
    expect(whyLine(r, "en")).toContain("is not allowed for this scheme");
    expect(whyLine(r, "en")).not.toContain("Does not match");
    expect(whyLine(r, "hi")).toContain("मान्य नहीं");
  });
});
