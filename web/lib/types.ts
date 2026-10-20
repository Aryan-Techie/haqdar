export type LangCode = "en" | "hi";

export type Category = "pension" | "health" | "education" | "farm" | "women";

export interface Profile {
  state?: string;
  age?: number;
  gender?: string;
  occupation?: string;
  income_band?: string;
  category?: string;
  marital_status?: string;
  land_band?: string;
  disability?: string;
  student_level?: string;
  residence?: string;
  bpl?: boolean;
  pregnant_or_new_mother?: boolean;
  girl_child_under_10?: boolean;
}

export type ProfileField = keyof Profile;
export type ProfileValue = string | number | boolean;

export interface Pred {
  field: string;
  op: string;
  value?: unknown;
  /** True when the predicate sat under a `not`: the text reads "must NOT be ...". */
  negated?: boolean;
}

export type Verdict = "eligible" | "maybe" | "ineligible";

export type ReasonCode = "all_rules_pass" | "missing_info" | "rule_failed" | "state_unavailable";

export interface Result {
  scheme_id: string;
  verdict: Verdict;
  rank: number;
  passed: Pred[];
  failed: Pred[];
  unknown_fields: string[];
  reason: { code: ReasonCode; detail: string };
  rule_version: string;
  source_url: string;
  profile_hash: string;
}

export interface EvaluateResponse {
  results: Result[];
  next_fields: string[];
  coverage: { state: string | null; has_state_schemes: boolean };
}

export interface Text {
  en: string;
  hi?: string;
}

export interface TextList {
  en: string[];
  hi?: string[];
}

export type Rule =
  | Pred
  | { all: Rule[] }
  | { any: Rule[] }
  | { not: Rule };

export interface SchemeDocument {
  name: Text;
  required: boolean;
  note?: Text;
}

export interface Scheme {
  id: string;
  name: Text;
  category: Category;
  level: "central" | "state";
  states: string[];
  benefit: Text;
  benefit_weight: number;
  description: Text;
  eligibility: Rule;
  eligibility_plain: TextList;
  documents: SchemeDocument[];
  how_to_apply: TextList;
  apply_url: string | null;
  source_url: string;
  deadline: string | null;
  last_verified: string;
  rule_version: string;
  tags?: string[];
  verification: {
    status: "sourced" | "hand_verified";
    by?: string | null;
    hi_reviewed: boolean;
    notes?: string;
  };
}

export interface Consent {
  version: string;
  accepted: true;
}

export interface AuthUser {
  id: number;
  phone: string;
}

export interface Me {
  id: number;
  phone: string;
  profile: Profile;
  language: LangCode | null;
}
