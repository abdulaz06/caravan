# Lanks — Sri Lanka Group Trip Planner

## What this is
A mobile-first web app for a friend group of ~12–13 people planning a December 2026 / January 2027 trip to Sri Lanka (last year's trip: Georgia, Dec 26 – Jan 2, over New Year's Eve). The organizer (Abdul) drops one link in the group chat. Each friend opens it, spends anywhere from 3 to 20+ minutes, and **crafts their own ideal itinerary** from curated options. Abdul later analyzes everyone's data (with AI) to build the final group itinerary. The analysis/"findings" part is **out of scope** — this app collects rich, structured preferences and makes the experience feel great.

**Aesthetics are the #1 priority.** It must look beautiful and impressive on a phone opened from a WhatsApp/iMessage link. Treat visual design, motion and polish as core requirements, not extras.

## Stack (decided)
- Next.js (App Router) + TypeScript + Tailwind CSS
- Framer Motion for animation; dnd-kit for drag-and-drop (must work well with touch)
- Supabase (Postgres) for storage — accessed **only from server code** (route handlers / server actions) using the service-role key. Enable RLS on all tables with no public policies, so the anon key can't read anything.
- Hosted on Vercel (owner already has an account), repo on GitHub (owner: `abdulaz06`)
- Session: signed httpOnly cookie (e.g., `jose` JWT with `SESSION_SECRET`), ~1 year expiry
- PINs hashed with bcrypt (bcryptjs)

## Users & identity (no accounts, no email)
- **First visit:** "Join the trip" → enter display name + choose a 4-digit PIN. Name must be unique (case-insensitive); if taken, suggest adding a last initial.
- The device remembers them via cookie → they land straight back in their itinerary.
- **New device / cleared cookies:** "I've been here before" → tap their name from the list of people who've joined → enter PIN.
- People add themselves; there is no preset name list.
- Basic PIN brute-force protection: after 5 wrong attempts, lock that name for 5 minutes.
- Admin can reset a PIN or delete a participant.

## Core flow
1. **Welcome** — hero poster for Sri Lanka, short explainer ("Build your dream Sri Lanka trip. Takes 5 minutes, or as long as you like."), how many friends have joined/submitted.
2. **Identity** — join or returning (above).
3. **Dates** — calendar range picker covering **Dec 1, 2026 – Jan 31, 2027**. Pick start and end. Badge: "Recommended: 4–5 days". Also ask date flexibility (exact / ± a couple of days / very flexible). Show the trip length live. Changing dates later adds/removes day cards while preserving existing picks where possible.
4. **Build your days** (the heart of the app) — see below.
5. **Your preferences** — every field optional, skippable in one tap (see list below).
6. **Review & submit** — beautiful timeline of their trip, balance meter, then Submit (celebratory moment, e.g., confetti).
7. **After submitting** — they can view their itinerary, edit anything at any time until the organizer locks edits, see the group overview, and browse others' submitted itineraries.

Progress autosaves continuously as a draft (debounced). Status: `draft` → `submitted`; editing after submit keeps it submitted but updates `updated_at`.

### Two speeds
- **Quick path (~5 min):** dates → "Quick fill" (auto-fills days with a balanced set they can tweak) → submit.
- **Deep path:** hand-pick every slot, reorder, add notes, fill all preferences.
Both must feel natural; never force the long path.

## Building days — the rules
- Each calendar day in their range is a **day card** labeled with its real date (e.g., "Sat 26 Dec"). First day tagged "Arrival", last day tagged "Departure". All slots are optional (arrival/departure days may only have a night or day).
- Each day card has two slots: **Daytime** and **Evening**.
- Options come from a **pool of pairs** (pool, not fixed order):
  - **Day pairs:** each pair = two daytime options, typically nature/adventure vs. a more social/city/beach option.
  - **Night pairs:** each pair = two evening options, typically a big night out vs. a mellower social night.
  - For any Daytime slot the user opens a sheet showing the day-pair pool, each pair displayed as a side-by-side "A vs B" matchup; they pick one option from one pair. Same for Evening with night pairs.
  - A pair can be used **once per itinerary**; used pairs show as "Used on Day 3" (tap to swap it here instead).
  - **Every Evening slot also offers a third choice: "Chill night in"** (dinner and hang at the villa/hotel). It's always available and can be used any number of times.
- **New Year's Eve:** if their range includes Dec 31, that day's Evening slot shows a dedicated **NYE pair** (plus chill-night-in) instead of the normal pool. The NYE pick is pinned to Dec 31.
- **Fluid editing (critical):** users can at any time
  - change any pick,
  - **drag to reorder whole days** (contents move; dates stay attached to positions),
  - move/swap a single Daytime or Evening pick to another day's same slot,
  - clear a slot,
  - add a short personal note to any day.
  When reordering, the Dec 31 Evening NYE pick stays pinned to Dec 31.
- **Balance meter:** every option has a `vibe` score from -2 (pure nature/adventure) to +2 (pure nightlife). Show a live, good-looking meter of their trip's overall nature ↔ nightlife balance as they pick. Chill night in = 0.

### Geography & road trips
Sri Lanka is "open to travel", framed as a road trip. Every option has a `region`. When consecutive slots are in different regions (including from the airport at the start), **auto-insert a "Road trip" segment in the timeline before that slot**, showing from → to and approximate duration (e.g., "🚐 Road trip · Kandy → Ella · ~5 hrs"; mention the famous scenic train where relevant). Day 1 starts from Bandaranaike International Airport (CMB). If a day's travel gets unrealistic (e.g., daytime in Ella and evening in Colombo), show a gentle, friendly warning — never block.

Regions and approximate private-van drive times live in `src/content/regions.ts` (verify and refine; these are starting values):
| From → To | ~Hours |
|---|---|
| Airport → Negombo | 0.5 |
| Airport → Colombo | 1 |
| Colombo → Galle / Unawatuna | 2 |
| Colombo → Mirissa / Weligama | 2.5–3 |
| Galle → Mirissa | 1 |
| Colombo → Kandy | 3 |
| Kandy → Sigiriya / Dambulla | 2.5 |
| Kandy → Nuwara Eliya | 3 |
| Nuwara Eliya → Ella | 2.5 |
| Kandy → Ella | 5–6 (scenic train ~7) |
| Ella → Yala / Tissa | 2 |
| Ella → Mirissa | 4 |
| Airport → Sigiriya | 4 |
Use a full symmetric matrix; fill missing pairs sensibly.

## Content (researched by Claude Code, edited by Abdul)
All activity content lives in **typed data files** in `src/content/` (no admin UI for content). Abdul will review and edit these.

Research real, currently operating places/activities with the web search tool. December is peak dry season for the **south & west coast and hill country**; the **east coast (Arugam Bay, Trincomalee) is in monsoon season in December** — leave it out or flag it. Whale watching in Mirissa is in season (Nov–Apr). Verify any specific venue (clubs, bars, beach parties) is still open; prefer well-known, durable options over obscure ones.

Target pool size: ~10 day pairs, ~8 night pairs, 1 NYE pair. Spread across regions (Colombo, Negombo, Galle/Unawatuna/Hikkaduwa, Mirissa/Weligama, Ella, Kandy, Sigiriya/Dambulla, Nuwara Eliya, Yala/Udawalawe).

Each option:
```ts
{
  id: string;
  slot: 'day' | 'night';
  title: string;            // "Sunrise at Pidurangala Rock"
  region: RegionId;
  tagline: string;          // one punchy line
  description: string;      // 2–3 sentences, vivid but honest
  highlights: string[];     // 2–4 bullets
  duration: string;         // "~4 hrs"
  estCostUsd?: [number, number]; // per person range
  vibe: -2 | -1 | 0 | 1 | 2;
  intensity?: 'easy' | 'moderate' | 'tough';
  tags: string[];           // 'hike', 'beach', 'wildlife', 'club', 'culture', ...
  images: { src: string; credit: string; source: string; license: string }[]; // see "Photos" below; first = cover
}
```
Pairs: `{ id, slot, a: OptionId, b: OptionId, theme?: string }`. Keep options and pairs separate so Abdul can re-pair easily.

### Photos (required)
- **Every option (day, night, NYE, and "Chill night in") and every region must have at least one real photo** of that actual place or activity, not a generic stock image. Prefer 2–3 photos per option (`images: Image[]`, first = cover) so the detail view can show a small swipeable gallery.
- Source from Wikimedia Commons (preferred, check the license allows reuse) or Unsplash; store `url`, `credit` (author), `source` (page link) and `license`. Show credits subtly in the detail view.
- Download, resize and optimize the chosen photos into `public/images/<region>/<option-id>-<n>.webp` (≈1600px wide, good compression) so the site doesn't depend on hot-linking. Serve them with `next/image` and blur placeholders.
- Where photos appear: the cover photo leads each A-vs-B matchup card; a full-bleed gallery in the option detail sheet; thumbnails on day cards and in the review timeline; region photos on road-trip segments; a hero image on the welcome screen.
- If a good photo can't be found for an option, flag it in the content summary so Abdul can supply one; never leave a blank or broken image (use a styled, on-brand illustrated fallback).

## Preferences step (all optional)
- Per-person budget excluding flights (tiers in USD)
- Accommodation style (hostel / boutique hotel / villa with pool / mix) + comfort with shared rooms
- Interests (multi-select chips: surfing, wildlife safari, hiking, beaches, tea country, food, temples & culture, photography, nightlife, wellness/spa…)
- Energy level / early mornings (e.g., "up for 4am sunrise hikes?")
- Getting around preference (private van / scenic train / tuk-tuks / don't mind)
- Dietary needs
- Flying in from (city) — helps flight coordination
- Must-do and hard-no free text
- Suggestions for places or activities not listed
- Anything else for the organizer
Design this step as quick taps first, text fields last.

## Group features (logged-in participants only)
- **Group overview:** responses count (joined vs submitted), **date availability heatmap** (how many people want each date — very important), most-picked options, group nature ↔ nightlife balance, popular regions.
- **Browse itineraries:** only after you've submitted your own (keeps opinions independent). Read-only timeline view of each submitted itinerary.

## Admin (`/admin`, protected by `ADMIN_PASSWORD` env var)
- Lock / unlock edits (when locked, everyone sees a read-only banner: "Edits are closed — the final plan is coming!")
- Participants table: name, status, last updated, number of picks; reset PIN; delete
- Export all data as **JSON** and **CSV** (one row per person; plus a long-format CSV with one row per slot pick) for AI analysis

## Data model (Supabase)
- `participants` (id uuid, display_name text unique (case-insensitive), pin_hash text, failed_attempts int, locked_until timestamptz, created_at)
- `itineraries` (participant_id uuid PK/FK, data jsonb, status text, submitted_at, updated_at)
- `settings` (single row: edits_locked boolean, updated_at)
SQL lives in `supabase/migrations/*.sql` so it can be pasted into the Supabase SQL editor.

Itinerary `data` (versioned):
```ts
{
  version: 1,
  startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD',
  flexibility: 'exact' | 'few_days' | 'very',
  days: Array<{
    id: string;                                   // stable id for drag/reorder
    day: { pairId: string; optionId: string } | null;
    night: { pairId: string; optionId: string } | { type: 'chill' } | null;
    note?: string;
  }>,                                             // dates derive from index + startDate
  preferences: { ... },
}
```

## Design direction
Tropical travel-poster: warm, bold, confident. Teal Indian Ocean, jungle green, sunset orange/saffron, sand; characterful display type paired with a clean body font; big photography; subtle textures and illustrated touches (palms, waves, tuk-tuks, train, elephant) — tasteful, not kitschy. Delightful micro-interactions (choosing between A vs B should feel like a satisfying matchup), smooth page transitions, satisfying drag. Mobile-first (WhatsApp in-app browser on iPhone and Android is the main target), excellent on desktop too. Accessible contrast, respects reduced-motion. A custom **Open Graph image** and title/description so the link preview in the group chat looks great. Custom favicon.

## Branding
- The friend group is **10hyaya** — always lowercase, exactly `10hyaya`, everywhere (copy, titles, exports, images). Never uppercase it, even inside an uppercase label: wrap it in `normal-case` (CSS `text-transform: none`).
- The brand is a **lockup**: the `☀ Lanks` wordmark (Fraunces 900 italic + saffron sun) with a smaller `by [10hyaya]` line right-aligned underneath like a signature. "by" is Fraunces italic; `10hyaya` is a rubber stamp — Rubik Dirt, double-ruled border, rotated −5°, sunset ink (`sunset-600`) on light backgrounds, saffron (`saffron-400`) on dark.
- Use the `<Lockup size tone>` component (`src/components/brand/wordmark.tsx`); don't rebuild it by hand. The stamp alone is `<TenHyaya>` / the `.stamp-10h` class in `globals.css`. Sizes: `sm` headers, `md` footer/login/hero, `lg` desktop poster panel, `xl` big moments.
- Where it appears: app headers (trip, group, person, join, admin), welcome hero, desktop poster panel, celebration card, `SiteFooter`, and the Open Graph image (`scripts/make-brand-assets.mjs` → `src/app/opengraph-image.jpg`; rerun after brand changes).
- Name in metadata: tab title "Lanks by 10hyaya" (pages: "Page · Lanks by 10hyaya"); descriptions mention "the 10hyaya group trip".
- The favicon / app icon stays a simple Lanks sun mark (no "10hyaya") so it reads at 16px.

## Engineering rules
- Never commit secrets. `.env.local` is gitignored; keep `.env.example` up to date.
- All Supabase access server-side; validate inputs (zod).
- Keep content in `src/content/`, separate from UI.
- Before saying a feature is done: `npm run build` passes, and check key screens at a mobile viewport (Playwright screenshots) and fix visual issues.
- Commit in logical chunks with clear messages and push to `main`.
- `SETUP.md` must always explain, step by step for a first-time Supabase user, how to run locally and deploy.

## Out of scope (for now)
Final itinerary generation/analysis, payments, bookings, notifications.
