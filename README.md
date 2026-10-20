# Haqdar

Haqdar tells a citizen, in their own language and by voice or text, which Indian government schemes they qualify for, and hands over a ready application kit. It is the web PWA phase of the AROICE entry to HackIIITD 2026 (phase 2 is an Android wrapper).

What sets it apart:
- Voice-first and vernacular (Hindi and English first).
- Deterministic and cited: a rules engine decides eligibility, never an LLM. Every result carries the scheme id, rule version, profile hash, reason and the official source link.
- Consent-based and minimal: no sign-up until you save; the profile is encrypted at rest and can be exported or deleted.
- A ranked list in under 3 minutes with no account (checked by the Playwright journey).

Design: `docs/superpowers/specs/2026-10-20-haqdar-web-design.md`. Plan: `docs/superpowers/plans/2026-10-20-haqdar-web.md`.

## Run locally

Needs Python 3.12+ with [uv](https://docs.astral.sh/uv/), Node 22+.

Run each step in its own terminal, starting from the repo root.

```bash
# 1. API on :8000
cd api && uv sync && uv run uvicorn app.main:app --port 8000
# 2. Web on :3000 (proxies /api/* to the API; set API_URL to change the target)
cd web && npm install && npm run dev
# 3. Tests
cd api && uv run pytest -q            # add -m data for the real-scheme persona checks
cd web && npm test && npx playwright test
```

Playwright starts both servers itself if they are not running. It uses Playwright's bundled Chromium (`npx playwright install chromium`); set `E2E_BROWSER_PATH` to use a local Chromium-based browser such as Edge.

Docker (not run during development, see Known gaps): `cp .env.example .env && docker compose up --build`. Both Dockerfiles must be built with the **repo root as build context** (the API needs `data/`, the web build copies `data/schema/vocab.json`); the compose file already does this. The SQLite database lives in the `haqdar-db` volume.

## Environment variables

See `.env.example`.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `HAQDAR_ENV` | api | `dev` (default) or `production`. In production the API refuses to start unless `HAQDAR_SECRET` and `HAQDAR_FERNET_KEY` are real values, and the demo OTP is forced off. |
| `HAQDAR_SECRET` | api | Signs session tokens (7 days). Insecure dev default if unset (dev only). |
| `HAQDAR_FERNET_KEY` | api | Encrypts the profile column. Required in production. |
| `HAQDAR_DEV_OTP` | api | Dev only: OTP code is `123456`, and only for a phone that requested an OTP. Ignored in production. |
| `HAQDAR_TRUSTED_PROXY_HOPS` | api | Default 0 (rate limit keys on the socket peer). Set N when behind N trusted proxies: the Nth-from-right `X-Forwarded-For` entry is the client IP. docker-compose sets 1. |
| `HAQDAR_DATABASE_URL` | api | Default `sqlite:///./haqdar.db`. |
| `HAQDAR_DATA_DIR`, `HAQDAR_RATE_LIMIT` | api | Data directory; requests per minute per IP (120). |
| `SLNG_API_KEY`, `SLNG_BASE_URL` | api | Optional SLNG voice. Without the key voice routes return 503. |
| `SLNG_STT_MODEL`, `SLNG_TTS_MODEL` | api | Defaults `sarvam/saaras:v3`, `sarvam/bulbul:v3`. |
| `API_URL` | web | Target of the `/api/*` rewrite. Baked in at build time. |
| `NEXT_PUBLIC_VOICE_PROVIDER` | web | `browser` (default) or `slng`. Baked in at build time. |

## Voice providers

- `browser` (default): Web Speech API for listening and speech synthesis. No keys. The mic button hides itself where the browser has no speech recognition, and the chat always works with buttons and typing.
- `slng` (optional): records audio in the browser and sends it through the API proxy. Get a key from the SLNG sign-up link in the hackathon message, set `SLNG_API_KEY` in `.env`, and set `NEXT_PUBLIC_VOICE_PROVIDER=slng` before building the web app. The STT route is the constant `STT_PATH` in `api/app/voice_slng.py` and is marked `TODO(confirm against docs.slng.ai)`: check it against the SLNG docs before relying on it. If the API answers 503 the web client falls back to the browser provider.

## Data model and adding a scheme

Scheme records are one JSON file each in `data/schemes/`, validated against `data/schema/scheme.schema.json`. Allowed profile fields and values are in `data/schema/vocab.json` (also copied to `web/lib/vocab.json` by `web/scripts/sync-contract.mjs` on dev, build and test). Income and land are bands; rules are written in rupees (`annual_income`) and acres (`land_acres`).

To add a scheme:
1. Copy an existing file in `data/schemes/` and edit it. Use only an official source (`.gov.in`, `.nic.in`, official PDF) that you actually opened. Never invent a limit, address, phone number or deadline; use `null` for unknown.
2. Provide Hindi for `name`, `benefit` and `eligibility_plain`, with `verification.hi_reviewed: false` until a Hindi speaker reviews it.
3. Validate: `cd api && uv run python -c "from app.schemes import load_schemes; print(len(load_schemes()))"` (raises with the file name on a bad record), then `uv run pytest -q`.

Currently 42 schemes: central plus Delhi (`DL`) and Haryana (`HR`), across pension, health, education, farm and women.

## Owner must hand-verify the schemes

Every record was researched from official pages by agents and carries `verification.status: "sourced"`. Nothing has been checked by a person. Before real use, read each scheme against its `source_url`, correct limits and rules, then set `verification.status` to `"hand_verified"` (and `hi_reviewed` to `true` after a Hindi review) in that scheme's JSON. The UI shows a "Verification pending" marker until then. Several records note in `verification.notes` where an official criterion had no vocabulary field and the nearest field was used.

## Known gaps

- Docker files and compose were written but not built or run here (Docker daemon unavailable); `docker compose config` passes.
- Scheme data is unverified by a human; Hindi UI strings and scheme Hindi are machine-written and unreviewed.
- Real microphone, speech synthesis and SLNG were not exercised; the SLNG STT route is unconfirmed.
- Offices use live OpenStreetMap, Overpass and Nominatim and were not tested in a real browser; the public Overpass server can be slow or rate-limited.
- Sign-in profile sync is local-wins on merge; a returning user's server profile is not pulled when a local one exists.
- No scheme has a `deadline` yet (all 42 are `null`), so the "Add reminder" (.ics) button and the deadline ranking tie-break never show in a demo.
- Offline: pages you opened before and the scheme list work; anything else shows a small offline page, and eligibility, sign-in and offices need the internet.
- "Report a problem" opens the user's mail app with the scheme id, source and last-verified date filled in, but no recipient: there is no real contact address yet.
- The service worker registers only in production builds and is untested in a browser. Hindi users may see a brief English flash on first paint.
- The home question box maps to a category only by keywords.
- OTP is a dev stub (`123456`); no SMS provider is wired up.
- The web build needs network access for Google Fonts.

## Project layout

```
api/            FastAPI app (app/engine rules + evaluation, routers, kit PDF, ics, voice proxy), tests
web/            Next.js PWA (app routes, components, lib/chat, lib/voice), Vitest tests, e2e/ Playwright
data/schemes/   one JSON per scheme
data/schema/    scheme.schema.json, vocab.json (shared contract)
docs/           design spec, implementation plan, data guidelines
docker-compose.yml, .env.example, api/Dockerfile, web/Dockerfile
```

## Android

`android/` is a Capacitor shell (`in.haqdar.app`) that loads the live PWA via `server.url` (default `http://10.0.2.2:3000` for the emulator, override with `HAQDAR_APP_URL`) and uses native speech through the `native` voice adapter. Build needs JDK 21: `cd android && npm install && npx cap sync android && cd android && ./gradlew assembleDebug`. Debug APK: `android/android/app/build/outputs/apk/debug/app-debug.apk`. See `android/README.md`.
