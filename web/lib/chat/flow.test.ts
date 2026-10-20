import { describe, expect, it } from "vitest";
import { extraQuestions, nextQuestion } from "@/lib/chat/flow";
import { vocab } from "@/lib/vocab";
import type { Profile } from "@/lib/types";

const FIXED = vocab.fixed_order;

/** Run the flow to completion, answering or skipping each question. */
function run(nextFields: string[], skip: (f: string) => boolean = () => false, start: Profile = {}) {
  const profile: Record<string, unknown> = { ...start };
  const asked: string[] = [];
  for (let i = 0; i < 40; i++) {
    const q = nextQuestion(profile as Profile, nextFields, asked);
    if (q === null) break;
    asked.push(q);
    if (!skip(q)) profile[q] = "x";
  }
  return { asked, profile };
}

describe("nextQuestion", () => {
  it("asks the six fixed fields first, in order", () => {
    expect(nextQuestion({}, ["land_band"], [])).toBe("state");
    expect(run([]).asked).toEqual(FIXED);
  });
  it("never asks more than the cap", () => {
    const { asked } = run(["marital_status", "land_band", "disability", "residence"]);
    expect(asked.length).toBeLessThanOrEqual(vocab.max_questions);
    expect(asked.length).toBe(8);
  });
  it("stops after 6 with no nextFields", () => {
    expect(run([]).asked.length).toBe(6);
  });
  it("does not re-ask skipped fields", () => {
    const { asked } = run(["land_band"], (f) => f === "age" || f === "land_band");
    expect(new Set(asked).size).toBe(asked.length);
    expect(asked.filter((f) => f === "age").length).toBe(1);
  });
  it("skips fields that are already answered", () => {
    expect(nextQuestion({ state: "HR", age: 30 }, [], [])).toBe("gender");
  });
  it("returns null once fixed fields are resolved and nextFields is empty", () => {
    const asked = [...FIXED];
    expect(nextQuestion({}, [], asked)).toBeNull();
    expect(nextQuestion({ state: "DL", age: 1, gender: "male", occupation: "student", income_band: "lt_1l", category: "sc" }, [], [])).toBeNull();
  });
  it("asks at most two extras, skipping answered and unknown fields", () => {
    const asked = [...FIXED];
    const profile: Profile = { disability: "none" };
    expect(nextQuestion(profile, ["disability", "nonsense", "land_band", "residence"], asked)).toBe("land_band");
    expect(nextQuestion(profile, ["land_band", "residence", "bpl"], [...asked, "land_band", "residence"])).toBeNull();
  });
});

describe("extraQuestions (results page button)", () => {
  const full: Profile = { state: "UP", age: 30, gender: "female", occupation: "student", income_band: "lt_1l", category: "sc" };
  it("counts the extras still allowed", () => {
    expect(extraQuestions(full, ["land_band", "bpl", "residence"], [...FIXED])).toEqual(["land_band", "bpl"]);
  });
  it("never re-asks skipped questions and hides once the cap is reached", () => {
    expect(extraQuestions(full, ["land_band", "bpl"], [...FIXED, "land_band"])).toEqual(["bpl"]);
    expect(extraQuestions(full, ["land_band", "bpl"], [...FIXED, "land_band", "bpl"])).toEqual([]);
  });
  it("answered extras count toward the cap", () => {
    expect(extraQuestions({ ...full, bpl: true, residence: "rural" }, ["land_band"], [...FIXED])).toEqual([]);
  });
  it("does not offer skipped fixed questions again", () => {
    const asked = [...FIXED];
    expect(extraQuestions({ gender: "female" }, ["bpl"], asked)).toEqual(["bpl"]);
  });
});
