import { fmt, localize, t } from "@/lib/i18n";
import { fieldQuestion, optionLabel, vocab } from "@/lib/vocab";
import type { LangCode, ProfileValue } from "@/lib/types";

export interface QuestionSpec {
  field: string;
  kind: "enum" | "integer" | "boolean";
  text: string;
  options: { id: string; label: string }[];
}

export function questionSpec(field: string, lang: LangCode): QuestionSpec {
  const def = vocab.fields[field];
  return {
    field,
    kind: def?.type ?? "enum",
    text: fieldQuestion(field, lang),
    options: (def?.options ?? []).map((o) => ({ id: o.id, label: localize(o, lang) })),
  };
}

/** Human label of a stored answer, in the given language. */
export function answerLabel(field: string, value: ProfileValue | undefined, lang: LangCode): string {
  if (value === undefined) return t("chat.skipped", lang);
  const type = vocab.fields[field]?.type;
  if (type === "boolean") return value ? t("common.yes", lang) : t("common.no", lang);
  if (type === "integer") return fmt(lang === "hi" ? "{n} साल" : "{n} years", { n: String(value) });
  return optionLabel(field, String(value), lang);
}

/** Fields in the order they appear in the conversation: fixed ones first, then extras in the order asked. */
export function threadOrder(history: string[], answered: (f: string) => boolean): string[] {
  const fixed = vocab.fixed_order.filter((f) => history.includes(f) || answered(f));
  const extras = history.filter((f) => !vocab.fixed_order.includes(f));
  return [...fixed, ...extras];
}
