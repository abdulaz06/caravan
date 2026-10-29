# Caravan — engineering guide

Caravan is a public, portfolio-grade **group-trip planner**. Someone starts a trip at `/new`, drops the invite link (`/t/<slug>`) in the group chat, and each friend builds their own version of the trip from curated options; the organizer sees where the group overlaps. Destinations are **presets** (typed JSON), so the app knows nothing about any particular place.

It began as a private app built for one friend group's trip (Sri Lanka, Dec 2026 – Jan 2027) and was generalised into Caravan in Oct 2026.

> **HARD RULE — the original app must never be affected.** Caravan was forked from **Lanks** (a separate private repo, Supabase project and Vercel project used by real people). From Caravan: never push to the Lanks repo, never read or use its `.env.local`, keys or Vercel project, never run anything against its database or site, and never pull from it again. Caravan has its own repo (`abdulaz06/caravan`), Supabase project, Vercel project, `SESSION_SECRET` and admin credentials. `src/lib/infra-guard.ts` refuses to boot against the Lanks database (stored only as a hash).

**Aesthetics are a core requirement.** Every screen should look beautiful on a phone opened from a WhatsApp/iMessage link, and excellent on desktop.

## Stack
Next.js 16 (App Router; read `node_modules/next/dist/docs` before using an API you're unsure of) · React 19 · TypeScript · Tailwind CSS v4 (`@theme` tokens) · Framer Motion · dnd-kit (touch-friendly drag) · zod · Supabase Postgres, **server-only** with the service key and RLS on with no policies · `jose` signed httpOnly cookies · bcryptjs PINs · Vitest · Playwright · Vercel.

## Map of the code
| Where | What |
|---|---|
| `presets/<id>/` | A destination: `preset.json`, `photos.json` (+ picks/queries), `images/`. Registered in `src/presets/registry.ts` (server-only). `docs/PRESETS.md` explains every field. |
| `src/engine/` | The trip engine, destination-agnostic and pure: preset schema + validation, catalog compilation, day structure (any length), rules, itinerary normalisation/migration/re-flow, timeline, budget, quick fill, routes, family-friendly mode, highlights, popular picks. Every function takes the `Engine` (`{ catalog, rules, plans }`) explicitly — no globals. |
| `src/engine/consensus/` | The group-plan generator (pure, deterministic, no AI): votes with equal voice, dates, slots inside the trip's rules, fair floor → fill → improve, splits, reasons, satisfaction, compare modes, knobs. `docs/CONSENSUS.md` explains it. |
| `src/lib/server/` | Server-only: the store (`db.ts`: Supabase or the local JSON store), sessions, trip context (`trip.ts`), route helpers (`withTrip`), organizer checks (`asOrganizer`), saving plans, group stats, popular picks, the group plan adapter (`plan.ts`: ballots, the privacy-stripped traveller view, RSVPs), exports, trip creation (`new-trip.ts`), destinations for Caravan's own pages. `src/lib/demo-crew.ts` is the demo's fictional crew (pure). |
| `src/app/` | `/` landing · `/new` start a trip · `/t/[slug]/…` a trip (welcome, join, trip builder, group, person, peek, `plan` and `plan/print`, `admin` console) · `/demo` · `/past`, `/past/[id]`, `/past/[id]/story` · `/case-study` · `/api/trips` · `/api/t/[slug]/…` trip APIs (incl. `admin/plan`, `plan`, `plan/rsvp`) · `/api/cron/reset-demo`. |
| `content/past-trips/` | Past trips (anonymised real trips): preset id, dates, picks per day, story slides. Loaded by `src/lib/server/past-trips.ts`. |
| `src/components/` | `caravan/` (landing, new trip) · `trip/` (builder) · `group/` · `admin/` · `brand/` · `ui/`. Client components get the engine and trip paths from context: `useEngine()`, `useTrip()` (`href(path)`, `api(path)`, `demo`). Never hard-code `/trip` or `/api/...` — always `trip.href()` / `trip.api()`. |
| `scripts/` | `dev-local.mjs` (port 3100, local store), `smoke.mjs`, `shoot.mjs`, `validate-presets.ts`, `warm-demos.ts` (post-build demo warm-up), `consensus-report.ts` (docs/CONSENSUS-DEMO.md), `sync-presets.mjs` (preset images → `public/presets/`, gitignored), `fetch-photos.mjs`, `image-candidates.mjs`, `make-map-outline.py` (Natural Earth → preset map), `make-brand-assets.mjs`, `make-share-fonts.py`, `record-demo.mjs` / `record-desktop.mjs` / `record-linkedin.mjs` (walkthrough videos; `lib/frame-capture.mjs` is frame-exact 60 fps capture, `lib/stage.mjs` the camera, cursor and captions, `lib/seed-crew.ts` seeds the demo travellers into a local trip). |
| `supabase/migrations/` | SQL to paste into the Supabase SQL editor, idempotent, in date order. |

## Trips and identity
- `trips` (slug, name, preset_id, edits_locked, rules jsonb, kind `live | demo`, creator_hash). People, itineraries, activity log, peeks, plan versions and RSVPs all belong to one trip; every API checks the target belongs to the trip in the URL.
- No accounts: join a trip with a display name (unique per trip, case-insensitive) + 4-digit PIN. 5 wrong PINs lock that name for 5 minutes. The session cookie maps trip → participant (up to 20 trips per device).
- Whoever starts a trip is its **owner**. Owner-only: make/remove admins, delete an admin, reset an admin's or the owner's PIN. Nobody can demote or delete the owner. Every `/api/t/[slug]/admin/*` endpoint checks the role server-side; the console asks organizers to re-confirm their PIN (12-hour console session). `ADMIN_PASSWORD` is a break-glass owner login.
- Trip creation is rate limited (`src/lib/server/new-trip.ts`) by a salted hash of the IP — never store raw IPs — and has a honeypot field.
- **The demo trips** (`/demo` chooser, `/demo/<preset>` → `/t/demo-<preset>`, `src/lib/server/demo.ts` + `src/lib/demo-crew.ts`): one per destination, 12 fictional travellers each on their own dates, with a published group plan and RSVPs; rebuilt from scratch under a temporary slug and swapped in (visitors never wait or see a half-built one): after each production build (`postbuild` → `scripts/warm-demos.ts`), in the background when a visit finds an older `DEMO_SEED` (seed ≥ the code's counts as current), and nightly by Vercel Cron (`CRON_SECRET`). Adding a preset to the demo = an entry in `DEMOS` (each traveller's dates and answers using that preset's choice ids). Visitors join as **guests** (`participants.guest`, no PIN), who never appear in counts, lists, popular picks or exports except to themselves. Join/login are refused there. Its console is open to anyone and read-only: `asOrganizer` refuses every write with 403 `demo`; read-only routes (exports, generating and comparing a plan as a preview) pass `{ readOnly: true }`.

## Data safety (non-negotiable)
- Itinerary `data` is versioned (`version: 3`). Changes must be backward compatible: new fields optional; a field an older client doesn't send means "unchanged"; migrations are safe and idempotent and never lose picks they can keep. Rules changes that invalidate plans show an impact preview first, then migrate and stamp a one-time note.
- Tests and scripts run on the local store (`CARAVAN_LOCAL_STORE=1`, `.data/dev-db.json`). Test users are named `zz-test-…` and are excluded from every count, list and export (`src/lib/test-users.ts`).
- Privacy: peek (`/peek/[id]`) returns picks and dates only; browsing returns picks, dates, day notes and interests; private answers (budget, dietary, free text, roommate picks) are organizers-only (console + exports). Popular picks are counts, never who. The group plan's traveller view is counts only (who picked what, floor attributions, split camps and RSVP names are organizers-only, stripped on the server).

## The product, briefly
- **Dates:** free by default — each traveller taps their first and last day (or drags either end) within the trip's dates, any length in the rules' range (default 1–14 days, with a “most groups do…” hint); changing dates re-flows the days, keeping every pick that still fits, with a one-time note and Undo. The **Fixed trip length** rule (off by default) makes it a fixed-width window to drag (nights per base), with a preview length if the rules allow it (never autosaved). The server rejects submissions that aren't an allowed length.
- **Days:** the preset's structure — bases with nights, transfer days with optional en-route stops, arrival and departure days. Each day has Daytime and Evening slots, each an ordered list: the first pick from an A-vs-B matchup, then "+ Add another" from a filterable catalog (options, Quick extras, Stay in). Travel hops, soft time totals, day-of-week availability, special dates (e.g. NYE) pinned to their date, big day trips with variants, quick fill.
- **Preferences** (all optional), **review** (timeline, route map, balance meter, budget, share images), **submit**; edit any time until the organizers lock edits.
- **Group:** date heatmap (sweet spot at the typical length), popular picks, group spectrum, browse submitted plans, peek at drafts.
- **The group plan:** organizers choose how the group decides (no default), generate, swap/lock, accept splits, compare modes, save versions and publish; travellers see “The plan” (`/t/[slug]/plan`) with reasons, RSVPs, “Your picks made it”, share images and a print view. See `docs/CONSENSUS.md`.
- **Budget** in 10 currencies (live rates, cached, with a fallback table); all content prices are USD.
- **Family-friendly mode:** a view-only switch that swaps every nightlife item for its `familySwap` and shows no nightlife words anywhere (`src/engine/family-banned-words.json`, enforced by the preset validator). Never changes saved data.
- **Share images:** 9:16 and square posters drawn on a canvas with embedded fixed-weight fonts (`public/fonts/share/`), no personal notes.

## Design
- **Caravan's own brand** is travel-evocative, premium and neutral: midnight ink-blue, terracotta, brass, sage on warm paper (`src/app/globals.css` defaults). The mark is three overlapping discs on a rising line (`src/lib/brand.ts`, shared with the canvas). Use `<Lockup>`, `<CaravanMark>` (`src/components/brand/wordmark.tsx`) and `<TripMark>` (trip name + mark, inside a trip); the wordmark always uses `font-brand` (Fraunces), never a trip's font.
- **Each trip wears its preset's theme** (palette scales, display/body fonts, illustration set) via `<PresetTheme>` in the trip layout. Components use semantic tokens (`primary`, `secondary`, `accent`, `highlight`, `pop`, `night`, `surface`, `paper`, `ink`) — never destination colours.
- Mobile-first, big photography with credits, delightful but restrained motion, respects reduced motion, accessible contrast.
- Brand assets are generated by `scripts/make-brand-assets.mjs` (icons, Caravan OG image, one OG image per preset).

## Content
Options live in presets, researched from at least two recent sources (traveller reviews over listicles), each with a "why people love it" line, sources, and real credited photos (Wikimedia Commons preferred) optimised to WebP. Flag anything that needs re-checking closer to the date. Run `npm run preset:validate` after any change.

## Engineering rules
- Never commit secrets; keep `.env.example` current. All Supabase access server-side; validate every input with zod.
- No real people's names in the product or content (the author's own name is fine).
- Before calling something done: `npm run typecheck`, `npm run lint`, `npm test`, `npm run preset:validate` and `npm run build` pass, and key screens are checked at phone and desktop sizes (`node scripts/smoke.mjs`, `node scripts/shoot.mjs`) with the screenshots reviewed critically.
- Commit in logical chunks with clear messages. `SETUP.md` must always explain, step by step, how to run locally and deploy.

## Out of scope (for now)
Payments, bookings, notifications.
