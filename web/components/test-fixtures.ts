import type { Result, Scheme } from "@/lib/types";

export function makeScheme(over: Partial<Scheme> = {}): Scheme {
  return {
    id: "pm-kisan",
    name: { en: "PM-KISAN", hi: "पीएम-किसान" },
    category: "farm",
    level: "central",
    states: ["*"],
    benefit: { en: "Rs 6,000 a year", hi: "हर साल ₹6,000" },
    benefit_weight: 75,
    description: { en: "Income support for farmers.", hi: "किसानों को आय सहायता।" },
    eligibility: { field: "occupation", op: "eq", value: "farmer" },
    eligibility_plain: { en: ["Farmer family with land."], hi: ["ज़मीन वाला किसान परिवार।"] },
    documents: [
      { name: { en: "Aadhaar number", hi: "आधार नंबर" }, required: true },
      { name: { en: "Caste certificate", hi: "जाति प्रमाणपत्र" }, required: false },
    ],
    how_to_apply: { en: ["Visit the portal."], hi: ["पोर्टल पर जाएँ।"] },
    apply_url: "https://pmkisan.gov.in/",
    source_url: "https://pmkisan.gov.in/Documents/Scheme.pdf",
    deadline: null,
    last_verified: "2026-10-20",
    rule_version: "1.0.0",
    verification: { status: "sourced", hi_reviewed: false },
    ...over,
  };
}

export function makeResult(over: Partial<Result> = {}): Result {
  return {
    scheme_id: "pm-kisan",
    verdict: "eligible",
    rank: 1,
    passed: [{ field: "occupation", op: "eq", value: "farmer" }],
    failed: [],
    unknown_fields: [],
    reason: { code: "all_rules_pass", detail: "ok" },
    rule_version: "1.0.0",
    source_url: "https://pmkisan.gov.in/",
    profile_hash: "abc",
    ...over,
  };
}
