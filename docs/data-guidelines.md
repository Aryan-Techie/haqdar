# Haqdar data guidelines

Scheme records live in `data/schemes/*.json`. The shared question vocabulary is `data/schema/vocab.json` (copied to `web/lib/vocab.json` by `npm run` scripts). Records that cannot be confirmed are parked in `data/_parked/` and are not loaded.

## Rules for facts

- Use only facts from official sources you actually opened (government sites, PIB, gazette or guideline PDFs).
- Never guess a limit, amount, URL or deadline. If a fact cannot be confirmed, leave it out and say so in `verification.notes`.
- Put the source URLs you opened in `verification.notes`, and say what is NOT encoded in the rule.
- If a rule cannot express an official criterion (no vocab field), write it in `eligibility_plain` so the user sees it, and say so in the notes.
- A pending change (approved but not in force) is described in the text but the rule encodes what is in force today.

## How to add a scheme

1. Open the official page or guideline. Note amount, who qualifies, limits, how to apply, documents.
2. Copy a similar record in `data/schemes/` and change every field. The file name equals `id`. Id prefix: `hr-`, `dl-` for state schemes, none for central.
3. `states`: `["*"]` for central schemes, otherwise state codes from the vocab (`HR`, `DL`, ...).
4. `eligibility`: use only fields and values from `data/schema/vocab.json` (`all`, `any`, `not`; ops `eq`, `in`, `gte`, `lte`, `between`, `exists`). Income and land are band based, so `lte 250000` matches a whole band; a boundary such as "below Rs 2.5 lakh" cannot be expressed exactly.
5. Write `eligibility_plain` (English, plus Hindi) as one line per condition, including conditions the rule does not check.
6. Set `benefit_weight` from the rubric below. Set `last_verified` to the date you opened the source, `rule_version` `1.0.0`.
7. Set `verification` to `{"status": "sourced", "by": null, "hi_reviewed": false, "notes": "..."}`.
8. Validate (below).

## How to validate

Schema check for all records:

```
cd api && uv run python -c "import json,glob,jsonschema; s=json.load(open('../data/schema/scheme.schema.json')); [jsonschema.validate(json.load(open(f)),s) for f in glob.glob('../data/schemes/*.json')]; print('ok')"
```

Data tests (rules against the vocabulary, states, persona anchors):

```
cd api && uv run pytest -q -m data
```

Full suite: `cd api && uv run pytest -q`.

## What `verification.status` means

- `sourced`: the record was written from official sources by an agent or researcher and has NOT been checked by the owner. All records start here.
- `hand_verified`: the owner has opened the official source and checked amounts, limits, rule and plain text against it.

To flip it, the owner:
1. Opens each URL in `verification.notes` and `source_url` and checks the benefit, eligibility rule, `eligibility_plain`, documents and `apply_url`.
2. Fixes anything that differs.
3. Sets `"status": "hand_verified"`, `"by": "<owner name>"` and updates `last_verified` to that date.
4. Runs the validation commands.

## Hindi

Hindi text is a draft and is unreviewed until `verification.hi_reviewed` is `true`. A native speaker reviews every Hindi string in the record (name, benefit, description, plain-text rules, documents, steps), fixes it, and then sets `hi_reviewed` to `true`. Use simple Devanagari.

## `benefit_weight` rubric

Weight ranks results (higher first). It reflects how valuable the benefit is, not how likely the user is eligible.

| Benefit type | Weight range |
| --- | --- |
| Annual cash value of Rs 36,000 or more | 65 to 85 |
| Annual cash value Rs 12,000 to 36,000 | 45 to 65 |
| Annual cash value under Rs 12,000 | 25 to 45 |
| Health or accident cover per family of Rs 1 lakh or more (large cover) | 80 to 90 |
| Small contingent insurance cover (for example Rs 2 lakh accident or life cover for a small premium) | 55 to 70 |
| Loans, credit, subsidy, services | 35 to 60 |
| Scholarships | by annual amount, same cash bands as above |

One-time cash is counted as one year. Within a band, score higher for the larger amount; schemes with the same amount get the same weight.

Current weights and the reason:

| Record | Weight | Reason |
| --- | --- | --- |
| ayushman-bharat-pmjay | 90 | Rs 5 lakh family health cover, top of range |
| ayushman-vay-vandana | 88 | Rs 5 lakh health cover, age 70+ |
| hr-chirayu-ayushman | 85 | Rs 5 lakh cover, contribution above Rs 1.8 lakh income |
| dl-arogya-kosh | 80 | up to Rs 5 lakh assistance, case based |
| dl-tuition-fee-reimbursement-sc-st-obc | 70 | up to Rs 48,000 a year |
| hr-old-age-samman-allowance, hr-divyang-pension, hr-widow-destitute-women-pension, hr-ladli-social-security-allowance | 68 | Rs 3,200 a month = Rs 38,400 a year |
| hr-deen-dayal-lado-lakshmi-yojana | 58 | Rs 2,100 a month = Rs 25,200 a year |
| dl-financial-assistance-special-needs, dl-women-in-distress-pension | 55 | Rs 2,500 a month = Rs 30,000 a year |
| dl-old-age-assistance | 52 | Rs 2,000 to 2,500 (plus 500) a month |
| pmjjby | 60 | Rs 2 lakh life cover, small premium |
| pmsby | 55 | Rs 2 lakh accident cover, narrower |
| pmfby, hr-mukhya-mantri-bagwani-bima-yojana | 60 | crop insurance and compensation, top of subsidy/service band |
| stand-up-india | 60 | loan Rs 10 lakh to 1 crore |
| kisan-credit-card | 55 | credit and interest subvention |
| dl-merit-scholarship-sc-st-obc, per-drop-more-crop-micro-irrigation (50), pm-yasasvi-post-matric-obc (50), sc-post-matric-scholarship (50), st-post-matric-scholarship (50) | 55 / 50 | scholarship up to Rs 24,000; others up to about Rs 20,000 or less; subsidy 55% |
| atal-pension-yojana, pm-kisan-maandhan, pm-shram-yogi-maandhan | 50 | contributory pension, deferred to age 60 |
| pm-ujjwala-yojana | 50 | free connection worth Rs 1,300 to 2,050 plus subsidy |
| hr-aapki-beti-hamari-beti | 48 | one-time Rs 21,000 |
| nmmss-scholarship | 45 | Rs 12,000 a year |
| janani-suraksha-yojana-lps | 45 | one-time Rs 1,400 |
| pm-kisan, pm-matru-vandana-yojana, janani-suraksha-yojana, sukanya-samriddhi-yojana | 40 | Rs 6,000 a year; Rs 5,000 to 6,000 one time; Rs 700 one time; savings account |
| dl-mukhyamantri-vidyarthi-pratibha-yojana, pmsma, soil-health-card | 35 | Rs 5,000 to 10,000 scholarship; free check-up; free service |
| pm-yasasvi-pre-matric-obc | 30 | Rs 4,000 a year |
| nsap-igndps, nsap-ignwps | 28 | Rs 3,600 a year |
| nsap-ignoaps | 25 | Rs 2,400 a year |

Notes in the records are not rewritten for weights, so this table is the written reason.
