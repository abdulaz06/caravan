# Caravan — setup & deployment

Click-by-click, for someone who has set up Supabase and Vercel once before. About 20 minutes.

**What you'll end up with:** Caravan running on your computer, its own free Supabase database, and its own Vercel project with a live link.

---

## Rule zero: Caravan has its own everything

Caravan was forked from a private trip planner (Lanks) that real people still use. The two must never share infrastructure:

| | Caravan | Lanks (never touch) |
|---|---|---|
| GitHub repo | `abdulaz06/caravan` | `abdulaz06/lanks` |
| Supabase project | `caravan` | `lanks` |
| Vercel project | `caravan` | `lanks` |
| `SESSION_SECRET`, `ADMIN_PASSWORD` | freshly generated | — |

There is a guard for the most dangerous mistake: if `SUPABASE_URL` (or a legacy Supabase key) points at the Lanks project, `npm run dev`, `npm run build` and `npm start` refuse to run, and the server refuses to open a database connection ([`src/lib/infra-guard.ts`](src/lib/infra-guard.ts) — the protected project is stored as a hash, so this public repo never names it).

---

## 0. What you need

- **Node.js 20.9 or newer** — check with `node -v`.
- This repo on your computer, outside OneDrive (e.g. `C:\Users\abdul\Documents\caravan`).
- Your **GitHub**, **Vercel** and **Supabase** accounts.

---

## 1. Run it locally (no database needed)

```bash
npm install
npm run dev:local
```

Open http://localhost:3100 — Caravan's front page. **Start a trip** (`/new`): pick a destination, name the trip, and choose your name and a 4-digit PIN. You become the trip's **owner** and get its invite link, `http://localhost:3100/t/<slug>`. Open that link in a private window to join as a friend.

`npm run dev:local` always uses a **local test database**: a file at `.data/dev-db.json`, ignored by git (so does `npm run dev` without Supabase settings, or with `CARAVAN_LOCAL_STORE=1`). Tests always run this way. Each trip's organizer console is at `/t/<slug>/admin`; until you set `ADMIN_PASSWORD`, the local break-glass password is `admin`.

---

## 2. Create the Supabase project

1. Go to **https://supabase.com/dashboard** → **New project**. Use the same organization as before or a new one — either is fine.
2. Fill in:
   - **Name:** `caravan`
   - **Database password:** **Generate a password** and save it in your password manager (the app doesn't use it).
   - **Region:** the same one you'd pick for Vercel (e.g. *East US (North Virginia)* ↔ Vercel `iad1`, *West EU (London)* ↔ `lhr1`).
3. **Create new project** and wait a minute or two.

## 3. Create the tables

1. In the `caravan` project, open **SQL Editor** (the `>_` icon) → **New query**.
2. Paste **all** of each file in [`supabase/migrations/`](supabase/migrations/), **in date order**, and click **Run** after each one. Each file is safe to run more than once. (Today there is one: `20261027000000_caravan.sql`, which creates `trips`, `participants`, `itineraries`, `activity_log` and `peeks`.)
3. Check **Table Editor**: every table shows an **RLS enabled** badge. That's intended — nobody can read anything with the public key; only Caravan's server can.

> If Supabase warns that a query has *destructive operations*, that's the `revoke` lines. It's safe — click **Run** again.

## 4. Copy your two Supabase values

- **Project URL:** **Connect** (top bar) → **Project URL**, e.g. `https://abcdefghijklmnopqrst.supabase.co`.
- **Secret key:** **Project Settings** (gear) → **API Keys** → **Secret keys** → reveal and copy the `sb_secret_…` key. (Legacy `service_role` keys also work, but Supabase retires them at the end of 2026.)

> ⚠️ The secret key gives full access to the database. Only ever paste it into `.env.local` or Vercel's environment variables — never into code, a chat, or a variable starting with `NEXT_PUBLIC_`.

## 5. Fill in `.env.local`

Copy `.env.example` to `.env.local` and fill it in:

```bash
SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxxxxxxxxxxxxxxxxxxxxx
SESSION_SECRET=<a new long random string>
ADMIN_PASSWORD=<a new password for /admin>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Generate fresh secrets — never reuse the ones from Lanks:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Restart `npm run dev`; the app now uses the `caravan` database. `.env.local` is gitignored.

---

## 6. Deploy to Vercel (a new project)

1. Go to **https://vercel.com/new** → **Import Git Repository**.
2. Find **caravan** — not *lanks*. If it's missing, click **Adjust GitHub App Permissions**, give Vercel access to `abdulaz06/caravan`, and come back.
3. **Import**. Framework preset: **Next.js**. Project name: `caravan`. Leave the build settings alone.
4. **Environment Variables** — add the same values as your `.env.local`:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | the `caravan` Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | the `caravan` `sb_secret_…` key |
   | `SESSION_SECRET` | another **new** random string (not your local one) |
   | `ADMIN_PASSWORD` | your Caravan admin password |
   | `CRON_SECRET` | a **new** random string — lets Vercel Cron reset the demo trip nightly |

   `NEXT_PUBLIC_SITE_URL` is optional — Vercel's production domain is used automatically.
5. **Deploy**. You'll get a link like `https://caravan-xxxx.vercel.app`.
6. **Match the region:** project → **Settings → Functions → Function Region** → the one next to your Supabase region → **Save** → **Deployments → ⋯ → Redeploy**.

Every push to `main` redeploys. After changing an environment variable, redeploy for it to apply.

---

## The demo trip and past trips

- **`/demo`** lets visitors pick a demo: one trip per destination (`/t/demo-sri-lanka`, `/t/demo-georgia`), each with the same 12 fictional travellers (drafts, submitted plans, roommate picks, peeks). A demo is built the first time someone opens it (`/demo/<preset>`). Visitors **try it as a guest** (a throwaway traveller with no PIN) or **view as organizer (demo)** — the console, read-only (every write is refused server-side; exports work).
- **Nightly reset:** `vercel.json` schedules `GET /api/cron/reset-demo` at 03:00 UTC. Vercel sends `Authorization: Bearer <CRON_SECRET>`; set `CRON_SECRET` in the project's environment variables or the endpoint refuses. To reset by hand: project → **Settings → Cron Jobs → Run**, or `curl -H "Authorization: Bearer <CRON_SECRET>" https://<your-domain>/api/cron/reset-demo`.
- **Past trips** (`/past`) are JSON files in `content/past-trips/`: a preset id, real dates, the picks per day, and the story slides. They render with the same poster, route map and timeline as a live plan.

## Trips, invite links and organizers

- Anyone can start a trip at **`/new`**. Creation is rate limited per visitor (3 an hour, 10 a day, by a salted hash of their IP — the IP itself is never stored) and to 300 trips a day overall (`src/lib/server/new-trip.ts`). The limits are off on the local test database.
- Each trip lives at **`/t/<slug>`** — that's the invite link. The slug is the trip name plus a random tail, so links can't be guessed. People, plans, rules and the activity log all belong to one trip.
- One phone can be in several trips at once (the session cookie remembers up to 20). The front page lists them under "Pick up where you left off".

## Organizer cheat sheet (`/t/<slug>/admin`)

Organizers (the **owner** and any **admins**) sign in like everyone else, tap **Organizer** (the shield) and confirm their PIN; the console stays open for 12 hours. `ADMIN_PASSWORD` is a break-glass owner login for any trip. Only the owner can make or remove admins; nobody can demote or delete the owner.

- **Overview** — who's joined, submitted, drafting or not started; latest activity.
- **People** — view any plan (private answers included), edit it on someone's behalf, reset a PIN, delete; (owner) make admin.
- **Trip rules** — lock edits or schedule an auto-lock; nights per base, date window, preview length, browsing, peek, spectrum, popular badges, default currency.
- **Content** — hide, flag or feature an option.
- **Announcement** — a banner for everyone.
- **Data** — JSON (best for AI analysis) and CSV exports.
- **Activity** — every organizer action, and who peeked at whom.

## Troubleshooting

- **"Refusing to start Caravan: SUPABASE_URL points at a protected project"** → your environment points at the Lanks database. Use the `caravan` project's URL and key.
- **"Supabase is not configured"** on the live site → a Vercel environment variable is missing or misspelled. Fix it and redeploy.
- **"relation … does not exist"** → the SQL in step 3 wasn't run in the `caravan` project.
- **Everyone got logged out** → `SESSION_SECRET` changed. Keep it stable once people have joined.
