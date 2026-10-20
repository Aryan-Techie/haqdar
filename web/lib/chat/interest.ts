import { norm } from "@/lib/voice/match";
import { vocab } from "@/lib/vocab";

const KEYWORDS: Record<string, string[]> = {
  pension: ["pension", "old age", "elderly", "widow", "senior", "budhapa", "vridha", "पेंशन", "बुजुर्ग", "वृद्ध", "विधवा", "बुढ़ापा"],
  health: ["health", "hospital", "medical", "treatment", "ilaj", "bimari", "insurance", "ayushman", "स्वास्थ्य", "अस्पताल", "इलाज", "बीमारी", "बीमा", "आयुष्मान"],
  education: ["education", "scholarship", "study", "school", "college", "padhai", "fees", "शिक्षा", "छात्रवृत्ति", "स्कॉलरशिप", "पढ़ाई", "स्कूल", "कॉलेज"],
  farm: ["farm", "farming", "farmer", "kisan", "kheti", "crop", "agriculture", "खेती", "किसान", "फसल", "कृषि"],
  women: ["women", "woman", "mahila", "girl", "ladki", "mother", "pregnant", "maternity", "महिला", "लड़की", "बेटी", "गर्भवती", "माँ"],
};

const known = () => new Set(vocab.categories.map((c) => c.id));

/** Categories named in the `?interest=` query value (comma separated). Unknown values are dropped. */
export function parseInterests(param: string | null | undefined): string[] {
  if (!param) return [];
  const ok = known();
  return [...new Set(param.split(",").map((s) => s.trim().toLowerCase()).filter((s) => ok.has(s)))];
}

/** Best-effort category for a typed question ("kisan pension" -> pension first match). Null when nothing is recognised. */
export function interestFromText(text: string): string | null {
  const n = norm(text);
  if (!n) return null;
  const ok = known();
  for (const cat of vocab.categories) {
    const words = [norm(cat.en), cat.hi ? norm(cat.hi) : "", ...(KEYWORDS[cat.id] ?? []).map(norm)];
    if (ok.has(cat.id) && words.some((w) => w && n.includes(w))) return cat.id;
  }
  return null;
}
