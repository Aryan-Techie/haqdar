# Haqdar web app: design

Team AROICE, HackIIITD 2026 (Round 1 deck: `iiit/AROICE_HackIIITD_Round1.pdf`). Phase 1 of 2: the web PWA. Phase 2: Android wrapper (see the end).

## Intent

Citizens miss benefits they are entitled to. They do not know the scheme exists, cannot tell whether they qualify, and fail at paperwork. Haqdar tells a citizen, in their own language and by voice or text, which government schemes they qualify for, and hands over a ready application kit.

The product is modelled on Haqdarshak's "Jana" citizen app (screens and flows studied in `docs/recon/jana-recon.md`), but it is our own product with our own name, look and copy. Where the deck and Jana differ, the deck wins.

## What makes it different (from the deck, all required)

1. **Voice-first, vernacular.** Speech in, speech out. Hindi and English first.
2. **Deterministic and cited.** A rules engine decides eligibility. An LLM never does. Every recommendation links to the official source and stores the rule version used.
3. **Consent-based, minimal data.** Few profile fields, consent captured, deletion on request, designed around the DPDP Act 2023.
4. **No signup until saving.** A citizen reaches a ranked list with no account.

## Goals

- A new user reaches a ranked list of schemes in under 3 minutes (the deck's success test).
- The engine matches a hand-verified set of sample personas (at least 12, in tests).
- 30 to 50 real schemes: central, plus Delhi and Haryana. Five categories: pension, health, education, farm, women. Each has a source URL and a last-verified date.
- Works on a phone browser and installs as a PWA. Usable on weak connections.
- The whole demo runs with no API keys.

## Non-goals (this phase)

WhatsApp bot, IVR, the assisted-agent dashboard, status tracking, direct portal submission, DigiLocker, scrapers and the ingestion review queue, more than Hindi and English UI, the Android app. The data model leaves room for them (tenant field on users, scheme `source` and `rule_version`), but nothing is built.

## Anti-goals (failure even if it technically works)

- Telling someone they are eligible when the rules say otherwise, or showing a scheme without its official source.
- Copying Jana's code, text, images or branding.
- Fabricated scheme data, office addresses or phone numbers. Unknown means unknown.
- Making the user sign up or type English before seeing value.
- An LLM or any model deciding eligibility.

## Decided with the project owner

- Web app first, then Android. The Android app is a wrapper of the web app (Jana's own Android app is one).
- Home screen is the **hybrid**: language and city strip, a large voice card ("Ask in your voice"), three tiles (Eligible, Saved, Offices), then "Suggested schemes".
- No signup until the user saves a scheme or asks for the kit.
- **One chat of 5 to 8 questions** builds the profile (not Jana's two-stage screening).
- Voice: browser speech and a scripted flow by default. SLNG (Sarvam Saaras v3 speech-to-text and Bulbul v3 text-to-speech, via one API key) is an optional provider behind a switch. The user has no keys yet.
- Stack from the deck: Next.js PWA with Tailwind, FastAPI backend.

## Experience

### Screens

1. **Language pick** (first run): English or Hindi. Stored locally. Switchable from the top strip anywhere.
2. **Home** (hybrid, above). City comes from the profile or the browser, never required.
3. **Chat**. Opens from the voice card, a typed question, or a category chip. The agent asks short questions one at a time. The user answers by tapping a choice, typing, or speaking. Questions in order of use:
   state, age, gender, occupation, annual household income band, social category.
   Conditional, only when relevant: marital status (women), land owned (farmers), disability (yes/no), student level (students).
   Hard cap of 8 questions. Every question has a "skip" that leaves the field unknown.
4. **Results**. Ranked list. Each card: scheme name, one-line benefit, a status chip (Eligible, Maybe, with what is missing), source domain. Tabs: Eligible, Maybe, Other. A "why" line per card names the rule that matched.
5. **Scheme detail**. Header with name and benefit, Share, Save. Banner: "You are eligible" or "You may be eligible, we need X". Sections: About, Who can apply (the rules in plain words), Documents (checklist, "must have" vs "if applicable"), How to apply (steps, official link), Deadline. A "Get my kit" button.
6. **Kit** (needs sign-in): the document checklist with ticks, a pre-filled application summary PDF, nearest-office link, and a calendar reminder (.ics file) for the deadline.
7. **Saved** (needs sign-in). List of saved schemes with search.
8. **Offices**. A map with government offices near the user (OpenStreetMap data queried live, browser location with a manual city fallback) and a link to the official CSC locator. No stored or invented addresses.
9. **Account**: phone number plus one-time code, consent screen, profile view and edit (Jana users complained they could not edit), export, delete my data.
10. **Search**: free-text over scheme names and tags, any language the data has.

### Voice

- A `VoiceProvider` interface in the web app, two adapters: `browser` (Web Speech API recognition and `speechSynthesis`) and `slng` (calls our own API's `/voice/stt` and `/voice/tts`, which proxy to SLNG with the key held server-side). Selected by `NEXT_PUBLIC_VOICE_PROVIDER` and an API setting. If recognition is unavailable (for example Firefox), the mic is hidden and typing works.
- Voice only fills the chat. The same scripted questions run for voice and text.
- Answers are matched to options locally (Hindi and English keyword and number matching for each question). If an answer is not understood, the question repeats once, then offers the buttons.
- The SLNG adapter is built to the documented auth header and TTS route. Its speech-to-text route and body must be confirmed against `docs.slng.ai` when a key exists. It returns a clear "not configured" error until then. Browser mode never depends on it.
- An LLM is not required. A later optional step can extract fields from free-form speech and explain results, but only the rules engine decides.

### Language

UI strings in English and Hindi (own dictionary, no heavy i18n library). Scheme text has `en` and `hi`. Anything missing in Hindi falls back to English and shows no placeholder.

## Rules engine

- Schemes are JSON records. Adding a scheme is adding a record, not code.
- A scheme's eligibility is a rule tree: `all`, `any`, `not`, and predicates `{field, op, value}`. Ops: `eq`, `in`, `gte`, `lte`, `between`, `exists`. Fields come from the profile vocabulary (state, age, gender, residence, occupation, income_band, category, marital_status, land_acres, disability, student_level). A scheme can also carry `states: ["*"]` or a list, which is checked first.
- Evaluation is three-valued per predicate: pass, fail, unknown (field not answered). A rule tree evaluates to `eligible` (all pass), `ineligible` (a required predicate fails, with the failing rule recorded), or `maybe` (no fails, at least one unknown, with the missing fields listed). Income bands are intervals, so a band that straddles a limit gives `maybe`, not `eligible`.
- Ranking: eligible before maybe; within each, by estimated benefit weight (a number on the scheme), then category fit to the user's stated interest, then deadline proximity.
- Every result stores `scheme_id`, `rule_version`, `source_url`, the profile hash, the verdict, and the reason. These go to the audit log.
- The engine is a pure function: `evaluate(profile, schemes) -> results`. It has no IO and is covered by persona tests.

## Data

- `data/schemes/*.json`, one file per scheme or per category, validated by a JSON Schema in CI (`pytest`). Fields: `id`, `name{en,hi}`, `category`, `level` (central/state), `states`, `benefit{en,hi}` and `benefit_weight`, `description{en,hi}`, `eligibility` (rule tree), `eligibility_plain{en,hi}`, `documents[]` (`name`, `required`, `note`), `how_to_apply{en,hi}` (steps), `apply_url`, `source_url`, `deadline` (or null), `last_verified` (date), `rule_version`, `verification` (`status`: `sourced` or `hand_verified`, `by`).
- The 30 to 50 records are sourced from official pages and PDFs by research agents and marked `sourced`. The project owner hand-verifies and flips `verification.status`. The UI shows the last-verified date and a "report a problem" link.
- Application data: SQLite for the MVP through SQLAlchemy (users, consent log, saved schemes, audit log). Swapping to PostgreSQL is a connection-string change. The deck's Postgres, pgvector, Redis and Celery are not needed for the MVP and are listed under later work.
- Profile storage: only the fields above, encrypted at rest (Fernet, key from env). Anonymous profiles live in the browser (localStorage) and are sent to the API for each evaluation, not stored, until the user signs in and consents.

## Accounts, consent and trust

- Sign-in: phone number plus one-time code. In the MVP the code is shown in the API logs and accepted as `123456` in dev mode, with the SMS provider behind an interface. This is a stated demo stand-in, not security.
- Consent screen before any profile is stored: what is stored, why, how long, and how to delete. Consent text version and timestamp are logged.
- `DELETE /me` removes the user, profile, saved items and consent records except an anonymised audit row. `GET /me/export` returns their data.
- API gateway behaviour (FastAPI middleware): per-IP rate limit, request IDs, structured audit log of recommendations.

## Offices

Browser geolocation, then a live Overpass query for `office=government` and similar tags, shown on a Leaflet map. Failure or denial leaves a city search box. Always show the link to the official CSC locator. Nothing is stored.

## Kit (pre-filled PDF)

The PDF is generated server-side from the signed-in user's profile and the scheme record: scheme name, official source, citizen details, the document checklist, steps to apply, the deadline, and the office link. It is a preparation sheet, not an official government form, and says so on the page.

## Look and feel

Own identity: warm orange primary (about `#E8742A`) with a deep ink background, rounded cards, large touch targets (44 px minimum), high contrast, a large Hindi-friendly typeface, mobile-first with a 390 px design width and a usable desktop layout. The visual design is left to the builder within these constraints. No purple or pink Jana palette, no Jana wording.

## Architecture (deck, trimmed to MVP)

```
web/   Next.js (App Router) PWA, Tailwind, TypeScript
api/   FastAPI, SQLAlchemy + SQLite, pytest
data/  schemes/*.json, schema/scheme.schema.json
docs/  specs, recon, plans
```

API (JSON): `POST /evaluate` (profile in, ranked results out), `GET /schemes`, `GET /schemes/{id}`, `GET /search?q=`, `POST /auth/otp`, `POST /auth/verify`, `GET/PUT /me`, `DELETE /me`, `GET /me/export`, `GET/POST/DELETE /me/saved`, `POST /kit/{scheme_id}` (PDF), `GET /reminder/{scheme_id}.ics`, `POST /voice/stt`, `POST /voice/tts`, `GET /health`.

Next.js talks to FastAPI through a rewrite (`/api/*`), so there is no CORS setup in production. Docker Compose runs both for a one-command demo.

## Constraints

- Runs on a laptop with no keys. Node 26, Python 3.15, `uv` are installed.
- 24-hour finale: a working demo matters more than breadth. Cut order if short: reminders, then export, then kit PDF styling, then Hindi for non-core text. Never cut the cited, deterministic engine.
- Public scheme data only. Cited sources only.

## Testing and success

- Engine: persona tests (at least 12 hand-made personas with the expected eligible set each, covering a widow in Haryana, a small farmer, a low-income student, a senior citizen, a person with disability, a Delhi gig worker, plus ineligible and `maybe` cases), property tests that `evaluate` never returns `eligible` when a required field is unknown.
- Data: schema validation, every record has a source URL and a date, Hindi present for core fields.
- API: tests for evaluate, auth, saved, delete, kit.
- Web: a Playwright run of the main journey (home, chat in English, results, detail, sign in, save), with a stopwatch assertion that the ranked list appears within 3 minutes of scripted answers (in practice seconds).

## Calls made after the builder check (the author's, not the project owner's; check these)

1. **States.** The state question lists all 36 states and union territories. Central schemes apply to everyone. Only Delhi and Haryana have state schemes. Any other state sees central schemes plus a notice "State schemes for <state> are coming soon".
2. **Income.** Annual household income, asked as bands: under 1 lakh, 1 to 2.5 lakh, 2.5 to 5 lakh, 5 to 8 lakh, over 8 lakh. A band is an interval [lo, hi]. Rules are written in rupees (`annual_income` with `lte`/`gte`/`between`). The engine passes a predicate only when the whole band is inside the limit, fails it only when the whole band is outside, and otherwise returns unknown. This means a band that straddles a limit gives `maybe`, never a false `eligible`.
3. **Unverified data.** The demo ships `sourced` data. The scheme detail page shows a "Verification pending" chip for any record not `hand_verified`, plus the last-verified date. The engine logic is tested against test-owned fixture schemes. A second set of persona tests runs the real data with named anchor schemes (for example the central old-age pension for a 65-year-old below-poverty-line citizen) and fails if a rule edit breaks them.
4. **Residence and occupation.** `residence` (rural or urban) and `occupation` are profile fields. Occupation options: farmer, farm labourer, construction or daily-wage worker, gig or platform worker, street vendor or self-employed, private salaried, government employee, student, homemaker, unemployed, retired. The first six questions are fixed (state, age, gender, occupation, income band, social category). Questions 7 and 8 are chosen by the engine: it ranks the remaining fields (marital status, land, disability, student level, residence) by how many `maybe` results each would resolve, and asks the top two. The cap stays at 8.
5. **Interests.** Not part of the profile. `evaluate(profile, schemes, interests=())` takes an optional list of categories from the chip or typed query that opened the chat, used only as a ranking tie-break.
6. **Offline.** The PWA is an installable shell. Scheme lists and details are cached (stale-while-revalidate). Evaluation, sign-in and the offices map need the network and show a clear offline message. No request queue.
7. **Hindi.** Hindi text is written alongside the English by the research agents and is marked `hi_reviewed: false` until the owner reviews it. CI requires Hindi only for `name`, `benefit` and `eligibility_plain`.
8. **Reminders.** The `.ics` reminder and the kit need a signed-in user. When a scheme has no deadline the reminder button is hidden.

## Left to the builder

Visual details, component structure, the exact Hindi phrasing of UI strings (reviewed by the owner), the choice of PDF library, how the question order adapts, exact benefit weights.

## Phase 2: Android (not in this build)

**Decision (author's call, 2026-10-20): a Capacitor Android shell, not a Trusted Web Activity.** Reason: Jana's own app is a TWA (it runs in Chrome), but a TWA needs a deployed HTTPS origin and Digital Asset Links before it can even be tested, and Haqdar is voice-first while the Web Speech API does not exist in an Android WebView. Capacitor runs on the emulator against a dev server today and lets voice use native speech recognition and text-to-speech through plugins.

- `android/` is a Capacitor project (app id `in.haqdar.app`, name "Haqdar"). The shell loads the live PWA through `server.url` (default `http://10.0.2.2:3000` for the emulator, overridable by `HAQDAR_APP_URL` at sync time; production sets the HTTPS URL, and cleartext is allowed only for the debug build). No web assets are bundled: the web app is the source of truth.
- Voice: a third `VoiceProvider` adapter `native` in `web/lib/voice/` using Capacitor speech-recognition and text-to-speech plugins when running inside Capacitor (detected at runtime); the browser adapter stays for web, SLNG stays optional. The microphone permission is requested natively.
- Native extras kept small: status bar colour from the brand tokens, splash screen, back-button handling (go back in the app, exit at home), `POST_NOTIFICATIONS` only if reminders need it later (not in this phase), external links (official sources, CSC locator) open in the system browser.
- Release path (documented, not done): signing key, Play Console listing, production HTTPS origin, then optionally a TWA build of the same origin for Chrome-based installs.

## Open items for the project owner

- Hand-verify the scheme records and flip `verification.status`.
- Get an SLNG key when ready and confirm the speech-to-text route.
- Confirm the app name spelling ("Haqdar") and logo.
