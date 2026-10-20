import { vocab } from "@/lib/vocab";
import type { Profile } from "@/lib/types";

const known = (field: string) => field in vocab.fields;

/** Number of questions asked beyond the fixed six that the engine may choose. */
export const MAX_EXTRA = 2;

const answeredFields = (profile: Profile) =>
  Object.entries(profile as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([f]) => f);

/**
 * The next field to ask, or null when the conversation is over.
 * - The fixed fields (vocab.fixed_order) come first, skipping any that are answered or already asked (answered or skipped).
 * - Then at most MAX_EXTRA fields from `nextFields` (the engine's ranking), never exceeding vocab.max_questions in total.
 *   Questions already asked (including skipped ones) and answered fields all count toward the cap.
 */
export function nextQuestion(profile: Profile, nextFields: string[], asked: string[]): string | null {
  const done = (f: string) => asked.includes(f) || (profile as Record<string, unknown>)[f] !== undefined;

  for (const f of vocab.fixed_order) {
    if (!done(f)) return f;
  }

  const seen = new Set([...asked, ...answeredFields(profile)]);
  const extrasAsked = [...seen].filter((f) => !vocab.fixed_order.includes(f)).length;
  if (extrasAsked >= MAX_EXTRA || seen.size >= vocab.max_questions) return null;
  return nextFields.find((f) => known(f) && !vocab.fixed_order.includes(f) && !done(f)) ?? null;
}

/** Questions the chat would still ask for this profile (never re-asks answered or skipped ones; respects the cap). */
export function extraQuestions(profile: Profile, nextFields: string[], asked: string[]): string[] {
  const out: string[] = [];
  const virtual = [...asked];
  for (let i = 0; i < vocab.max_questions + vocab.fixed_order.length; i++) {
    const q = nextQuestion(profile, nextFields, virtual);
    if (q === null) break;
    out.push(q);
    virtual.push(q);
  }
  return out;
}
