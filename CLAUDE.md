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

## Two bases: Colombo, then Galle (HARD RULE)
- Every trip has **two bases: Colombo first, then Galle.** Days split automatically at a 3:7 ratio:
  `colomboDays = max(1, round(0.3 × tripLength))` (round half up, integer maths: `floor((3n + 5) / 10)`), the rest are Galle days. A 1-day trip is Colombo only. Examples: 4 days → 1 + 3, 5 → 2 + 3, 8 → 2 + 6, 14 → 4 + 10.
- The day builder shows the split at the top ("Colombo · 2 days → Galle · 3 days") and a section header per base with its region photo.
- **Fixed travel legs** (road-trip segments in the timeline, with durations):
  - Day 1: "Land at Colombo airport (CMB) → Colombo · ~1 hr".
  - First Galle day: "Road trip · Colombo → Galle · ~2 hrs" (Southern Expressway), with optional coast-road stops (Kosgoda turtle hatchery, Madu River at Balapitiya, Bentota beach — adds ~1.5–2 hrs).
  - Last day: "Road trip · Galle → Colombo airport (CMB) · ~2.5 hrs" (Colombo → CMB ~1 hr if the trip never reaches Galle). The departure day says to leave ~4 hrs before the flight.
- **Options belong to a base.** Colombo days only offer Colombo-base options (Colombo, Mount Lavinia, Negombo, plus the Kandy day trip). Galle days only offer Galle-base options (Galle Fort, Unawatuna, Hikkaduwa, Koggala/Ahangama, Weligama, Mirissa, Madiha, Hiriketiya, Bentota). Never mix. Far-away regions (Ella, Sigiriya/Dambulla, Nuwara Eliya/Horton Plains, Yala) are out.
- Each option shows its travel time from the base ("~1 hr from Galle"); options ≥ ~45 min away show a there-and-back road-trip line.
- Reordering days and moving single picks only works **within the same base**.
- **Migration:** itineraries saved before the bases rule (data `version: 1`) are normalised: picks not valid for their day's base are cleared, and the user sees a friendly one-time note ("We've locked in Colombo + Galle as bases, so a few picks need redoing").

## Building days — the rules
- Each calendar day in their range is a **day card** labeled with its real date (e.g., "Sat 26 Dec"). First day tagged "Arrival", last day tagged "Departure". All slots are optional.
- Each day card has two slots: **Daytime** and **Evening**.
- Options come from a **pool of pairs**, filtered to the day's base:
  - **Day pairs:** two daytime options, typically nature/adventure vs. a more social/city/beach option.
  - **Night pairs:** two evening options, typically a big night out vs. a mellower social night.
  - For any slot the user opens a sheet showing that base's pairs as side-by-side "A vs B" matchups.
  - **Full freedom:** no once-per-itinerary limit. The same option can be picked on as many days as people like, and both options of a pair can be used. Repeats only show a soft, non-blocking hint ("Also on Day 3"). Quick fill may prefer variety; manual picks are never restricted.
  - **Every Daytime and Evening slot also offers "Stay in"** — a first-class choice available any number of times. Daytime: "Slow morning, pool, nap, no plans." Evening: "Dinner and hangs at the villa." Custom villa `StayInIcon`; stored as `{ type: 'stay' }` (legacy `{ type: 'chill' }` is upgraded by `normalize()`). Vibe 0, no travel, costs nothing.
- **Add-ons:** any Daytime or Evening pick (including Stay in) can carry optional add-ons — smaller extras like bowling, karaoke, arcade, spa/massage, snorkelling, sunset catamaran, cooking class. Picked as multi-select chips in the option sheet, filtered to the same base and time of day. Shown as small chips under the pick on day cards and in the timeline; they count toward the budget and export one row each in the long CSV.
- **Kandy day trip (Colombo base):** when picked, the user chooses **Scenic train 🚂** (Colombo Fort ↔ Kandy, ~2.5 hrs each way) or **Road trip 🚐** (~3–3.5 hrs each way). Both outbound and return legs show in the timeline with custom train/van icons. Flag rail disruptions honestly.
- **Day-of-week availability:** options can set `availableDays` (0 = Sun … 6 = Sat). Show a badge (e.g. "Fridays only") and a gentle non-blocking warning when placed on another day.
- **New Year's Eve:** if their range includes Dec 31, that day's Evening slot shows the **NYE pair for that day's base** (Colombo or Galle), plus Stay in. The NYE pick is pinned to Dec 31.
- **Fluid editing (critical):** users can at any time change any pick, **drag to reorder whole days within a base** (contents move; dates stay attached to positions), move/swap a single pick to another day's same slot in the same base, clear a slot, add a short note. The Dec 31 Evening NYE pick stays pinned to Dec 31.
- **Balance meter:** every option has a `vibe` score from -2 (pure nature/adventure) to +2 (pure nightlife); live meter of the trip's nature ↔ nightlife balance. Stay in = 0. Add-ons don't affect the vibe.

### Travel times
Regions and approximate private-van times live in `src/content/regions.ts` (symmetric matrix; verify and refine):
| From → To | ~Hours |
|---|---|
| Airport (CMB) → Colombo | 1 |
| Colombo → Galle | 2 |
| Galle → Airport (CMB) | 2.5 |
| Colombo → Negombo | 1 |
| Colombo → Kandy | 3–3.5 by road · ~2.5 by Intercity train |
| Galle → Hikkaduwa | 0.5 |
| Galle → Mirissa / Weligama | 1 |
| Galle → Bentota | 1–1.25 |
| Galle → Hiriketiya / Dikwella | 1.5–2 |
If a day's travel gets heavy (e.g. Kandy by road plus a far evening, or a far daytime on the transfer/departure day), show a gentle warning — never block.

## Content (researched by Claude Code, edited by Abdul)
All activity content lives in **typed data files** in `src/content/` (no admin UI for content). Abdul will review and edit these.

Research real, currently operating places/activities with the web search tool. December is peak dry season for the **south & west coast and hill country**; the **east coast (Arugam Bay, Trincomalee) is in monsoon season in December** — leave it out or flag it. Whale watching in Mirissa is in season (Nov–Apr). Verify any specific venue (clubs, bars, beach parties) is still open; prefer well-known, durable options over obscure ones.

Target pool: per base, ~3 Colombo day pairs + ~3 Colombo night pairs, ~5 Galle day pairs + ~4 Galle night pairs, one NYE pair per base, plus add-ons per base. Main options include casino night (Colombo), scuba diving (Unawatuna/Hikkaduwa), **Pub Golf** (Colombo and Galle Fort/Unawatuna versions, each with a fun rules card), Bentota water sports, and the **Secret Jungle Party** (Hiriketiya, Fridays only).

Each option:
```ts
{
  id: string;
  slot: 'day' | 'night';
  title: string;            // "Sunrise at Pidurangala Rock"
  region: RegionId;
  base: 'colombo' | 'galle';
  tagline: string;          // one punchy line
  description: string;      // 2–3 sentences, vivid but honest
  highlights: string[];     // 2–4 bullets
  duration: string;         // "~4 hrs"
  estCostUsd?: [number, number]; // per person range
  vibe: -2 | -1 | 0 | 1 | 2;
  intensity?: 'easy' | 'moderate' | 'tough';
  tags: string[];           // 'hike', 'beach', 'wildlife', 'club', 'culture', ...
  images: { src: string; credit: string; source: string; license: string }[]; // see "Photos" below; first = cover
  availableDays?: number[]; // e.g. [5] = Fridays only
  transport?: { train: Leg; road: Leg };  // Kandy-style day trips with a train/road choice
  rules?: { title: string; items: string[] }; // e.g. the Pub Golf rules card
}
```
Pairs: `{ id, slot: 'day' | 'night' | 'nye', base, a: OptionId, b: OptionId, theme?: string }`. Keep options and pairs separate so Abdul can re-pair easily.
Add-ons: `{ id, base, slots: ('day' | 'night')[], title, venue, region, tagline, description, duration, estCostUsd, tags, images }` in `src/content/addons.ts`.
All prices are stored in **USD** (`estCostUsd`, per person) — the single base currency.

### Photos (required)
- **Every option (day, night, NYE, and "Stay in") and every region must have at least one real photo** of that actual place or activity, not a generic stock image. Prefer 2–3 photos per option (`images: Image[]`, first = cover) so the detail view can show a small swipeable gallery.
- Source from Wikimedia Commons (preferred, check the license allows reuse) or Unsplash; store `url`, `credit` (author), `source` (page link) and `license`. Show credits subtly in the detail view.
- Download, resize and optimize the chosen photos into `public/images/<region>/<option-id>-<n>.webp` (≈1600px wide, good compression) so the site doesn't depend on hot-linking. Serve them with `next/image` and blur placeholders.
- Where photos appear: the cover photo leads each A-vs-B matchup card; a full-bleed gallery in the option detail sheet; thumbnails on day cards and in the review timeline; region photos on road-trip segments; a hero image on the welcome screen.
- If a good photo can't be found for an option, flag it in the content summary so Abdul can supply one; never leave a blank or broken image (use a styled, on-brand illustrated fallback).

## Preferences step (all optional)
- Per-person budget excluding flights (tiers stored in USD, displayed in the selected currency)
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

## Currency
- All money in the app (option and add-on costs, budget tiers, the budget tracker) can be shown in **LKR, USD, GBP, EUR, AED, INR, SAR, QAR, CAD, AUD**.
- Content prices are stored in USD. Live rates come from a free no-key API (open.er-api.com), fetched server-side and cached ~24 h, with a hard-coded fallback table if the API fails. Amounts show with "≈" and the rate date; numbers are formatted per currency and rounded to sensible steps.
- A compact currency picker sits in the header. The choice is remembered per user: saved in the itinerary's `preferences.currency`, plus localStorage and a cookie for instant, flash-free rendering.

## Budget tracker
- A checklist-style **"Trip budget"** panel: a sticky summary pill on mobile that expands into a sheet; a side panel on desktop.
- Line items grouped by day: each picked activity and add-on with its per-person cost range; there-and-back van costs for far options; fixed transfer legs (arrival, Colombo → Galle, departure) and Kandy transport split per person assuming **2 shared vans for a group of 12**; an optional accommodation estimate from their accommodation-style preference × nights per base (toggle on/off).
- Every line can be checked/unchecked; exclusions are saved in the itinerary (`budget.excluded`, `budget.accommodation`).
- Shows the estimated total as a low–high range in the selected currency, compares it with their budget tier ("Within your budget" / "≈ 20% over"), and notes "Excludes flights · estimates only". Updates live.
- Computed totals are included in the admin export.

## Group features (logged-in participants only)
- **Group overview:** responses count (joined vs submitted), **date availability heatmap** (how many people want each date — very important), most-picked options, group nature ↔ nightlife balance, popular regions.
- **Browse itineraries:** only after you've submitted your own (keeps opinions independent). Read-only timeline view of each submitted itinerary.

## Admin (`/admin`, protected by `ADMIN_PASSWORD` env var)
- Lock / unlock edits (when locked, everyone sees a read-only banner: "Edits are closed — the final plan is coming!")
- Participants table: name, status, last updated, number of picks; reset PIN; delete
- Export all data as **JSON** and **CSV** (one row per person, including budget totals; plus a long-format CSV with one row per slot pick and one per add-on) for AI analysis

## Data model (Supabase)
- `participants` (id uuid, display_name text unique (case-insensitive), pin_hash text, failed_attempts int, locked_until timestamptz, created_at)
- `itineraries` (participant_id uuid PK/FK, data jsonb, status text, submitted_at, updated_at)
- `settings` (single row: edits_locked boolean, updated_at)
SQL lives in `supabase/migrations/*.sql` so it can be pasted into the Supabase SQL editor.

Itinerary `data` (versioned; current `version: 2`, which introduced the two bases):
```ts
{
  version: 2,
  startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD',
  flexibility: 'exact' | 'few_days' | 'very',
  days: Array<{
    id: string;                                   // stable id for drag/reorder
    day: SlotPick | null;
    night: SlotPick | null;
    note?: string;
  }>,                                             // dates and base derive from index + startDate + length
  preferences: { ..., currency?: CurrencyCode },
  budget?: { excluded?: string[]; accommodation?: boolean },
}
type SlotPick =
  | { pairId: string; optionId: string; addOns?: string[]; transport?: 'train' | 'road' }
  | { type: 'stay'; addOns?: string[] };
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
