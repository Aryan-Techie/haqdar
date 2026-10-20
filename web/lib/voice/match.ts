import { vocab } from "@/lib/vocab";
import type { LangCode } from "@/lib/types";

export type MatchValue = string | number | boolean;

// ---------------------------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------------------------

/** Lowercase, ASCII digits, no nuqta/chandrabindu variance, punctuation to spaces. Decimal points inside numbers survive. */
export function norm(input: string): string {
  return input
    .normalize("NFD")
    .replace(/़/g, "")
    .replace(/ँ/g, "ं")
    .normalize("NFC")
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966))
    .toLowerCase()
    .replace(/%/g, " percent ")
    .replace(/(\d),(?=\d)/g, "$1")
    .replace(/[^\p{L}\p{M}\p{N}.\s]/gu, " ")
    .replace(/\.(?!\d)|(?<!\d)\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const tokens = (s: string) => (s ? s.split(" ") : []);

// ---------------------------------------------------------------------------------------------
// Number words: Hindi 0..99 (+ sau = 100) in Devanagari and Roman, English 0..100
// ---------------------------------------------------------------------------------------------

export const HINDI_DEVANAGARI: string[] = (
  "शून्य एक दो तीन चार पाँच छह सात आठ नौ " +
  "दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस " +
  "बीस इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस " +
  "तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस " +
  "चालीस इकतालीस बयालीस तैंतालीस चौवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास " +
  "पचास इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ " +
  "साठ इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सरसठ अड़सठ उनहत्तर " +
  "सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उनासी " +
  "अस्सी इक्यासी बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी " +
  "नब्बे इक्यानवे बानवे तिरानवे चौरानवे पचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे"
).split(" ");

export const HINDI_ROMAN: string[] = (
  "shunya ek do teen char paanch chhah saat aath nau " +
  "das gyarah barah terah chaudah pandrah solah satrah atharah unnis " +
  "bees ikkis baais teis chaubis pachchis chhabbis sattais atthais unatis " +
  "tees iktis battis taintis chauntis paintis chhattis saintis adtis unchalis " +
  "chalis iktalis bayalis taintalis chauvalis paintalis chhiyalis saintalis adtalis unchas " +
  "pachas ikyavan bavan tirpan chauvan pachpan chhappan sattavan atthavan unsath " +
  "saath iksath baasath tirsath chausath painsath chhiyasath sarsath adsath unhattar " +
  "sattar ikhattar bahattar tihattar chauhattar pachhattar chhihattar satahattar athahattar unasi " +
  "assi ikyasi bayasi tirasi chaurasi pachasi chhiyasi sattasi atthasi navasi " +
  "nabbe ikyanve baanve tiranve chauranve pachanve chhiyanve sattanve atthanve ninyanve"
).split(" ");

/** Common alternative spellings (Devanagari and Roman). */
const HINDI_VARIANTS: Record<string, number> = {
  "छः": 6, "छे": 6, "छ": 6, chhe: 6, chah: 6, che: 6, chhaa: 6,
  panch: 5, "पांच": 5, nao: 9, dus: 10, "ग्यारा": 11, "बारा": 12, "तेरा": 13, "चौदा": 14, "पन्द्रह": 15, "पंद्रा": 15,
  "सोला": 16, "सत्रा": 17, "अठारा": 18, "उन्निस": 19, "उन्नीस": 19, "बाइस": 22, "तेइस": 23, "तेईस": 23, "पच्चिस": 25, "पचीस": 25,
  "छब्बिस": 26, "सताईस": 27, "अठाईस": 28, "अट्ठाइस": 28, "उन्तीस": 29, "उनत्तीस": 29,
  "इकत्तीस": 31, "इक्तीस": 31, "तेंतीस": 33, "तेतीस": 33, "चौतीस": 34, "पैतीस": 35, "सैतीस": 37, "अड़तीस": 38, "अडतीस": 38,
  "इकतालिस": 41, "बयालिस": 42, "तैंतालिस": 43, "तेंतालीस": 43, "चवालीस": 44, "चौआलीस": 44, "चौंतालीस": 44, "पैंतालिस": 45, "पैतालीस": 45,
  "छियालिस": 46, "सैंतालिस": 47, "सैतालीस": 47, "अड़तालिस": 48, "अठतालीस": 48, "उंचास": 49, "उनंचास": 49,
  "इक्यावन": 51, "इक्कावन": 51, "तिरेपन": 53, "तिरपन": 53, "चौअन": 54, "पचपन": 55, "छप्पन": 56, "सत्तावन": 57, "अट्ठावन": 58, "अठावन": 58,
  "उनसठ": 59, "उन्सठ": 59, "तिरेसठ": 63, "चौसठ": 64, "पैसठ": 65, "छियासठ": 66, "छासठ": 66, "सड़सठ": 67, "सरसठ": 67, "अड़सठ": 68, "अडसठ": 68,
  "उनहत्तर": 69, "उन्हत्तर": 69, "इकहत्तर": 71, "तिहत्तर": 73, "चौहत्तर": 74, "पिचहत्तर": 75, "छिहत्तर": 76, "सतहत्तर": 77, "अठहत्तर": 78,
  "उन्यासी": 79, "उनासी": 79, "इक्यासी": 81, "बयासी": 82, "तिरासी": 83, "चौरासी": 84, "पचासी": 85, "छियासी": 86, "सत्तासी": 87, "अट्ठासी": 88, "अठासी": 88,
  "नवासी": 89, "इक्यानवे": 91, "इकानवे": 91, "बानवे": 92, "तिरानवे": 93, "चौरानवे": 94, "पचानवे": 95, "छियानवे": 96, "सत्तानवे": 97, "अट्ठानवे": 98, "अठानवे": 98, "निन्यानवे": 99, "निन्यानबे": 99,
  "नब्बै": 90, "अस्सि": 80, "सत्तरह": 17, "अट्ठारह": 18,
  "ikkees": 21, "baees": 22, "tees": 30, "bais": 22, "teyis": 23, "pachees": 25, "chhabbees": 26, "sattaees": 27, "atthaees": 28, "untees": 29,
  "ikatis": 31, "tentis": 33, "paitis": 35, "chhatis": 36, "ikatalis": 41, "paitalis": 45, "chhiyaalis": 46, "pachaas": 50,
  "paisath": 65, "painsat": 65, "paisat": 65, "pachhattar": 75, "pachahattar": 75, "nabbey": 90, "nabbe": 90, "nauve": 90,
};

const EN_UNITS = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
const EN_TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** Roman Hindi is spelled loosely: compare a phonetic skeleton (drop h, collapse long vowels and doubled letters). */
function skeleton(w: string): string {
  return w
    .toLowerCase()
    .replace(/h/g, "")
    .replace(/w/g, "v")
    .replace(/ee|ii|ie|ei/g, "i")
    .replace(/aa/g, "a")
    .replace(/oo/g, "u")
    .replace(/(.)\1+/g, "$1");
}

const words = new Map<string, number>(); // normalised Devanagari / English / exact Roman -> value
const romanSkeleton = new Map<string, number>(); // skeleton of Roman Hindi -> value
const englishUnits = new Set<string>();

HINDI_DEVANAGARI.forEach((w, n) => words.set(norm(w), n));
HINDI_ROMAN.forEach((w, n) => {
  words.set(w, n); // exact spelling first: "saat" (7) and "saath" (60) share a skeleton
  if (!romanSkeleton.has(skeleton(w))) romanSkeleton.set(skeleton(w), n);
});
for (const [w, n] of Object.entries(HINDI_VARIANTS)) {
  if (/^[a-z]+$/.test(w)) {
    words.set(w, n);
    if (!romanSkeleton.has(skeleton(w))) romanSkeleton.set(skeleton(w), n);
  } else words.set(norm(w), n);
}
EN_UNITS.forEach((w, n) => {
  words.set(w, n);
  if (n > 0 && n < 10) englishUnits.add(w);
});
for (const [w, n] of Object.entries(EN_TENS)) words.set(w, n);
for (const w of ["sau", "सौ", "hundred", "sao", "सो"]) words.set(norm(w), 100);
// English words beat Roman skeletons: "do", "ek" etc. are Hindi, listed in HINDI_ROMAN.

const HUNDRED = new Set(["sau", "सौ", "hundred", "sao"].map(norm));
const SADHE = new Set(["sadhe", "saadhe", "साढे", "साढ़े", "सादे"].map(norm));
const FRACTION: Record<string, number> = { dedh: 1.5, "डेढ": 1.5, "डेढ़": 1.5, dhai: 2.5, "ढाई": 2.5, adha: 0.5, "आधा": 0.5 };
const fractions = new Map(Object.entries(FRACTION).map(([k, v]) => [norm(k), v]));

function wordValue(tok: string | undefined): number | undefined {
  if (!tok) return undefined;
  const direct = words.get(tok);
  if (direct !== undefined) return direct;
  if (/^[a-z]+$/.test(tok)) return romanSkeleton.get(skeleton(tok));
  return undefined;
}

const DO_UNIT = /^(?:saal|sal|sau|hazar|hazaar|lakh|lac|lakhs|crore|acre|acres|kanal|bigha|killa|year|years|month|months|mahine|mahina|साल|सौ|हजार|लाख|करोड़|एकड़|महीने|वर्ष)$/u;

function wordsToNumber(toks: string[]): number | null {
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const frac = fractions.get(t);
    if (frac !== undefined) return frac;
    if (SADHE.has(t)) {
      const nx = wordValue(toks[i + 1]);
      if (nx !== undefined && nx < 100) return nx + 0.5;
    }
    // "do" is Hindi for two but also English ("I do not know"): accept it alone or before a unit.
    if (t === "do" && toks.length > 1 && !DO_UNIT.test(toks[i + 1] ?? "")) continue;
    const first = wordValue(t);
    if (first === undefined) continue;

    let total: number;
    let kind: "unit" | "tens" | "hundred" | "end";
    if (HUNDRED.has(t)) {
      total = 100;
      kind = "hundred";
    } else {
      total = first;
      kind = t in EN_TENS ? "tens" : first < 10 ? "unit" : "end";
    }
    for (let j = i + 1; j < toks.length; j++) {
      let tok = toks[j];
      if (kind === "hundred" && (tok === "and" || tok === "aur" || tok === "और")) {
        tok = toks[++j];
      }
      const val = wordValue(tok);
      if (val === undefined) break;
      // "one twenty" (English, no "hundred") is 120: a lone "one" before a tens word.
      if (kind === "unit" && total === 1 && j === i + 1 && t === "one" && tok in EN_TENS) {
        total = 100 + val;
        kind = "tens";
        continue;
      }
      if (HUNDRED.has(tok)) {
        if (kind === "unit" && total >= 1) {
          total *= 100;
          kind = "hundred";
          continue;
        }
        break;
      }
      if (kind === "hundred") {
        total += val;
        kind = tok in EN_TENS ? "tens" : "end";
      } else if (kind === "tens" && englishUnits.has(tok)) {
        total += val;
        kind = "end";
      } else {
        // Two bare English digits in a row ("one two") are ambiguous: no match.
        if (kind === "unit" && englishUnits.has(tok) && englishUnits.has(t)) return null;
        break;
      }
    }
    return total;
  }
  return null;
}

/** First number in the text: digits (ASCII or Devanagari), decimals, number words, "dedh", "dhai", "sadhe teen". Null for none or negatives. */
export function parseNumber(text: string): number | null {
  if (/(^|\s)[-−]\s?[\d०-९]/.test(text)) return null;
  const n = norm(text);
  const m = n.match(/\d+(?:\.\d+)?/);
  if (m) return Number(m[0]);
  return wordsToNumber(tokens(n));
}

// ---------------------------------------------------------------------------------------------
// Synonyms (English, Hindi, Roman Hindi) per field and option id
// ---------------------------------------------------------------------------------------------

const SYN: Record<string, Record<string, string[]>> = {
  state: {
    DL: ["dilli", "new delhi", "नई दिल्ली"],
    PB: ["panjab"],
    OD: ["orissa", "उड़ीसा"],
    PY: ["pondicherry", "पांडिचेरी"],
    UK: ["uttaranchal", "उत्तरांचल"],
    JK: ["kashmir", "j and k", "jammu", "जम्मू कश्मीर", "कश्मीर", "जम्मू"],
    CG: ["chattisgarh", "chhatisgarh", "chhattisgarh", "छतीसगढ़"],
    TS: ["telengana"],
    TN: ["tamilnadu"],
    WB: ["bengal", "बंगाल"],
    HP: ["himachal", "हिमाचल"],
    AN: ["andaman", "nicobar", "अंडमान"],
    DH: ["dadra", "daman", "diu", "दादरा", "दमन"],
    MH: ["bombay"],
    UP: ["u p", "यूपी", "utter pradesh", "uttar pardesh", "utar pradesh", "noida", "lucknow", "नोएडा"],
    MP: ["m p", "एमपी"],
    HR: ["हरयाणा", "gurgaon", "gurugram", "गुड़गांव", "गुरुग्राम", "faridabad"],
    AP: ["आन्ध्र प्रदेश", "andhra"],
    KA: ["कर्नाटका"],
  },
  gender: {
    female: ["female", "woman", "women", "girl", "lady", "aurat", "mahila", "ladki", "stri", "aurte", "औरत", "लड़की", "स्त्री", "महिला"],
    male: ["male", "man", "men", "boy", "gents", "aadmi", "admi", "purush", "ladka", "आदमी", "पुरुष", "लड़का", "मर्द"],
    other: ["other", "anya", "transgender", "third gender", "अन्य", "ट्रांसजेंडर", "किन्नर"],
  },
  occupation: {
    farmer: ["kisan", "kheti", "khetibadi", "krishak", "farming", "agriculture", "cultivator", "किसान", "खेती", "खेतीबाड़ी", "कृषक", "काश्तकार"],
    farm_labourer: ["khetihar", "khet mazdoor", "khet majdoor", "farm labour", "farm worker", "agricultural labour", "खेतिहर", "खेत मजदूर", "खेतिहर मजदूर"],
    construction_daily_wage: ["construction", "daily wage", "dihadi", "mazdoor", "majdoor", "mazdur", "labour", "labourer", "laborer", "mistri", "mason", "मजदूर", "दिहाड़ी", "मज़दूरी", "मजदूरी", "मिस्त्री", "निर्माण"],
    gig_worker: ["gig", "platform", "delivery", "zomato", "swiggy", "uber", "ola", "rider", "डिलीवरी", "गिग", "प्लेटफॉर्म"],
    street_vendor_self_employed: ["vendor", "street vendor", "rehri", "patri", "thela", "dukan", "dukaan", "shop", "business", "self employed", "swarozgar", "vyapar", "vyapari", "रेहड़ी", "पटरी", "ठेला", "दुकान", "व्यापार", "स्वरोजगार", "अपना काम", "बिज़नेस", "बिजनेस"],
    private_salaried: ["private", "private job", "pvt", "company", "salaried", "private naukri", "प्राइवेट", "निजी", "निजी नौकरी", "प्राइवेट नौकरी", "कंपनी"],
    government_employee: ["government", "govt", "sarkari", "government job", "sarkari naukri", "सरकारी", "सरकारी नौकरी"],
    student: ["student", "padhai", "vidyarthi", "padhta", "padhti", "studying", "chhatra", "chhatra", "विद्यार्थी", "छात्र", "छात्रा", "पढ़ाई", "पढ़ता", "पढ़ती", "स्टूडेंट"],
    homemaker: ["homemaker", "housewife", "house wife", "grihini", "ghar ka kaam", "home maker", "गृहिणी", "गृहणी", "हाउसवाइफ", "घर का काम", "घरेलू"],
    unemployed: ["unemployed", "berozgar", "berojgar", "not working", "no job", "jobless", "khali", "बेरोजगार", "खाली", "काम नहीं", "नौकरी नहीं"],
    retired: ["retired", "retire", "pensioner", "sevanivrit", "सेवानिवृत्त", "रिटायर", "रिटायर्ड", "रिटायरड"],
  },
  category: {
    general: ["general", "samanya", "open", "unreserved", "gen", "सामान्य", "जनरल", "ओपन"],
    obc: ["obc", "other backward", "backward class", "pichhda", "पिछड़ा", "पिछड़ा वर्ग", "ओबीसी"],
    sc: ["sc", "scheduled caste", "dalit", "anusuchit jati", "एससी", "दलित", "अनुसूचित जाति"],
    st: ["st", "scheduled tribe", "adivasi", "tribal", "anusuchit janjati", "एसटी", "आदिवासी", "अनुसूचित जनजाति"],
    ews: ["ews", "economically weaker", "general ews", "ईडब्ल्यूएस", "ई डब्ल्यू एस"],
  },
  marital_status: {
    single: ["single", "unmarried", "never married", "not married", "not yet married", "shaadi nahi", "shadi nahi", "शादी नहीं", "विवाहित नहीं", "शादी नहीं हुई", "kunwara", "kunwari", "avivahit", "अविवाहित", "कुंवारा", "कुंवारी", "कुँवारा", "कुँवारी"],
    married: ["married", "shaadi shuda", "shadishuda", "vivahit", "शादीशुदा", "शादी शुदा", "विवाहित"],
    widowed: ["widow", "widowed", "widower", "vidhwa", "vidhur", "विधवा", "विधुर"],
    divorced_separated: ["divorced", "separated", "divorce", "talaq", "talaqshuda", "तलाक", "तलाकशुदा", "अलग"],
  },
  land_band: {
    none: ["no", "nahi", "nahin", "नहीं", "no land", "landless", "zameen nahi", "jameen nahi", "koi zameen nahi", "none", "nil", "ज़मीन नहीं", "जमीन नहीं", "कोई जमीन नहीं", "भूमिहीन"],
  },
  disability: {
    none: ["no", "none", "nahi", "nahin", "koi nahi", "no disability", "nope", "नहीं", "नही", "कोई नहीं", "ना", "na", "जी नहीं"],
    yes_40_59: ["40 to 59", "40 se 59", "40 से 59", "forty to fifty nine"],
    yes_60_79: ["60 to 79", "60 se 79", "60 से 79", "sixty to seventy nine"],
    yes_80_plus: ["80 percent or more", "80 plus", "more than 80", "above 80", "over 80", "80 se zyada", "80 se jyada", "80 से ज्यादा", "80 प्रतिशत से ज्यादा", "80 प्रतिशत या अधिक"],
    yes_below_40: ["less than 40", "below 40", "under 40", "40 se kam", "40 से कम", "40 प्रतिशत से कम"],
  },
  student_level: {
    not_student: ["no", "not studying", "not a student", "nahi", "nahin", "no study", "नहीं", "ना", "na", "पढ़ाई नहीं", "नहीं पढ़ रहा", "नहीं पढ़ रही"],
    school_1_8: ["primary", "middle school", "middle", "prathmik", "प्राथमिक", "आठवीं", "सातवीं", "छठी", "छठवीं", "पांचवीं", "पाँचवीं", "चौथी", "तीसरी", "दूसरी", "पहली"],
    school_9_10: ["matric", "matriculation", "high school", "dasvi", "dasvin", "navvi", "tenth", "ninth", "दसवीं", "दसवी", "नौवीं", "मैट्रिक", "हाई स्कूल"],
    school_11_12: ["inter", "intermediate", "senior secondary", "twelfth", "eleventh", "barahvi", "barvi", "बारहवीं", "बारहवी", "ग्यारहवीं", "इंटर", "इंटरमीडिएट"],
    undergrad: ["college", "graduation", "graduate", "degree", "diploma", "ba", "bsc", "bcom", "btech", "bca", "ug", "undergraduate", "iti", "polytechnic", "कॉलेज", "ग्रेजुएशन", "स्नातक", "डिग्री", "डिप्लोमा", "बीए", "बीएससी", "बीकॉम", "आईटीआई"],
    postgrad: ["postgraduate", "post graduate", "post graduation", "masters", "master", "ma", "msc", "mcom", "mtech", "mba", "pg", "स्नातकोत्तर", "पोस्ट ग्रेजुएशन", "एमए", "एमएससी", "एमबीए"],
  },
  residence: {
    rural: ["village", "gaon", "gaanv", "gram", "rural", "dehat", "gramin", "गाँव", "गांव", "गाव", "देहात", "ग्रामीण", "गांव में"],
    urban: ["city", "town", "shehar", "sheher", "urban", "kasba", "nagar", "शहर", "कस्बा", "नगर", "सिटी", "टाउन"],
  },
};

const YES = new Set(["yes", "y", "yeah", "yep", "yup", "haan", "han", "haa", "ha", "haanji", "bilkul", "sahi", "ok", "okay", "true", "हाँ", "हां", "हा", "हाँजी", "बिल्कुल", "सही", "है", "हैं", "जी हाँ", "ठीक"].map(norm));
YES.delete(norm("है"));
YES.delete(norm("हैं"));
const NO = new Set(["no", "nope", "nahi", "nahin", "nai", "na", "not", "galat", "false", "नहीं", "नही", "नहि", "ना", "गलत", "नहीं है"].map(norm));

/** "I don't know" in English, Hindi and Hinglish: never an answer (not No, not none). */
const DONT_KNOW = [
  "pata nahi", "pata nahin", "pata nhi", "pta nahi", "nahi pata", "nahin pata", "nahi maloom", "nahin maloom", "maloom nahi", "maloom nahin",
  "malum nahi", "pata nahi hai", "nahi jaanta", "nahi jaanti", "no idea", "not sure", "dont know", "don t know", "do not know", "dunno", "idk",
  "i have no clue", "no clue", "cant say", "can t say", "पता नहीं", "पता नही", "नहीं पता", "नही पता", "मालूम नहीं", "नहीं मालूम", "मालूम नही",
  "पता नहीं है", "नहीं जानता", "नहीं जानती", "कह नहीं सकता", "कह नहीं सकती", "कुछ पता नहीं",
].map(norm);

/** True when the speaker says they do not know: the chat offers to skip instead of guessing. */
export function isDontKnow(transcript: string): boolean {
  const text = norm(transcript ?? "");
  return !!text && DONT_KNOW.some((p) => boundary(p).test(text));
}

const NEGATORS = new Set(["not", "never", "non"].map(norm));
const TRAILING_NEGATORS = new Set(["nahi", "nahin", "nhi", "नहीं", "नही"].map(norm));

const LESS = new Set(["under", "below", "less", "lesser", "kam", "neeche", "niche", "nichey", "andar", "tak", "upto", "कम", "नीचे", "अंदर", "तक", "से कम"].map(norm));
const MORE = new Set(["over", "above", "more", "zyada", "jyada", "zyaada", "adhik", "upar", "plus", "ज्यादा", "अधिक", "ऊपर", "ज़्यादा", "जयादा", "बढ़कर"].map(norm));

function direction(toks: string[]): "less" | "more" | null {
  const less = toks.some((t) => LESS.has(t));
  const more = toks.some((t) => MORE.has(t));
  if (less === more) return null;
  return less ? "less" : "more";
}

// ---------------------------------------------------------------------------------------------
// Enum matching
// ---------------------------------------------------------------------------------------------

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const boundary = (phrase: string) => new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escapeRe(phrase)}(?![\\p{L}\\p{M}\\p{N}])`, "u");

function matchEnum(field: string, text: string): string | null {
  const options = vocab.fields[field]?.options ?? [];
  const syn = SYN[field] ?? {};
  if (field === "state") {
    const hit = options.find((o) => o.id.toLowerCase() === text);
    if (hit) return hit.id;
  }
  let best = 0;
  let bestIds = new Set<string>();
  for (const o of options) {
    const phrases = new Set<string>();
    if (field !== "state") phrases.add(norm(o.id.replace(/_/g, " ")));
    phrases.add(norm(o.en));
    if (o.hi) phrases.add(norm(o.hi));
    for (const s of syn[o.id] ?? []) phrases.add(norm(s));
    for (const p of phrases) {
      if (!p) continue;
      const m = boundary(p).exec(text);
      if (!m) continue;
      // "not widowed", "widowed nahi": a negated label is not a match for that label.
      const before = tokens(text.slice(0, m.index).trim()).pop();
      const after = tokens(text.slice(m.index + m[0].length).trim())[0];
      if ((before && NEGATORS.has(before) && !p.startsWith("not ")) || (after && TRAILING_NEGATORS.has(after) && !TRAILING_NEGATORS.has(p.split(" ").pop() ?? ""))) continue;
      if (p.length > best) {
        best = p.length;
        bestIds = new Set([o.id]);
      } else if (p.length === best) bestIds.add(o.id);
    }
  }
  return bestIds.size === 1 ? [...bestIds][0] : null;
}

const MULTIPLIERS: [RegExp, number][] = [
  [/\b(?:lakh|lakhs|lac|lacs|lak)\b|लाख/u, 1e5],
  [/\b(?:crore|crores|karod)\b|करोड/u, 1e7],
  [/\b(?:hazaar|hazar|hajar|thousand|k)\b|हजार/u, 1e3],
];

function amountToBand(text: string): string | null {
  const n = parseNumber(text);
  if (n === null) return null;
  const toks = tokens(text);
  let v = n;
  const mult = MULTIPLIERS.find(([re]) => re.test(text));
  if (mult) v = n * mult[1];
  else if (n > 0 && n < 1000) return null; // "3" alone is ambiguous
  if (/\b(?:month|monthly|mahina|mahine|mahinewar)\b|महीन|मासिक/u.test(text)) v *= 12;
  const d = direction(toks);
  if (d === "less") v -= 1;
  if (d === "more") v += 1;
  if (v < 100000) return "lt_1l";
  if (v < 250000) return "1l_2_5l";
  if (v < 500000) return "2_5l_5l";
  if (v < 800000) return "5l_8l";
  return "gt_8l";
}

/** Acres per local unit; null means the unit varies by state, so we do not guess. */
const LAND_UNITS: [RegExp, number | null][] = [
  [/\b(?:hectare|hectares|hect|ha)\b|हेक्टेयर|हैक्टेयर/u, 2.471],
  [/\bkanal\b|कनाल/u, 0.125],
  [/\bmarla\b|मरला/u, 0.00625],
  [/\b(?:killa|kila|kille)\b|किल्ला|किला/u, 1],
  [/\b(?:bigha|beegha|biswa|gunta|guntha|cent|katha)\b|बीघा|बीघे|बिस्वा|गुंठा|कट्ठा/u, null],
];

function landToBand(text: string): string | null {
  const n = parseNumber(text);
  if (n === null) return null;
  let v = n;
  const unit = LAND_UNITS.find(([re]) => re.test(text));
  if (unit) {
    if (unit[1] === null) return null;
    v = n * unit[1];
  }
  const d = direction(tokens(text));
  if (d === "less") v -= 0.0001;
  if (d === "more") v += 0.0001;
  if (v <= 0) return "none";
  if (v < 2.5) return "lt_2_5";
  if (v <= 5) return "2_5_5";
  return "gt_5";
}

function disabilityFromNumber(text: string): string | null {
  const n = parseNumber(text);
  if (n === null || n > 100) return null;
  if (n === 0) return "none";
  const d = direction(tokens(text));
  let v = n;
  if (d === "less") v -= 0.0001;
  if (d === "more") v += 0.0001;
  if (v < 40) return "yes_below_40";
  if (v < 60) return "yes_40_59";
  if (v < 80) return "yes_60_79";
  return "yes_80_plus";
}

function studentFromClass(text: string): string | null {
  const m = text.match(/(?:class|std|standard|grade|kaksha|कक्षा|क्लास)\s*(\d{1,2})\b/u) ?? text.match(/\b(\d{1,2})\s*(?:th|st|nd|rd|वीं|वी)(?![\p{L}\p{M}])/u);
  if (!m) return null;
  const c = Number(m[1]);
  if (c >= 1 && c <= 8) return "school_1_8";
  if (c === 9 || c === 10) return "school_9_10";
  if (c === 11 || c === 12) return "school_11_12";
  return null;
}

function matchBoolean(text: string): boolean | null {
  const toks = tokens(text);
  const yes = toks.some((t) => YES.has(t));
  const no = toks.some((t) => NO.has(t));
  if (yes === no) return null;
  return yes;
}

const AGE_AFTER = new Set(["year", "years", "yr", "yrs", "old", "saal", "sal", "baras", "varsh", "साल", "वर्ष", "बरस"].map(norm));
const AGE_BEFORE = new Set(["age", "aged", "umar", "umr", "aayu", "am", "उम्र", "आयु"].map(norm));

function matchAge(text: string): number | null {
  const toks = tokens(norm(text));
  const numIdx = toks.map((t, i) => (/^\d+(?:\.\d+)?$/.test(t) ? i : -1)).filter((i) => i >= 0);
  let n: number | null;
  if (numIdx.length > 1) {
    // Several numbers ("2 kids and I am 40"): take the one beside an age cue, otherwise do not guess.
    const cued = numIdx.filter((i) => AGE_AFTER.has(toks[i + 1] ?? "") || AGE_BEFORE.has(toks[i - 1] ?? ""));
    if (cued.length !== 1) return null;
    n = Number(toks[cued[0]]);
  } else n = parseNumber(text);
  if (n === null || !Number.isInteger(n)) return null;
  const f = vocab.fields.age;
  const min = f?.min ?? 0;
  const max = f?.max ?? 120;
  return n >= min && n <= max ? n : null;
}

/**
 * Match a spoken or typed answer to a value for `field`. Enum answers are matched by id, English or Hindi label, or synonym
 * (longest phrase wins; ties are ambiguous and return null). Age parses digits, Devanagari digits and number words.
 * Returns null when the answer is not understood.
 */
export function matchAnswer(field: string, transcript: string, lang: LangCode): { value: MatchValue } | null {
  void lang; // both languages are always tried: speakers mix Hindi and English freely
  const def = vocab.fields[field];
  if (!def || !transcript) return null;
  const text = norm(transcript);
  if (!text) return null;
  if (isDontKnow(transcript)) return null;

  if (def.type === "integer") {
    if (field !== "age" && !/\d|[\p{L}]/u.test(text)) return null;
    const v = matchAge(transcript);
    return v === null ? null : { value: v };
  }
  if (def.type === "boolean") {
    const b = matchBoolean(text);
    return b === null ? null : { value: b };
  }

  let id = matchEnum(field, text);
  if (id === null) {
    if (field === "income_band") id = amountToBand(text);
    else if (field === "land_band") id = landToBand(text);
    else if (field === "disability") id = disabilityFromNumber(text);
    else if (field === "student_level") id = studentFromClass(text);
  }
  return id === null ? null : { value: id };
}
