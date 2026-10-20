# Haqdar Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Haqdar web PWA and API: voice-first chat, deterministic cited eligibility, 30 to 50 sourced schemes, no signup until saving.

**Architecture:** A pure rules engine (Python) evaluates JSON scheme records against a profile with three-valued logic. FastAPI exposes it plus auth, saved items, kit PDF, reminders and a voice proxy. A Next.js PWA runs a scripted 5 to 8 question chat (voice via a swappable provider, browser speech by default) and renders cited results.

**Tech Stack:** Python 3.15 + `uv`, FastAPI, SQLAlchemy + SQLite, pydantic, `jsonschema`, `fpdf2`, `cryptography`, pytest. Node 26, Next.js App Router, TypeScript, Tailwind, Vitest, Playwright, Leaflet.

**Spec:** `docs/superpowers/specs/2026-10-20-haqdar-web-design.md` (read it, including "Calls made after the builder check"). Studied reference: `docs/recon/jana-recon.md`. Shared contract files already exist: `data/schema/vocab.json`, `data/schema/scheme.schema.json`.

## Global Constraints

- Layout: `api/`, `web/`, `data/schemes/`, `data/schema/`, `docs/`. Python in `api/app/`, tests in `api/tests/`. Run Python only through `uv run` in `api/`.
- The engine is a pure function: no IO, no clock, no randomness. An LLM or model never decides eligibility.
- Every recommendation carries `scheme_id`, `rule_version`, `source_url`, profile hash and reason.
- Scheme data: 30 to 50 real schemes, central plus Delhi (`DL`) and Haryana (`HR`); categories `pension`, `health`, `education`, `farm`, `women`; `states` is `["*"]` or state codes from `vocab.json`. Official sources only (`.gov.in`, `.nic.in`, official PDFs). Never invent a scheme, limit, address, phone number or deadline: unknown stays `null`/absent. Hindi required for `name`, `benefit`, `eligibility_plain`; set `hi_reviewed: false`.
- Income and land are bands (intervals) from `vocab.json`; rules are written in rupees (`annual_income`) and acres (`land_acres`).
- Profile validation: `age` integer 0 to 120; enum fields must be in `vocab.json`; unknown fields rejected with 422.
- No Jana code, text, images or palette. Primary colour about `#E8742A`, ink background, 44 px minimum touch targets, 390 px design width.
- Max 8 chat questions; each question skippable (field stays unknown).
- Demo runs with no API keys. SLNG is optional behind env vars. OTP dev code `123456`.
- Secrets only in env. Profile encrypted at rest (Fernet). No git commits are made by agents in this repo (it is not a git repository); the owner commits.
- UI text exists in English and Hindi; missing Hindi falls back to English.

## Review Focus

Failure modes the spec implies; each has a test in the owning task.
1. A profile with every field unknown never yields `eligible` (Task 2).
2. Income or land band edge exactly at a rule limit yields `maybe`, not `eligible` (Task 2).
3. Age -1, 121, 65.5, "abc" and an unknown profile key return 422, not 500 (Task 3).
4. Hindi answers with Devanagari digits ("६५") and number words ("पैंसठ") parse to 65; two unrecognised answers fall back to buttons (Task 10).
5. After `DELETE /me`, the old token is rejected and saved items and profile are gone (Task 3).

## API contract (all tasks build to this)

JSON, errors `{"detail": ...}`. `Profile`: any subset of `state, age, gender, occupation, income_band, category, marital_status, land_band, disability, student_level, residence, bpl, pregnant_or_new_mother, girl_child_under_10` (field names and values from `vocab.json`; booleans for `bpl`, `pregnant_or_new_mother`, `girl_child_under_10`).

- `POST /evaluate` body `{profile: Profile, interests?: Category[]}` returns
  `{results: Result[], next_fields: string[], coverage: {state: string|null, has_state_schemes: boolean}}`.
  `Result = {scheme_id, verdict: "eligible"|"maybe"|"ineligible", rank: number, passed: Pred[], failed: Pred[], unknown_fields: string[], reason: {code: "all_rules_pass"|"missing_info"|"rule_failed"|"state_unavailable", detail: string}, rule_version, source_url, profile_hash}`; `Pred = {field, op, value}`. Results are sorted: eligible, then maybe, then ineligible; `rank` is the 1-based position. `next_fields` lists unanswered candidate fields, most `maybe`-resolving first.
- `GET /schemes` returns `{schemes: Scheme[]}`; `GET /schemes/{id}`; `GET /search?q=` returns `{ids: string[]}` (case-insensitive over names in both languages, tags and benefit text).
- `POST /auth/otp {phone}` returns `{sent: true}`; `POST /auth/verify {phone, code, consent: {version: string, accepted: true}}` returns `{token, user: {id, phone}}`. Bearer token in `Authorization`.
- `GET /me` returns `{id, phone, profile: Profile, language}`; `PUT /me {profile, language?}`; `DELETE /me`; `GET /me/export`.
- `GET /me/saved` returns `{scheme_ids: string[]}`; `PUT /me/saved/{id}`; `DELETE /me/saved/{id}`.
- `POST /kit/{scheme_id}` (auth) returns `application/pdf`; `GET /reminder/{scheme_id}.ics` (auth) returns `text/calendar`, 404 when the scheme has no deadline.
- `GET /voice/status` returns `{provider: "browser"|"slng", configured: boolean}`; `POST /voice/stt` (multipart `audio`, field `lang`) returns `{text}`; `POST /voice/tts {text, lang}` returns audio bytes; both 503 `{"detail":"voice provider not configured"}` until `SLNG_API_KEY` is set.
- `GET /health` returns `{status: "ok", schemes: number}`.

## File structure

```
api/pyproject.toml
api/app/main.py            app factory, router wiring, middleware      (Task 3)
api/app/config.py          env settings                                (Task 3)
api/app/db.py, models.py   SQLAlchemy engine, User/Consent/Saved/Audit (Task 3)
api/app/security.py        Fernet, token sign/verify, rate limit       (Task 3)
api/app/engine/vocab.py    load vocab.json, band lookup                (Task 2)
api/app/engine/rules.py    three-valued tree evaluation                (Task 2)
api/app/engine/evaluate.py evaluate(), rank, next_fields               (Task 2)
api/app/schemes.py         load+validate data/schemes, search          (Task 2)
api/app/routers/evaluate.py, schemes.py                                (Task 2)
api/app/routers/auth.py, me.py, saved.py, kit.py, voice.py, health.py (Task 3)
api/app/kit.py, ics.py, voice_slng.py                                  (Task 3)
api/tests/                 one test module per app module
data/schemes/<id>.json     one file per scheme                         (Tasks 4-8)
web/                        Next.js app                                (Tasks 9-12)
docker-compose.yml, README.md                                          (Task 13)
```

---

### Task 1: Contract (done)

`data/schema/vocab.json` and `data/schema/scheme.schema.json` are written. Do not edit them; ask the lead if a field is missing.

### Task 2: Rules engine, scheme loader, evaluate and schemes routes

**Files:**
- Create: `api/pyproject.toml` (deps: fastapi, uvicorn, sqlalchemy, pydantic, jsonschema, fpdf2, cryptography, httpx, python-multipart; dev: pytest), `api/app/__init__.py`, `api/app/engine/{__init__,vocab,rules,evaluate}.py`, `api/app/schemes.py`, `api/app/routers/{__init__,evaluate,schemes}.py`
- Test: `api/tests/test_rules.py`, `test_evaluate.py`, `test_schemes.py`, `test_personas.py`, `fixtures/schemes/*.json`

**Interfaces:**
- Consumes: `data/schema/vocab.json`, `data/schema/scheme.schema.json`.
- Produces (Task 3 and web rely on these):
  - `vocab.band(field: str, value: str) -> tuple[float, float | None]` and `vocab.PREDICATE_TO_PROFILE: dict[str, str]`.
  - `rules.Tri = Literal["pass","fail","unknown"]`; `rules.eval_rule(rule: dict, profile: dict) -> rules.RuleResult` where `RuleResult(tri: Tri, passed: list[Pred], failed: list[Pred], unknown_fields: list[str])`.
  - `evaluate.evaluate(profile: dict, schemes: list[dict], interests: tuple[str, ...] = ()) -> list[dict]` (Result dicts exactly as in the contract) and `evaluate.next_fields(profile: dict, schemes: list[dict]) -> list[str]`.
  - `schemes.load_schemes(data_dir: Path | None = None) -> list[dict]` (validates against the JSON Schema, raises with the file name on failure), `schemes.search(q: str, schemes: list[dict]) -> list[str]`.
  - `routers.evaluate.router`, `routers.schemes.router` (FastAPI `APIRouter`), reading schemes from `request.app.state.schemes`.

- [ ] **Step 1: Write failing rule tests** in `test_rules.py`:
  `test_all_pass`, `test_any_one_unknown_rest_fail_is_unknown`, `test_not_keeps_unknown`, `test_age_lte_boundary_inclusive` (age 60 `gte 60` passes), and the band semantics: `annual_income lte 100000` with band `lt_1l` passes; with `1l_2_5l` is `unknown` (edge exactly at the limit); with `2_5l_5l` fails; `annual_income between [0,250000]` with `gt_8l` fails and with `lt_1l` passes; `land_acres lte 2.5` with `lt_2_5` passes, with `2_5_5` unknown; `exists` passes only when known.
- [ ] **Step 2: Run** `cd api && uv run pytest tests/test_rules.py -q`; expect FAIL (module missing).
- [ ] **Step 3: Implement** `vocab.py` (cached load of `vocab.json`; `data_dir` resolved relative to the repo root, overridable by env `HAQDAR_DATA_DIR`) and `rules.py`. Interval rules: `lte v`: pass if hi is not None and hi <= v; fail if lo > v; else unknown. `gte v`: pass if lo >= v; fail if hi is not None and hi < v; else unknown. `between [a,b]`: pass if lo >= a and hi is not None and hi <= b; fail if (hi is not None and hi < a) or lo > b; else unknown. Point values (age, enums, booleans) use ordinary comparison. `all`: fail if any fails, else unknown if any unknown, else pass. `any`: pass if any passes, else unknown if any unknown, else fail. `not` swaps pass and fail. A predicate on a field absent from the profile is `unknown` and its `field` is added to `unknown_fields` (use the predicate name, for example `annual_income`).
- [ ] **Step 4: Run rule tests**; expect PASS.
- [ ] **Step 5: Write failing evaluate tests** in `test_evaluate.py` using fixture schemes: `test_empty_profile_never_eligible` (Review Focus 1: every verdict is `maybe` or `ineligible`, none `eligible`), `test_state_scoping` (scheme `states:["DL"]` with profile `state: "HR"` is `ineligible` with `reason.code == "state_unavailable"`; with no state it is `maybe`), `test_central_scheme_any_state`, `test_ranking_order` (eligible before maybe before ineligible; within eligible by `benefit_weight` desc; `interests` breaks ties by category; `rank` is 1-based and contiguous), `test_profile_hash_stable` (same profile in different key order gives the same hash, a changed value changes it), `test_next_fields_orders_by_resolved_maybes`, `test_next_fields_excludes_answered`, `test_band_edge_gives_maybe` (Review Focus 2, end to end).
- [ ] **Step 6: Implement** `evaluate.py`. Verdict: state check first, then `eval_rule`; `pass` gives `eligible` with `reason.code "all_rules_pass"`, `unknown` gives `maybe` with `"missing_info"`, `fail` gives `ineligible` with `"rule_failed"` and `detail` naming the first failed predicate in plain English. `profile_hash` is the first 16 hex chars of sha256 over the sorted-key JSON of the profile. `next_fields` counts, for each unanswered candidate field in `vocab.candidate_fields`, the schemes currently `maybe` whose `unknown_fields` include its predicate name, then sorts descending (ties by `candidate_fields` order); fields with count 0 are omitted.
- [ ] **Step 7: Run** `uv run pytest tests/test_evaluate.py -q`; expect PASS.
- [ ] **Step 8: Write failing loader and route tests**: `test_load_schemes_validates` (a fixture with a bad field raises an error containing the file name), `test_search_matches_hindi_and_tags`, and API tests with `TestClient` over a small app that includes only these two routers: `POST /evaluate` returns the contract shape; invalid profiles return 422 (age -1, 121, 65.5, "abc", unknown key; Review Focus 3); `GET /schemes/{id}` 404 for unknown id; `coverage.has_state_schemes` is `false` for `BR` and `true` for `DL`.
- [ ] **Step 9: Implement** `schemes.py`, the pydantic `Profile` model with `extra="forbid"` built from `vocab.json`, and the two routers. Run all of `api/tests`; expect PASS.
- [ ] **Step 10: Write `test_personas.py`** with 12 personas against `fixtures/` schemes and, in a second class marked `@pytest.mark.data`, against the real `data/schemes`: widow in HR age 52 low income; small farmer; low-income class 11 student; senior citizen 65 with BPL; person with 40%+ disability; Delhi gig worker; woman pregnant; family with daughter under 10; high-income salaried man (expects few or none eligible); empty profile; state `BR`; age 17 (minor). Real-data assertions name anchor scheme ids that exist after Tasks 4 to 8 (the lead fills them in at integration), and assert only on those.

### Task 3: API services (auth, me, saved, kit, ics, voice, security, app wiring)

**Files:**
- Create: `api/app/{main,config,db,models,security,kit,ics,voice_slng}.py`, `api/app/routers/{auth,me,saved,kit,voice,health}.py`
- Test: `api/tests/test_auth.py`, `test_me.py`, `test_saved.py`, `test_kit.py`, `test_voice.py`, `test_security.py`

**Interfaces:**
- Consumes: Task 2's `routers.evaluate.router`, `routers.schemes.router`, `schemes.load_schemes`.
- Produces: `main.create_app(database_url: str | None = None) -> FastAPI` (loads schemes into `app.state.schemes`, includes every router, adds request-id and rate-limit middleware); the full API contract above; `security.make_token(user_id: int) -> str`, `security.read_token(token: str) -> int | None`; `kit.build_pdf(profile: dict, scheme: dict, lang: str) -> bytes`; `ics.build_ics(scheme: dict) -> str | None` (None when no deadline). Config: `HAQDAR_DATABASE_URL`, `HAQDAR_SECRET`, `HAQDAR_FERNET_KEY`, `HAQDAR_DEV_OTP` (default on), `SLNG_API_KEY`, `SLNG_BASE_URL` (default `https://api.slng.ai`), `SLNG_STT_MODEL` (default `sarvam/saaras:v3`), `SLNG_TTS_MODEL` (default `sarvam/bulbul:v3`).

- [ ] **Step 1: Write failing tests**: `test_otp_flow` (otp then verify with `123456` and `consent.accepted true` returns a token; verify without consent is 422; wrong code is 401), `test_me_roundtrip_encrypts` (a profile saved through `PUT /me` is stored as ciphertext in the database, read back equal; assert the raw column does not contain the word `"HR"`), `test_me_rejects_invalid_profile_422`, `test_saved_put_delete_list`, `test_delete_me_invalidates_token_and_data` (Review Focus 5: after `DELETE /me` the token returns 401, a new user with the same phone starts with no saved items and an empty profile, and an anonymised audit row remains), `test_export_contains_profile_saved_consent`, `test_audit_logged_on_evaluate` (each `POST /evaluate` writes one audit row per ineligible-or-better result containing scheme id, rule version, hash), `test_kit_pdf_requires_auth_and_returns_pdf` (starts with `%PDF`), `test_reminder_404_without_deadline_and_ics_with`, `test_voice_status_and_503_without_key`, `test_slng_stt_calls_upstream_with_bearer` (mock `httpx` transport; asserts `Authorization: Bearer <key>` and the model id; the exact STT path is a single constant `STT_PATH` in `voice_slng.py` marked `TODO(confirm against docs.slng.ai)`), `test_rate_limit_429`, `test_health`.
- [ ] **Step 2: Run** `uv run pytest -q`; expect FAIL.
- [ ] **Step 3: Implement** modules to the signatures above. Tokens: HMAC-SHA256 over `user_id.expiry` with `HAQDAR_SECRET`, 7 days, stdlib only. Users, consents, saved, audit tables in SQLite via SQLAlchemy; the profile column holds Fernet ciphertext. Deletion removes user, profile, saved and consents, and keeps audit rows with `user_id` set to null. Rate limit: in-memory sliding window, 120 requests per minute per IP (configurable). TTS path is `/v1/tts/{model}` per SLNG docs (`Authorization: Bearer`, JSON `{text, ...}`); with `SLNG_API_KEY` unset both voice routes return 503. PDF: `fpdf2`, includes scheme name, source URL, last-verified date, citizen details present in the profile, the document checklist, steps, deadline, and the line "This is a preparation sheet, not an official government form." Hindi text needs a Unicode font: bundle `NotoSansDevanagari` under `api/app/assets/` if the file is available offline, else fall back to English-only text in the PDF and test that the fallback does not crash.
- [ ] **Step 4: Run** `uv run pytest -q`; expect PASS. Then start `uv run uvicorn app.main:app` and `curl localhost:8000/health`; expect `{"status":"ok",...}`.

### Tasks 4 to 8: Scheme data (five parallel research agents)

One agent per slice. Each writes `data/schemes/<id>.json` (one file per scheme) validated against `data/schema/scheme.schema.json`, using only official sources it actually opened with web tools. `last_verified` is the date the agent read the source (use 2026-10-20). `verification: {"status":"sourced","by":null,"hi_reviewed":false}`. Eligibility rules use only the vocabulary fields; where an official criterion has no vocabulary field (for example a specific certificate or caste list), encode the nearest field and say so in `eligibility_plain` and `verification.notes`. Do not guess limits: if a source is unreachable, skip that scheme and report it. Each agent runs `cd api && uv run python -c "from app.schemes import load_schemes; print(len(load_schemes()))"` once Task 2 exists, otherwise validates with `jsonschema` directly.

- Task 4: pension and social security (central): old-age, widow, disability pensions under NSAP, PM Shram Yogi Maan-dhan, Atal Pension Yojana, PM-SYM, PM Kisan Maan-dhan, Haryana old-age/widow/disabled pensions, Delhi pension schemes. Target 8 to 10.
- Task 5: health (central plus DL/HR): Ayushman Bharat PM-JAY, Ayushman Vay Vandana, PMSBY, PMJJBY, Janani Suraksha Yojana, Haryana Chirayu, Delhi health cover schemes. Target 6 to 8.
- Task 6: education: post-matric and pre-matric scholarships (SC/ST/OBC/minority), PM-YASASVI, National Means-cum-Merit, Haryana and Delhi scholarships, Vidyadhan-type official schemes only if government. Target 7 to 9.
- Task 7: farm: PM-KISAN, PM Fasal Bima Yojana, Kisan Credit Card, PM-KUSUM, Soil Health Card, Haryana Meri Fasal Mera Byora benefits, Delhi farmer schemes. Target 6 to 8.
- Task 8: women and child (and gig/self-employed where it fits): PM Matru Vandana Yojana, Sukanya Samriddhi, Beti Bachao Beti Padhao, PM Ujjwala, Mahila Samman/Delhi Mahila schemes, Haryana Ladli/women schemes, Stand-Up India, PM SVANidhi (vendors) under `women` only if women-specific, else skip. Target 6 to 8.

Acceptance for each: files validate; every file has an official `source_url` that returned HTTP 200 when read; Hindi present for the three core fields; an `eligibility` that evaluates without error against `{}` and against a matching profile; a short report listing skipped schemes and low-confidence rules.

### Task 9: Web foundation

**Files:**
- Create: `web/` Next.js (App Router, TypeScript, Tailwind), `web/lib/{types,api,i18n,profile,vocab}.ts`, `web/lib/vocab.json` (copied by `web/scripts/sync-contract.mjs`, run by `predev` and `prebuild`), `web/app/layout.tsx`, `web/components/{TopStrip,BottomNav,Button,Card,Chip}.tsx`, `web/public/manifest.webmanifest`, `web/public/sw.js`, `web/next.config.ts` (rewrite `/api/:path*` to `http://localhost:8000/:path*`, override by `API_URL`)
- Test: `web/lib/*.test.ts` (Vitest)

**Interfaces:**
- Consumes: the API contract.
- Produces:
  - `types.ts`: `Profile`, `Pred`, `Result`, `Scheme`, `EvaluateResponse`, `LangCode = "en"|"hi"`, exactly matching the contract and `scheme.schema.json`.
  - `api.ts`: `evaluate(profile: Profile, interests?: string[]): Promise<EvaluateResponse>`, `getSchemes(): Promise<Scheme[]>` (cached in memory and by the service worker), `getScheme(id)`, `search(q)`, `requestOtp(phone)`, `verifyOtp(phone, code, consent)`, `getMe()`, `putMe(profile, language?)`, `deleteMe()`, `getSaved()`, `saveScheme(id)`, `unsaveScheme(id)`, `downloadKit(id): Promise<Blob>`, `downloadIcs(id): Promise<Blob>`; token held by `auth.ts` (`getToken/setToken/clearToken`, localStorage, try/catch).
  - `i18n.ts`: `t(key: string, lang?: LangCode): string`, `useLang(): [LangCode, (l: LangCode) => void]`, `localize(text: {en: string, hi?: string}, lang: LangCode): string` (falls back to `en`), dictionary in `web/lib/strings.ts` with `en` and `hi`.
  - `profile.ts`: `useProfile(): {profile: Profile, setField(field, value), clear(), answeredCount}` persisted in localStorage (try/catch, works without storage).
  - Layout with `TopStrip` (language switch, optional city) and `BottomNav` (Home, Saved, Offices, Account).
  - Design tokens in `tailwind.config.ts` (`brand` orange, `ink`, `paper`), Devanagari-capable font via `next/font` (Noto Sans and Noto Sans Devanagari).

- [ ] **Step 1: Scaffold** with `npx create-next-app@latest web --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*"` (non-interactive), add Vitest.
- [ ] **Step 2: Write failing unit tests**: `i18n.test.ts` (`localize` falls back to English when `hi` is missing; `t` falls back to English when a key is missing in Hindi), `profile.test.ts` (store works when `localStorage` throws), `api.test.ts` (`evaluate` posts `/api/evaluate` with the profile; non-2xx throws an error carrying `detail`).
- [ ] **Step 3: Implement** to the signatures; run `npm test`; expect PASS. Run `npm run build`; expect success.
- [ ] **Step 4: PWA**: manifest (name "Haqdar", `display: standalone`, `theme_color #E8742A`, icons generated as simple orange SVG-to-PNG placeholders), `sw.js` caching the shell and `/api/schemes` with stale-while-revalidate, registered from the layout.

### Task 10: Home, chat and voice

**Files:**
- Create: `web/app/page.tsx` (hybrid home), `web/app/chat/page.tsx`, `web/lib/chat/{flow,questions}.ts`, `web/lib/voice/{types,browser,slng,index,match}.ts`, `web/components/{VoiceCard,ChatBubble,QuestionInput,MicButton}.tsx`
- Test: `web/lib/chat/flow.test.ts`, `web/lib/voice/match.test.ts`; Playwright in Task 13.

**Interfaces:**
- Consumes: Task 9's `api.evaluate`, `useProfile`, `localize`, `vocab.json`.
- Produces:
  - `flow.ts`: `nextQuestion(profile: Profile, nextFields: string[], asked: string[]): string | null` — the six fixed fields in `vocab.fixed_order` first (skipping answered or skipped), then at most two from `nextFields` (total asked never above `vocab.max_questions`), else `null`.
  - `match.ts`: `matchAnswer(field: string, transcript: string, lang: LangCode): {value: string | number | boolean} | null` — enums by id, English or Hindi label and synonyms; `age` parses ASCII digits, Devanagari digits and Hindi/English number words (0 to 120); booleans from yes/no and "हाँ/हां/नहीं/ना".
  - `voice/types.ts`: `VoiceProvider {name: "browser"|"slng"; supportsListening(): boolean; listen(lang: LangCode): Promise<string>; speak(text: string, lang: LangCode): Promise<void>; cancel(): void}`; `voice/index.ts`: `getVoiceProvider(): VoiceProvider` chosen by `NEXT_PUBLIC_VOICE_PROVIDER` (default `browser`).

- [ ] **Step 1: Write failing tests**: `match.test.ts` (Review Focus 4: `matchAnswer("age","६५","hi")` and `("age","पैंसठ","hi")` and `("age","sixty five","en")` all give 65; `"छियासी"` gives 86; `matchAnswer("gender","महिला","hi")` gives `female`; `("occupation","kisan","en")` gives `farmer`; `("age","abc","en")` is `null`; age 121 is `null`), `flow.test.ts` (never more than 8 questions; skipped fields are not re-asked; with no `nextFields` it stops after 6; stops asking once all fixed fields are answered or skipped and `nextFields` is empty).
- [ ] **Step 2: Run** `npm test`; expect FAIL.
- [ ] **Step 3: Implement** `match.ts`, `flow.ts`; then `browser.ts` (Web Speech API `SpeechRecognition`/`webkitSpeechRecognition` with `hi-IN`/`en-IN`, `speechSynthesis`; `supportsListening()` false when the API is missing so the mic is hidden), `slng.ts` (records with `MediaRecorder`, posts to `/api/voice/stt` and `/api/voice/tts`).
- [ ] **Step 4: Chat page**: each question appears as a bubble with tappable option buttons, a typed input for `age`, a mic button (hidden when unsupported), a Skip button; speaking reads the question aloud when the user turned voice on. Two unmatched voice answers in a row for one question hide the mic prompt and show the buttons only. After the last question call `api.evaluate` and route to `/results`. The conversation also works with the keyboard only.
- [ ] **Step 5: Home** (hybrid, per spec): language and city strip, large "Ask in your voice" card linking to `/chat`, tiles Eligible, Saved, Offices, "Suggested schemes" (featured by `benefit_weight` from cached `/schemes`, filtered by the profile when present), category chips that open `/chat?interest=<category>`. First visit shows a language chooser (English, हिन्दी).
- [ ] **Step 6: Run** `npm test` and `npm run build`; expect pass. Manually check in the browser at 390 px width.

### Task 11: Results, scheme detail, search

**Files:**
- Create: `web/app/results/page.tsx`, `web/app/schemes/[id]/page.tsx`, `web/app/search/page.tsx`, `web/components/{SchemeCard,VerdictChip,Accordion,DocChecklist,SourceLink}.tsx`
- Test: `web/components/*.test.tsx` (Vitest + Testing Library)

**Interfaces:**
- Consumes: Task 9 client and types; evaluation response stored in session storage by Task 10 under key `haqdar:results`.
- Produces: routes `/results`, `/schemes/[id]`, `/search`; `SchemeCard({scheme, result?, onSave?})`.

- [ ] **Step 1: Write failing component tests**: `SchemeCard` shows the verdict chip, source host, and for `maybe` the missing fields in the user's language; a record with `verification.status "sourced"` shows "Verification pending" on detail; a scheme with `deadline: null` shows no reminder button; `ineligible` results show the plain reason.
- [ ] **Step 2: Implement** results with tabs Eligible, Maybe, Other (the notice from `coverage.has_state_schemes == false` shown above the list), a "why" line per card from `passed`/`failed`, and a button "Answer 2 more questions" when `next_fields` is non-empty (returns to chat). Detail page per spec: header, Share (Web Share API with a copy-link fallback), Save (prompts sign-in, Task 12), banner, accordions About, Who can apply (`eligibility_plain`), Documents (checklist from `documents`, "must have" tag), How to apply, deadline, official source and last-verified date, "Get my kit". Search page calls `/api/search` and lists cards.
- [ ] **Step 3: Run** `npm test` and `npm run build`; expect pass.

### Task 12: Account, saved, kit, offices

**Files:**
- Create: `web/app/account/page.tsx`, `web/app/saved/page.tsx`, `web/app/kit/[id]/page.tsx`, `web/app/offices/page.tsx`, `web/components/{SignInSheet,ConsentSheet,OfficeMap}.tsx`, `web/lib/offices.ts`
- Test: `web/lib/offices.test.ts`, `web/components/SignInSheet.test.tsx`

**Interfaces:**
- Consumes: Task 9 client, `useProfile`.
- Produces: `signInSheet.open(): Promise<boolean>` (resolves true after a verified sign-in with consent); `offices.ts`: `buildOverpassQuery(lat: number, lon: number, radiusM: number): string`, `parseOverpass(json: unknown): {id: string, name: string | null, lat: number, lon: number}[]`.

- [ ] **Step 1: Write failing tests**: `offices.test.ts` (query string contains `office=government` and the coordinates; `parseOverpass` drops elements without coordinates and handles empty or malformed JSON by returning `[]`), `SignInSheet.test.tsx` (verify button disabled until consent is ticked; wrong code shows the error text; success calls `setToken`).
- [ ] **Step 2: Implement** sign-in sheet (phone, code; shows the consent text with version `"2026-10-20"`; on success syncs the local profile with `putMe`), account page (view and edit profile fields from `vocab.json`, language, export, delete with confirmation, sign out), saved page (list with search, remove), kit page (checklist with local ticks, "Download preparation sheet" calling `downloadKit`, "Add reminder" calling `downloadIcs` only when `deadline` exists, nearest office link). Offices page: browser geolocation, then a Leaflet map (OpenStreetMap tiles) with Overpass results, manual city search (Nominatim) when denied, an offline notice when the fetch fails, and the official CSC locator link `https://locator.csccloud.in/`. Nothing is stored.
- [ ] **Step 3: Run** `npm test` and `npm run build`; expect pass.

### Task 13: Integration, end-to-end, packaging

**Files:**
- Create: `docker-compose.yml`, `api/Dockerfile`, `web/Dockerfile`, `README.md`, `web/e2e/journey.spec.ts`, `web/playwright.config.ts`, `.gitignore`
- Modify: `api/tests/test_personas.py` (fill the real anchor scheme ids)

**Interfaces:**
- Consumes: everything.

- [ ] **Step 1**: Fill the real-data persona assertions with scheme ids that exist in `data/schemes`; run `cd api && uv run pytest -q -m data`; expect PASS. Fix rules in data (not tests) only when the rule is wrong against its official source.
- [ ] **Step 2: Playwright journey** (`journey.spec.ts`, English, mobile viewport 390x844): open `/`, choose English, tap the voice card, answer the chat by buttons and typing, reach `/results`, assert at least one `eligible` card with a visible source link, open a detail page, assert the checklist, press Save, sign in with phone and `123456` plus consent, assert it is saved, assert the whole path from home to ranked list took under 180 seconds. Run `npx playwright test`; expect PASS.
- [ ] **Step 3: Packaging**: Compose runs `api` on 8000 and `web` on 3000; `README.md` has the three-command local run, the persona test run, the env vars, the "owner to verify data" note and the SLNG setup steps.
- [ ] **Step 4**: Final check: `uv run pytest -q`, `npm test`, `npm run build`, `npx playwright test` all green; list outstanding owner actions.
