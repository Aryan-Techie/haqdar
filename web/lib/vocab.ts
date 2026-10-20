import raw from "@/lib/vocab.json";
import { localize } from "@/lib/i18n";
import type { LangCode } from "@/lib/types";

export interface VocabOption {
  id: string;
  en: string;
  hi?: string;
}

export interface VocabField {
  type: "enum" | "integer" | "boolean";
  question: { en: string; hi?: string };
  options?: VocabOption[];
  min?: number;
  max?: number;
}

export interface Vocab {
  version: string;
  fixed_order: string[];
  candidate_fields: string[];
  max_questions: number;
  predicate_fields: Record<string, string>;
  bands: Record<string, Record<string, [number, number | null]>>;
  fields: Record<string, VocabField>;
  categories: VocabOption[];
}

export const vocab = raw as unknown as Vocab;

export function fieldQuestion(field: string, lang: LangCode): string {
  const f = vocab.fields[field];
  return f ? localize(f.question, lang) : field;
}

export function optionLabel(field: string, id: string, lang: LangCode): string {
  const o = vocab.fields[field]?.options?.find((x) => x.id === id);
  return o ? localize(o, lang) : id;
}

export function categoryLabel(id: string, lang: LangCode): string {
  const c = vocab.categories.find((x) => x.id === id);
  return c ? localize(c, lang) : id;
}

/** Predicate name (e.g. annual_income) to the profile field that answers it (income_band). */
export function profileFieldFor(predicate: string): string {
  return vocab.predicate_fields[predicate] ?? predicate;
}
