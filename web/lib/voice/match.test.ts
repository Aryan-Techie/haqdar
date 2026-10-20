import { describe, expect, it } from "vitest";
import { isDontKnow, matchAnswer, parseNumber } from "@/lib/voice/match";
import { vocab } from "@/lib/vocab";

const v = (field: string, text: string, lang: "en" | "hi" = "en") => matchAnswer(field, text, lang)?.value ?? null;

describe("age", () => {
  it("parses ASCII digits, Devanagari digits and number words to 65", () => {
    expect(v("age", "65")).toBe(65);
    expect(v("age", "६५", "hi")).toBe(65);
    expect(v("age", "पैंसठ", "hi")).toBe(65);
    expect(v("age", "painsath", "hi")).toBe(65);
    expect(v("age", "sixty five")).toBe(65);
    expect(v("age", "sixty-five years")).toBe(65);
    expect(v("age", "मेरी उम्र 65 साल है", "hi")).toBe(65);
  });
  it("parses more Hindi words", () => {
    expect(v("age", "छियासी", "hi")).toBe(86);
    expect(v("age", "पचास साल", "hi")).toBe(50);
    expect(v("age", "बयालीस", "hi")).toBe(42);
    expect(v("age", "ek sau bees", "hi")).toBe(120);
    expect(v("age", "एक सौ बीस", "hi")).toBe(120);
    expect(v("age", "सौ", "hi")).toBe(100);
    expect(v("age", "one hundred and five")).toBe(105);
    expect(v("age", "twenty")).toBe(20);
    expect(v("age", "one twenty")).toBe(120);
    expect(v("age", "one hundred twenty")).toBe(120);
    expect(parseNumber("one twenty five")).toBe(125);
    expect(v("age", "twenty one")).toBe(21);
    expect(v("age", "one two")).toBeNull();
    expect(v("age", "शून्य", "hi")).toBe(0);
  });
  it("every Hindi word 0..99 round-trips (Devanagari and Roman)", async () => {
    const { HINDI_DEVANAGARI, HINDI_ROMAN } = await import("@/lib/voice/match");
    expect(HINDI_DEVANAGARI.length).toBe(100);
    expect(HINDI_ROMAN.length).toBe(100);
    for (let n = 0; n < 100; n++) {
      expect(v("age", HINDI_DEVANAGARI[n], "hi"), HINDI_DEVANAGARI[n]).toBe(n);
      expect(v("age", HINDI_ROMAN[n], "hi"), HINDI_ROMAN[n]).toBe(n);
    }
  });
  it("rejects out of range and junk", () => {
    expect(v("age", "121")).toBeNull();
    expect(v("age", "एक सौ इक्कीस", "hi")).toBeNull();
    expect(v("age", "abc")).toBeNull();
    expect(v("age", "65.5")).toBeNull();
    expect(v("age", "-1")).toBeNull();
    expect(v("age", "")).toBeNull();
  });
});

describe("enums", () => {
  it("gender and occupation", () => {
    expect(v("gender", "महिला", "hi")).toBe("female");
    expect(v("gender", "woman")).toBe("female");
    expect(v("gender", "male")).toBe("male");
    expect(v("gender", "purush", "hi")).toBe("male");
    expect(v("occupation", "kisan")).toBe("farmer");
    expect(v("occupation", "मैं किसान हूँ", "hi")).toBe("farmer");
    expect(v("occupation", "khet mazdoor")).toBe("farm_labourer");
    expect(v("occupation", "सरकारी नौकरी", "hi")).toBe("government_employee");
    expect(v("occupation", "student")).toBe("student");
  });
  it("state by English and Hindi name, id only when alone", () => {
    expect(v("state", "Haryana")).toBe("HR");
    expect(v("state", "दिल्ली", "hi")).toBe("DL");
    expect(v("state", "I live in Uttar Pradesh")).toBe("UP");
    expect(v("state", "as soon as possible")).toBeNull();
    expect(v("state", "DL")).toBe("DL");
  });
  it("income by label and by amount", () => {
    expect(v("income_band", "under 1 lakh")).toBe("lt_1l");
    expect(v("income_band", "3 lakh")).toBe("2_5l_5l");
    expect(v("income_band", "डेढ़ लाख", "hi")).toBe("1l_2_5l");
    expect(v("income_band", "50 hazaar")).toBe("lt_1l");
    expect(v("income_band", "10 lakh se zyada")).toBe("gt_8l");
    expect(v("income_band", "30000 per month")).toBe("2_5l_5l");
  });
  it("category, marital, land, disability, student", () => {
    expect(v("category", "OBC")).toBe("obc");
    expect(v("category", "general ews")).toBe("ews");
    expect(v("category", "general")).toBe("general");
    expect(v("marital_status", "अविवाहित", "hi")).toBe("single");
    expect(v("marital_status", "विवाहित", "hi")).toBe("married");
    expect(v("marital_status", "widow")).toBe("widowed");
    expect(v("land_band", "3 acre")).toBe("2_5_5");
    expect(v("land_band", "no land")).toBe("none");
    expect(v("disability", "no")).toBe("none");
    expect(v("disability", "50 percent")).toBe("yes_40_59");
    expect(v("disability", "65 percent")).toBe("yes_60_79");
    expect(v("disability", "80 percent")).toBe("yes_80_plus");
    expect(v("disability", "30 percent")).toBe("yes_below_40");
    expect(v("student_level", "class 10")).toBe("school_9_10");
    expect(v("student_level", "college")).toBe("undergrad");
    expect(v("residence", "gaon", "hi")).toBe("rural");
  });
  it("unclear enum answers return null", () => {
    expect(v("gender", "banana")).toBeNull();
    expect(v("disability", "yes")).toBeNull();
  });
  it("every option id and English label matches itself", () => {
    for (const [field, f] of Object.entries(vocab.fields)) {
      for (const o of f.options ?? []) {
        expect(v(field, o.en), `${field}:${o.en}`).toBe(o.id);
        if (o.hi) expect(v(field, o.hi, "hi"), `${field}:${o.hi}`).toBe(o.id);
      }
    }
  });
});

describe("booleans", () => {
  it("yes and no in English and Hindi", () => {
    for (const s of ["yes", "yeah", "haan", "हाँ", "हां", "जी हाँ"]) expect(v("bpl", s, "hi"), s).toBe(true);
    for (const s of ["no", "nahi", "नहीं", "ना", "nope", "जी नहीं"]) expect(v("bpl", s, "hi"), s).toBe(false);
    expect(v("bpl", "maybe")).toBeNull();
    expect(v("bpl", "yes no")).toBeNull();
  });
});

describe("parseNumber", () => {
  it("handles decimals and Hindi fractions", () => {
    expect(parseNumber("2.5")).toBe(2.5);
    expect(parseNumber("डेढ़")).toBe(1.5);
    expect(parseNumber("साढ़े तीन")).toBe(3.5);
  });
});

describe("final review fixes", () => {
  const DK = ["पता नहीं", "pata nahi", "no idea", "not sure", "don't know", "नहीं पता", "maloom nahi", "I do not know", "मालूम नहीं", "I dont know"];
  it("don't know is never an answer (not No, not none, not 2)", () => {
    for (const s of DK) {
      expect(isDontKnow(s), s).toBe(true);
      for (const f of ["bpl", "pregnant_or_new_mother", "disability", "age", "land_band", "student_level", "marital_status"]) {
        expect(v(f, s), `${f}: ${s}`).toBeNull();
      }
    }
    expect(isDontKnow("no")).toBe(false);
    expect(isDontKnow("नहीं")).toBe(false);
  });
  it("negation wins for marital status", () => {
    expect(v("marital_status", "not married")).toBe("single");
    expect(v("marital_status", "unmarried")).toBe("single");
    expect(v("marital_status", "शादी नहीं हुई")).toBe("single");
    expect(v("marital_status", "married")).toBe("married");
    expect(v("marital_status", "not widowed")).toBeNull();
  });
  it("English 'do' is not the number two", () => {
    expect(v("age", "do you need it")).toBeNull();
    expect(v("age", "do")).toBe(2);
    expect(v("age", "do saal")).toBe(2);
  });
  it("age picks the number beside an age cue", () => {
    expect(v("age", "I have 2 kids and I am 40")).toBe(40);
    expect(v("age", "3 kids 5 pets")).toBeNull();
    expect(v("age", "40 years, 2 kids")).toBe(40);
  });
  it("land units are converted, ambiguous ones are not guessed", () => {
    expect(v("land_band", "10 kanal")).toBe("lt_2_5");
    expect(v("land_band", "3 bigha")).toBeNull();
    expect(v("land_band", "2 hectare")).toBe("2_5_5");
    expect(v("land_band", "4 killa")).toBe("2_5_5");
    expect(v("land_band", "2 acre")).toBe("lt_2_5");
    expect(v("land_band", "nahi")).toBe("none");
  });
  it("state synonyms", () => {
    expect(v("state", "Gurgaon")).toBe("HR");
    expect(v("state", "Delhi NCR Gurgaon")).toBe("HR");
    expect(v("state", "Jammu")).toBe("JK");
    expect(v("state", "utter pradesh")).toBe("UP");
    expect(v("state", "Noida")).toBe("UP");
  });
});
