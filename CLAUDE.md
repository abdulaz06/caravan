# Lanks — Sri Lanka Group Trip Planner

## What this is
A mobile-first web app for a friend group of ~12–13 people planning a December 2026 / January 2027 trip to Sri Lanka (last year's trip: Georgia, Dec 26 – Jan 2, over New Year's Eve). The organizer (Abdul) drops one link in the group chat. Each friend opens it, spends anywhere from 3 to 20+ minutes, and **crafts their own ideal itinerary** from curated options. Abdul later analyzes everyone's data (with AI) to build the final group itinerary. The analysis/"findings" part is **out of scope** — this app collects rich, structured preferences and makes the experience feel great.

**Aesthetics are the #1 priority.** It must look beautiful and impressive on a phone opened from a WhatsApp/iMessage link. Treat visual design, motion and polish as core requirements, not extras.

**The site is LIVE with real users.** Every change must be backward compatible: never lose or corrupt existing itineraries, and any data migration must be safe and idempotent (new fields are optional; a field an older app version doesn't send means "unchanged"). Run Playwright tests against the local stand-in database (`LANKS_LOCAL_STORE=1`), not production. If production must be checked, only create users named with the **`zz-test-`** prefix and delete only those afterwards; they're excluded from every count (welcome page, group screen, popular picks, roommate lists, exports — `src/lib/test-users.ts`). Never touch real users' data.

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
3. **Dates** — the trip is **6 days · 5 nights** (group vote). A "Trip length" preset sits above the calendar: **6 days · 5 nights** (default) and a secondary **Preview 5 days · 4 nights**. The calendar (Dec 1, 2026 – Jan 31, 2027) shows a fixed-width window (6 days, or 5 in preview) that the user drags or taps to place; it can't run past Jan 31. Night markers sit between days, Dec 31 is highlighted when inside, and the window shows "6 days · 5 nights" plus the dates. Also ask date flexibility (exact / ± a couple of days / very flexible). Moving the window keeps every pick on the same trip day (Day 1…6).
4. **Build your days** (the heart of the app) — see below.
5. **Your preferences** — every field optional, skippable in one tap (see list below).
6. **Review & submit** — beautiful timeline of their trip, balance meter, then Submit (celebratory moment, e.g., confetti).
7. **After submitting** — they can view their itinerary, edit anything at any time until the organizer locks edits, see the group overview, and browse others' submitted itineraries.

Progress autosaves continuously as a draft (debounced). Status: `draft` → `submitted`; editing after submit keeps it submitted but updates `updated_at`.

### Two speeds
- **Quick path (~5 min):** place the 6-day window → "Quick fill" (one balanced item per slot they can tweak) → submit.
- **Deep path:** hand-pick every slot, reorder, add notes, fill all preferences.
Both must feel natural; never force the long path.

## Trip length & day structure (HARD RULE)
The group voted: **6 days · 5 nights — 1 night in Colombo, then 4 in Galle.** Show nights next to days everywhere trip length appears (calendar, day builder header, review, exports).

These are the **defaults of the live Trip rules** (see Organizers): organizers can change the Colombo / Galle nights split, whether only full-length plans can be submitted, whether the 5-day preview exists and the date window — without a redeploy. Code reads the structure from the rules (`src/lib/rules.ts`, applied per request on the server and from page props on the client), never from hard-coded constants, and all copy ("6 days · 5 nights", "Galle · 4 nights") is generated from it. With more than one Colombo night, Days 1…n are Colombo days, the next day is the road trip, then the Galle days.

| Day | Name | Travel leg | Daytime | Evening | Night in |
|---|---|---|---|---|---|
| 1 | Land in Colombo | "CMB → Colombo · ~1 hr" | Colombo options | Colombo options | Colombo |
| 2 | Road trip to Galle | "Road trip · Colombo → Galle" (coast road via any en-route stops, else ~2 hrs on the expressway) | **En-route stops only** (Bentota, Kosgoda, Madu River, Ambalangoda, Hikkaduwa…) shown on a little route strip | Galle-area options | Galle |
| 3–5 | Galle base | — | Galle-area options | Galle-area options | Galle |
| 6 | Check out & fly home | "Road trip · Galle → CMB airport · ~2.5 hrs" | — | — | — |

- Day 1 makes it obvious it's the **only Colombo day**. Day 6 has no slots and isn't editable: just the drive, "leave ~4 hrs before your flight" and a send-off.
- Header: "Colombo · 1 night → Galle · 4 nights" (Galle · 3 in preview).
- Options declare where they're valid (`where: ('colombo' | 'enroute' | 'galle')[]`); an option can be valid in more than one context (e.g. Hikkaduwa turtles: en-route and Galle). Far-away regions (Sigiriya, Nuwara Eliya, Yala, Kandy) are out; Ella appears only as the one Ella day trip (below). The Kandy day trip and its train/road choice are gone.
- **Moving things:** Galle days 3–5 reorder freely (whole days or single items). Day 2 Evening items can move to/from Galle evenings. Day 1 items and Day 2 Daytime (en-route) items stay where they are. Day 6 is fixed.
- **New Year's Eve:** the NYE pair follows whichever day Dec 31 lands on — Colombo NYE pair on Day 1, Galle NYE pair on Day 2 evening or Days 3–5. If Dec 31 is Day 6, say so gently ("you'd fly home on New Year's Eve"). The whole Dec 31 evening stays pinned to Dec 31 when days are reordered.

### 5-day preview (sandbox)
- "Preview 5 days · 4 nights" starts as a copy of the 6-day plan with Day 5 (the last full Galle day) removed: Day 1 Colombo, Day 2 road trip, Days 3–4 Galle, Day 5 fly home.
- Preview edits never touch the real 6-day plan and are **never autosaved**; switching back restores the 6-day plan exactly.
- Submit is disabled in preview with a friendly note: "The group voted 6 days. Switch back to submit." The **server rejects any submission that isn't 6 days.**

### Migration
Itineraries saved before this structure (`version` 1 or 2) keep their start date, become 6 days, keep every pick that's still valid for the new day/slot it maps to (by index), turn saved add-ons into Quick extras on the same slot where valid, and clear the rest. The user sees a friendly one-time note explaining the group decision ("The group voted for 6 days · 5 nights — 1 night in Colombo, then 4 in Galle…").

## Building days — the rules
- Each calendar day in their window is a **day card** labeled with its real date (e.g., "Sat 26 Dec") and its trip-day name (Day 1 · Land in Colombo, …).
- Days 1–5 have two slots: **Daytime** and **Evening**. All slots are optional.
- **Each slot is an ordered list of activities.**
  - The first item is picked from the **A-vs-B matchup sheet**: that slot's curated pairs (filtered to Colombo / en-route / Galle), plus **Stay in**.
  - Then a clearly visible **"+ Add another"** opens a browsable **catalog** of everything valid for that day and slot — every option, every Quick extra and Stay in — with category filters (**Adventure, Beach & Water, Nature, Culture, Food, Party, Chill/Stay in**) and search.
  - **Quick extras** (bowling, karaoke, arcade, spa/massage, snorkelling, sunset catamaran, turtle hatchery, …) are small catalog items in the same list (they replaced "add-ons").
  - Items can be reordered within a slot and removed. Each slot shows a soft time total ("~6 hrs planned") and a gentle, non-blocking warning when it's clearly overpacked (daytime ≳ 10 hrs, evening ≳ 7 hrs including hops).
  - **Travel hops** appear between items in different towns within a slot ("Unawatuna → Mirissa · ~45 min").
  - **Full freedom:** the same option can be picked on as many days as people like. Repeats only show a soft hint ("Also on Day 3").
  - **Stay in** ("Slow morning, pool, nap, no plans." / "Dinner and hangs at the villa.") is a first-class item, any number of times. Vibe 0, no travel, costs nothing.
- **Day-of-week availability:** options can set `availableDays` (0 = Sun … 6 = Sat) — many south-coast parties run on specific nights. Show a badge ("Fridays only", "Wed & Sat") and a gentle non-blocking warning when placed on another day.
- **Big day trips:** a few standout options up to ~2.5 hrs from Galle are allowed; they're tagged "Big day trip · ~2.5 hrs each way". **The only exception to the ~2.5 hr rule is the Ella day trip** (Little Adam's Peak, ~3.5–4 hrs each way, below).
- **Fluid editing:** change, add, reorder or remove items; drag Galle days to reorder; move single items between compatible slots (see the structure rules); add a short note to any day.
- **Balance meter:** every option has a `vibe` from -2 (pure nature/adventure) to +2 (pure nightlife); the meter averages all items. Stay in = 0; Quick extras count with their own vibe.

### Ella day trip · Little Adam's Peak — the one long exception
One "Big day trip" option (`ella-little-adams-peak`, region `ella`) with **two variants** the user picks between when they select it (stored as `variant` on the slot item). Galle **Days 3–5 only** (never Day 2's en-route daytime, never a Colombo day). Difficulty **easy**. Facts (verified Oct 2026, keep the sources on the option): Galle → Ella ~200 km, **~3.5–4 hrs each way** by van; Little Adam's Peak **1,141 m**, ~2 km from Ella town, the last **~30–45 min** on a path and steps through a tea estate; free; December sunrise **~6:10–6:15am** over Ella Gap; cool before dawn. (This replaced Adam's Peak / Sri Pada, which was the wrong mountain — see Migration.)
- **A · "Sunrise at Little Adam's Peak":** leave Galle ~12:30am, arrive ~4:30am, walk up by torchlight, sunrise at the top, breakfast in Ella, back in Galle ~2:30pm. The previous evening is **not locked**: it gets a soft note "Early night: leaving ~12:30am for Ella" and a gentle warning if it has late-night party items (never blocks). That day's evening suggests **Stay in** or something light.
- **B · "Easy morning in Ella":** leave Galle ~5am, hike mid-morning, explore, back in Galle ~8pm. That day's evening: "Back ~8pm — Stay in or a chill dinner suggested". Honest copy: midday is hotter on the open summit and busier.
- **Ella extras** (Quick extras with `onlyWith: 'ella-little-adams-peak'`): Nine Arches Bridge (with typical train times), 98 Acres viewpoint & café, Flying Ravana zipline, Ravana Falls. They show in the "+ Add another" catalog **only when the Ella trip is in that same Daytime slot**, are dropped if the trip leaves the slot, and travel with it when it moves to another Galle day.
- Timeline, budget and map show the road-trip legs both ways with durations; full-day time total; custom hill/sunrise icon (`HillSunIcon`); what to bring (light jacket, torch for sunrise, cash); credited photos. Cost per person = shared full-day van split (2 vans for 12, `vanRoundTripUsd`) + extras. Map bounds and the Story/Square export maps fit Galle → Ella.
- Halal mode leaves it as it is (nature). Budget, exports, peek and the group overview all include it.
- **Migration:** saved `adams-peak` picks become the Ella trip on the same day (sunrise → sunrise, morning → calm). There was never a stored overnight-drive item. The user sees a one-time note: "We swapped Adam's Peak for Little Adam's Peak in Ella. Easier hike, same sunrise."

### Travel times
Regions (towns) live in `src/content/regions.ts` with coordinates. Drive times between towns come from a small table of known pairs, falling back to an estimate from distance (south-coast road speeds). Verify and refine:
| From → To | ~Hours |
|---|---|
| Airport (CMB) → Colombo | 1 |
| Colombo → Galle | 2 by expressway · 3.5–4 along the coast road |
| Galle → Airport (CMB) | 2.5 |
| Colombo → Bentota / Kosgoda / Balapitiya / Ambalangoda / Hikkaduwa (coast road) | 1.5 / 2 / 2.25 / 2.5 / 3 |
| Galle → Unawatuna / Hikkaduwa / Koggala | 0.25 / 0.5 / 0.5 |
| Galle → Ahangama / Weligama / Mirissa | 0.6 / 0.75 / 1 |
| Galle → Hiriketiya / Dikwella | 1.5–2 |
| Galle → inland rainforests (Kottawa / Hiyare / Kanneliya) | 0.5 / 0.5 / 1.25–1.5 |
| Galle → Ella (the one exception) | 3.5–4 |
If a day's travel gets heavy (a big day trip plus a far evening), show a gentle warning — never block.

## Content (researched by Claude Code, edited by Abdul)
All activity content lives in **typed data files** in `src/content/` (no admin UI for content). Abdul will review and edit these.

Research real, currently operating places/activities with the web search tool. December is peak dry season for the **south & west coast and hill country**; the **east coast (Arugam Bay, Trincomalee) is in monsoon season in December** — leave it out or flag it. Whale watching in Mirissa is in season (Nov–Apr). Verify any specific venue (clubs, bars, beach parties) is still open; prefer well-known, durable options over obscure ones.

Target pool: Colombo (Day 1) ~3 day pairs + ~3 night pairs; en-route (Day 2 daytime) ~4 pairs; **Galle side expanded massively** — ~12 day pairs (priority: treks/hikes/nature close to Galle, then water — snorkel, scuba, surf, kayak, boats, whales — then food, culture, chill) and ~8 night pairs covering distinct scenes (beach parties, surf-town bar nights, rooftop/sunset bars, live music, the Ahangama/Weligama scene, Hikkaduwa party nights, Secret Jungle Party on Fridays, Galle Fort evenings) with the nights of the week they run; one NYE pair each for Colombo and Galle; Quick extras per context. Most Galle options within ~1.5 hrs; a few "Big day trip" options up to ~2.5 hrs.
Colombo nights include a standalone **High-roller night** (casino) and **Pub Golf** that tees off at **Bellagio Colombo** ("Hole 0 · Tee-off": a casino visit and a small flutter) before the bar route, with a fun rules card.

**Research quality:** cross-check every option with at least two recent (2025–26) sources, prioritising real traveller reviews (Reddit r/srilanka and r/travel, TripAdvisor, Google reviews, recent travel blogs) over SEO listicles. Skip anything closed, off-season in December or badly reviewed. Each option carries a short **"why people love it"** line drawn from reviews and its `sources`.

Each option:
```ts
{
  id: string;
  slot: 'day' | 'night';
  title: string;
  region: RegionId;                 // the town it happens in
  where: ('colombo' | 'enroute' | 'galle')[];
  categories: Category[];           // 'adventure' | 'water' | 'nature' | 'culture' | 'food' | 'party' | 'chill'
  tagline: string;                  // one punchy line
  loved: string;                    // "why people love it", from reviews
  description: string;              // 2–3 sentences, vivid but honest
  highlights: string[];             // 2–4 bullets
  duration: string;                 // "~4 hrs"
  hours: number;                    // for slot time totals
  estCostUsd?: [number, number];    // per person
  vibe: -2 | -1 | 0 | 1 | 2;
  intensity?: 'easy' | 'moderate' | 'tough';
  tags: string[];
  images: { src: string; credit: string; source: string; license: string }[]; // first = cover
  sources: { label: string; url: string }[];
  availableDays?: number[];         // e.g. [5] = Fridays only
  rules?: { title: string; items: string[] }; // e.g. the Pub Golf rules card
  routeKm?: number;                 // en-route stops: km from Colombo along the coast road
}
```
Pairs: `{ id, slot: 'day' | 'night' | 'nye', where: 'colombo' | 'enroute' | 'galle', a: OptionId, b: OptionId, theme?: string }`. Keep options and pairs separate so Abdul can re-pair easily.
Quick extras: `{ id, where, slots, title, venue, region, categories, tagline, description, duration, hours, estCostUsd, vibe, tags, images, sources }` in `src/content/extras.ts`.
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
- **"Top choices to share a room with 😄"** — clearly labelled "Just for fun · not binding". Pick and rank up to 3 people from the participants who have started an itinerary (never yourself or test users), with search, plus "Someone not on the list? Type their name" for people who haven't joined. Stored as `preferences.roommates: { id?, name }[]` (an empty list = cleared; a missing key on save = unchanged, so older app versions can't wipe it; the server keeps the first 3, drops yourself and stores participants' current names). A **private answer**: organizers only (console + exports) — never in browse, peek or the group screen.
Design this step as quick taps first, text fields last. The privacy line reads "Only the organizers (Abdul & Aadil) see these answers, roommate picks included".

## Currency
- All money in the app (option and Quick extra costs, budget tiers, the budget tracker) can be shown in **LKR, USD, GBP, EUR, AED, INR, SAR, QAR, CAD, AUD**.
- Content prices are stored in USD. Live rates come from a free no-key API (open.er-api.com), fetched server-side and cached ~24 h, with a hard-coded fallback table if the API fails. Amounts show with "≈" and the rate date; numbers are formatted per currency and rounded to sensible steps.
- A compact currency picker sits in the header. The choice is remembered per user: saved in the itinerary's `preferences.currency`, plus localStorage and a cookie for instant, flash-free rendering.

## Budget tracker
- A checklist-style **"Trip budget"** panel: a sticky summary pill on mobile that expands into a sheet; a side panel on desktop.
- Line items grouped by day: every item in every slot (options and Quick extras) with its per-person cost range; there-and-back van costs for far items; fixed transfer legs (arrival, Colombo → Galle, Galle → airport) split per person assuming **2 shared vans for a group of 12**; an optional accommodation estimate from their accommodation-style preference × nights (Colombo 1, Galle 4 — or 3 in preview) (toggle on/off).
- Every line can be checked/unchecked; exclusions are saved in the itinerary (`budget.excluded`, `budget.accommodation`).
- Shows the estimated total as a low–high range in the selected currency, compares it with their budget tier ("Within your budget" / "≈ 20% over"), and notes "Excludes flights · estimates only". Updates live.
- Computed totals are included in the admin export.

## Group features (logged-in participants only)
- **Group overview:** responses count (joined vs submitted), **date availability heatmap** (how many people want each date — very important), most-picked options (counted per person, with 🔥 badges on the popular ones), group nature ↔ nightlife balance, popular regions.
- **🔥 Popular picks:** pick counts per option/Quick extra across all real participants' itineraries (drafts + submitted, each person once; test users, hidden options and Halal stand-ins left out), from a cached server endpoint (`GET /api/popular`, ~3 min cache; the client refreshes every few minutes). Popular = the top 5 per slot type (daytime / evening; ties at the cut-off stay) with at least max(3, 20% of the people who've picked anything) — constants in `src/lib/popular.ts`. A custom flame badge "Popular · 7 picked" on the A-vs-B matchup cards, the "+ Add another" catalog (plus a "🔥 Popular" filter, most picked first), option detail sheets and the group overview. Counts only, never who picked what. A console toggle (Trip rules → 🔥 Popular badges) shows/hides them; never shown in Halal mode.
- **Browse itineraries:** by default only after you've submitted your own (keeps opinions independent); organizers can switch this to always or off. Read-only timeline view of each submitted itinerary.
- **Everyone's scale:** each card in the "Everyone's trips" list shows that person's Nature ↔ Nightlife meter.
- **Group spectrum:** a strip at the top of the group screen — one horizontal Nature ↔ Nightlife line with everyone's avatar/initials plotted where they land (overlaps stack neatly; tap an avatar to open their trip). Like browsing, it unlocks once you've submitted your own. Always labelled "Nature ↔ Nightlife" here (Halal mode never applies outside the review view).
- **Organizer badge:** a small "Organizer" badge next to admins' and the owner's names (group screen, browse, spectrum).
- **👀 Peek:** anyone logged in can peek at anyone else's plan — drafts too, even before submitting their own — from a "👀 Peek" button on each person's card. It shows their **full itinerary in the normal read-only view** (trip poster + route map, vibe meter, day by day), with an "In progress" badge on drafts and a playful quip. The data comes from its own endpoint (`/api/peek/[id]`, `privacy.peekPlan`) that returns only picks and dates — never private answers (budget, dietary, free text, roommate picks) or day notes. No copy/add actions (details open read-only). Each person sees an anonymous "👀 3 people peeked at your plan" on their own plan (unique peekers, never who); organizers see who peeked in the console activity log. Respects the "peek" rule; Halal mode doesn't apply. Browsing a submitted plan likewise only sends picks, dates, day notes and interests (`privacy.browsePlan`).

## Route map, share images & Halal mode
### Zoomed route map (review + person view)
- The trip poster's map is zoomed to the south-west coast (CMB airport → Colombo → down the coast to Hiriketiya; it grows to include inland day trips like Udawalawe, Sinharaja or Ella) using a full-resolution SVG coastline.
- Each day's route is drawn in its own colour along the coast road (parallel lines where days overlap), with numbered stops and travel legs. Tapping a day chip (or its route) highlights that day — its stops get numbered in visiting order and its legs show drive times.

### "Share my trip" images
- Two designed, poster-quality exports — **9:16 Story (1080×1920)** and **Square (1080×1080)** — drawn on a canvas (not a page screenshot): the "Lanks by 10hyaya" lockup, their name, dates + "6 days · 5 nights", the zoomed route map, a compact day-by-day list with icons, and their balance meter.
- Generated client-side with embedded fonts (fixed-weight copies of Fraunces and Instrument Sans in `public/fonts/share/`, made by `scripts/make-share-fonts.py` and loaded via the FontFace API before drawing — WebKit's canvas ignores a variable font's weight axis), same-origin images and an SVG/Path2D map, so it works on iPhone Safari and Android Chrome. Map labels and day badges never overlap (shared placement helpers in `src/lib/routes.ts`). Images are pre-generated when the share sheet opens; the Share button uses the Web Share API with the PNG file (save to Photos / share to Instagram) and falls back to a download. Personal day notes are never included.

### Halal mode (easter egg)
- A subtle crescent-moon "Halal" switch on the user's own review view (tucked into the vibe card).
- When ON it's a **view-only** transformation (`src/lib/halal.ts`): every nightlife item (party, club, bar, pub golf, casino, anything alcohol-centric) is swapped for its curated `halalSwap` — a wholesome alternative in the same slot and area with a similar duration. Every nightlife activity in `src/content` must define one (checked at startup); swap targets live in `src/content/activities/halal.ts` or are existing non-nightlife options. Stay in, nature and culture items stay as they are.
- **No Nature ↔ Nightlife scale at all.** Its place goes to a **"Trip highlights"** card: custom icons with counts ("10 feasts · 5 beaches · 5 sunsets · 2 hikes · 1 temple · 1 safari"), computed from the swapped itinerary (`src/lib/highlights.ts`, icons as path data shared with the canvas). The Halal switch stays in the card. A banner says "Halal mode: preview only, your real plan is untouched" with one-tap off.
- **Nothing about nightlife, partying, alcohol or gambling may appear anywhere while it's on** — titles, taglines, descriptions, highlights, tags and "why people love it" lines, category filters (Party hidden), day-of-week party badges, late-night notes, budget line items (the budget panel shows the swapped plan), 🔥 badges, map labels, the desktop poster copy and both exports. Non-nightlife options whose own words mention bars or drinks carry `halalText` (Halal-mode wording); Halal mode shows a `~halal` copy of them (tags and source labels naming nightlife left out), never saved or offered anywhere (`halalOf`). Day notes, free-text answers and the announcement banner are hidden while it's on.
- The banned-word list lives in one place, `src/content/halal-banned-words.json` (bar, pub, club, party, drinks, cocktail, beer, alcohol, sundowner, casino, gambling, rave, shots, nightlife, haram — whole words, case-insensitive, with plurals). The content check at startup fails the build if anything Halal mode can show contains one, and `scripts/round9.mjs` renders every itinerary screen, every detail sheet, the budget and both exports in Halal mode for a plan full of nightlife and fails on any banned word.
- It never changes saved data (byte-identical): no autosave, no DB writes, no effect on the group overview, browsing, admin export or budget exclusions. Editing and submitting are disabled while it's on, and it resets when they leave the page.
- Share images made in Halal mode use the swapped itinerary with the Trip highlights card in the meter's place and look completely normal: no banner, no "Halal" label, no Nature ↔ Nightlife wording, no personal notes.

## Organizers & the console (`/admin`)
### Roles
- `participants.role`: **owner**, **admin** or **member** (default). Abdul is the owner; Aadil was made admin by the roles migration because he had already joined (never auto-grant by name otherwise — anyone could register a name first; the owner promotes people from the console).
- **Owner-only:** make/remove admins, delete an admin, reset an admin's or the owner's PIN. Nobody can demote or delete the owner. Admins get every other control.
- Every `/api/admin/*` endpoint checks the role **server-side** (members get 403); hiding things in the UI is never the protection.

### Access
- Admins log in with their normal name + PIN and get an **Organizer** button in the header. Opening the console asks them to **re-confirm their PIN**; the console session (signed httpOnly cookie, tied to their participant id, role re-checked on every request) lasts ~12 hours.
- `ADMIN_PASSWORD` stays as an **owner-level break-glass** login on `/admin`.
- Admin names show an "Organizer" badge to everyone. The preferences step says "Only the organizers (Abdul & Aadil) see these answers", built from the real owner/admin list.

### Console (one page, sections: Overview · People · Roommates · Trip rules · Content · Announcement · Data · Activity)
- **Overview:** joined vs submitted, who hasn't started / hasn't submitted, last activity, quick links.
- **Roommates (just for fun):** mutual matches (A picked B and B picked A, with their ranks; "Both #1"), most wanted, and a who-picked-whom list (typed names marked "not joined"; a typed name that matches someone who has since joined counts as them).
- **People:** status, role + badge (test users listed with a "Test user · not counted" tag so they can be deleted, but left out of every count); view any itinerary **including private answers**; **edit any itinerary on their behalf in the normal day builder** (works even when edits are locked), stamped "Edited by <admin>" — the person sees a subtle, dismissible "Aadil updated your plan on 21 Oct"; reset PIN; delete; owner only: make/remove admin.
- **Trip rules** (stored in `settings.rules`, applied live, enforced server-side): edits lock on/off + a scheduled **auto-lock** date/time (countdown shown to everyone); require full length to submit / allow the 5-day length; 5-day preview on/off; date window (earliest start / latest end); base structure (Colombo nights / Galle nights, default 1 / 4) and base-area filtering on/off; browse others: after submitting / always / off; peek on/off; group spectrum on/off; 🔥 popular badges on/off; Halal button on/off; default currency. A change that would invalidate saved itineraries (nights split, date window) first shows an **impact preview** ("4 itineraries will need re-picks") and needs confirmation, then migrates them the way earlier migrations did (picks kept by day role and order, the rest cleared) and the people affected see a one-time note.
- **Content:** hide/disable any option or Quick extra (people who already picked it see "No longer available" on that item — never silently deleted; new picks of it are refused); flag "re-check closer to the date"; pin/feature an option (shown first in matchups and the catalog).
- **Announcement:** a banner message shown to everyone, with an on/off switch.
- **Data:** JSON and CSV exports (one row per person incl. days · nights, budget totals, role, edit stamp and roommate picks + mutual matches; plus a long-format CSV, one row per item in every slot) for AI analysis. Test users are never exported.
- **Activity log:** every admin action (who, what, when) and who peeked at whom.

## Data model (Supabase)
- `participants` (id uuid, display_name text unique (case-insensitive), pin_hash text, failed_attempts int, locked_until timestamptz, role text owner|admin|member (one owner max), created_at)
- `itineraries` (participant_id uuid PK/FK, data jsonb, status text, submitted_at, updated_at, stamp jsonb — the last organizer edit or rules migration: `{ kind, by, at, seen }`)
- `settings` (single row: edits_locked boolean, rules jsonb — the live Trip rules, content controls and announcement, updated_at)
- `activity_log` (id, at, actor_id, actor_name, action, target_id, target_name, details jsonb)
- `peeks` (peeker_id, target_id, first_at, last_at, count; PK peeker+target) — unique peekers per plan
SQL lives in `supabase/migrations/*.sql` so it can be pasted into the Supabase SQL editor.

Itinerary `data` (versioned; current `version: 3`, which introduced the fixed day structure and multi-item slots; the length follows the Trip rules):
```ts
{
  version: 3,
  startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD',   // always 6 days (endDate = startDate + 5)
  flexibility: 'exact' | 'few_days' | 'very',
  days: Array<{                                     // one per day (6 by default); the fly-home day's slots stay empty
    id: string;                                     // stable id for drag/reorder
    day: SlotItem[];
    night: SlotItem[];
    note?: string;
  }>,
  preferences: { ..., currency?: CurrencyCode, roommates?: { id?: string; name: string }[] },
  budget?: { excluded?: string[]; accommodation?: boolean },
}
type SlotItem = { key: string; id: string; pairId?: string; variant?: string };
// id = an option id, a Quick extra id, or 'stay'; pairId = the matchup it was picked from;
// variant = the chosen variant of an option that has them (the Ella day trip: 'sunrise' | 'calm')
```
The 5-day preview lives only in the browser and is never saved.

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
