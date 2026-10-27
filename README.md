# Caravan

**Plan the trip together.** A group-trip planner where everyone builds their own version of the trip from curated options — and the organizer sees exactly where the group overlaps.

Start a trip, drop one link in the group chat, and each friend:

1. drags a date window onto the calendar,
2. fills every day and evening with this-or-that matchups and a browsable catalog of real, photographed options,
3. answers a few optional questions (budget, stay style, dietary needs, roommate picks),
4. submits, then browses the group: a date heatmap, 🔥 popular picks, everyone on one nature ↔ nightlife line, and a peek at friends' drafts.

The organizer gets a console per trip: owner/admin roles, live trip rules, edit locks, announcements, and JSON/CSV exports for planning the final itinerary.

Destinations are **presets** — typed, validated JSON describing the options, day structure, drive times, map and theme ([`docs/PRESETS.md`](./docs/PRESETS.md)). Sri Lanka ships today.

```bash
npm install
npm run dev:local        # http://localhost:3100 on a local test database
npm run typecheck        # tsc
npm run lint             # eslint
npm test                 # unit tests (vitest)
npm run preset:validate  # check every preset
npm run build            # production build
```

- Setup and deployment (Supabase + Vercel): [`SETUP.md`](./SETUP.md)
- How presets work and how to add a destination: [`docs/PRESETS.md`](./docs/PRESETS.md)
- Engineering notes for contributors and Claude Code: [`CLAUDE.md`](./CLAUDE.md)

Stack: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Framer Motion · dnd-kit · zod · Supabase (server-only, RLS on) · Vercel.
