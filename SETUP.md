# Lanks — setup & deployment

This guide assumes you've never used Supabase or deployed to Vercel before. It takes about 20 minutes.

**What you'll end up with:** the app running on your computer, a free Supabase database holding everyone's itineraries, and a live link on Vercel to drop in the group chat.

---

## 0. What you need

- **Node.js 20.9 or newer** — check with `node -v`.
- The repo on your computer (you already have it: `abdulaz06/lanks`).
- A **GitHub** account (you have one) and a **Vercel** account (you have one).
- A **Supabase** account — free. You'll create it in step 2.

---

## 1. Run it locally (no database needed)

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Without Supabase settings, the app automatically uses a **local test database** (a file at `.data/dev-db.json`, ignored by git) so you can click around straight away. The organizer console is at http://localhost:3000/admin: until you set `ADMIN_PASSWORD`, the local emergency password is `admin` (locally nobody is the owner yet, so that password is how you make someone an admin).

> The local test database only works on your computer. The live site always needs Supabase.

---

## 2. Create the Supabase project

1. Go to **https://supabase.com** → **Start your project** → sign up (signing in with GitHub is easiest).
2. If asked, create an **organization** (any name, e.g. "Lanks", Free plan).
3. Click **New project**:
   - **Name:** `lanks`
   - **Database password:** click **Generate a password** and save it in your password manager. (The app doesn't use it, but you'll want it if you ever connect to the database directly.)
   - **Region:** pick the one closest to most of the group (e.g. *West EU (London)* or *Central EU (Frankfurt)*). Remember it — you'll match it in Vercel later.
   - Leave the rest as is and click **Create new project**. It takes a minute or two to set up.

## 3. Create the tables (run the SQL)

1. In your project, open **SQL Editor** in the left sidebar (the `>_` icon).
2. Click **New query** (or the **+**).
3. Open the file [`supabase/migrations/20261018000000_init.sql`](supabase/migrations/20261018000000_init.sql) from this repo, copy **all** of it, and paste it into the editor.
4. Click **Run** (bottom right, or Ctrl/Cmd + Enter). You should see *"Success. No rows returned"*.
5. Do the same with every other file in [`supabase/migrations/`](supabase/migrations/), **in date order** — currently [`20261021000000_organizers_rules_peek.sql`](supabase/migrations/20261021000000_organizers_rules_peek.sql) (roles, live trip rules, activity log and peeks). It's safe to run more than once; its last line lists who's an organizer. The person named **Abdul** becomes the owner, and **Aadil** becomes an admin only if he has already joined.
6. Check it worked: open **Table Editor** in the left sidebar — you should see `participants`, `itineraries`, `settings`, `activity_log` and `peeks`. Each one shows an "RLS enabled" badge. That's intended: it means nobody can read the data with the public key; only the app's server can.

> If Supabase shows a warning like *"this query has destructive operations"*, that's because of the `revoke` lines. It's safe — click **Run** again to confirm.

## 4. Copy your two Supabase values

You need the **Project URL** and the **secret key**.

**Project URL**
1. Click **Connect** in the top bar of your project.
2. Copy the **Project URL**. It looks like `https://abcdefghijklmnop.supabase.co`.

**Secret key**
1. Click the **gear icon (Project Settings)** at the bottom of the left sidebar → **API Keys**.
2. On the **API Keys** tab, find **Secret keys**. If there isn't one yet, click **Create new API keys** (or **Add new secret key**).
3. Click the eye/copy button to reveal and copy the key. It starts with `sb_secret_`.

> ⚠️ The secret key gives full access to your database. Only ever paste it into `.env.local` or Vercel's environment variables — never into the code, a chat, or a variable starting with `NEXT_PUBLIC_`. If it ever leaks, create a new one on the same page and delete the old one.
>
> (There's also a *Legacy API Keys* tab with a `service_role` key. That works too, but Supabase is retiring legacy keys at the end of 2026, so use the `sb_secret_` one.)

## 5. Fill in `.env.local`

1. In the project folder, copy `.env.example` to a new file named `.env.local`.
2. Fill it in:

```bash
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxxxxxxxxxxxxxxxxxxxxx
SESSION_SECRET=<a long random string — see below>
ADMIN_PASSWORD=<pick a password for /admin>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

To generate `SESSION_SECRET`, run this and paste the output:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. Restart the dev server (`Ctrl+C`, then `npm run dev`). The app now uses your real Supabase database. Join the trip at http://localhost:3000 and you'll see your row appear in Supabase → **Table Editor → participants**.

> `.env.local` is in `.gitignore`, so it will never be committed.

---

## 6. Deploy to Vercel

1. Go to **https://vercel.com/new**.
2. Under **Import Git Repository**, find **lanks**. If you don't see it, click **Adjust GitHub App Permissions** (or "Configure GitHub App"), give Vercel access to the `abdulaz06/lanks` repository, and come back.
3. Click **Import** next to `lanks`.
4. **Framework Preset** should say **Next.js**. Leave *Root Directory*, *Build* and *Output* settings as they are.
5. Open **Environment Variables** and add these four (name on the left, value on the right — the same values as your `.env.local`):

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | your `sb_secret_…` key |
   | `SESSION_SECRET` | a **new** long random string (generate another one) |
   | `ADMIN_PASSWORD` | your admin password |

   `NEXT_PUBLIC_SITE_URL` is optional on Vercel — the app uses your production domain automatically. Add it only if you attach a custom domain (set it to e.g. `https://lanks.example.com`).
6. Click **Deploy**. After a minute or two you'll get a link like `https://lanks-abc123.vercel.app`. 🎉
7. **Match the region** (makes the app snappier): Vercel → your project → **Settings → Functions → Function Region** → choose the region closest to your Supabase region (e.g. London → `lhr1`, Frankfurt → `fra1`) → **Save**, then **Deployments → ⋯ → Redeploy**.

From now on, every `git push` to `main` redeploys automatically.

### Changing environment variables later
Vercel → project → **Settings → Environment Variables** → edit → then **Deployments → ⋯ (latest) → Redeploy**. Changes only apply after a redeploy.

---

## 7. Before you share the link

- Open the live link on your phone and join once to test it.
- Sign in with your name + PIN and tap **Organizer** in the header (or visit `/admin`); it asks for your PIN once more. `ADMIN_PASSWORD` is the owner's emergency way in.
- Paste the link into a WhatsApp chat with yourself to check the preview card (image + title). WhatsApp caches previews, so if you change it later, add `?v=2` to the link.
- If you made test accounts, delete them from `/admin` before sharing.

## Organizer cheat sheet (`/admin`)

Organizers (the **owner** and any **admins**) sign in like everyone else, then tap **Organizer** and confirm their PIN; the console stays open for 12 hours. Only the owner can make or remove admins; nobody can demote or delete the owner.

- **Overview** — who's joined, submitted, still drafting or not started, and the latest activity.
- **People** — view anyone's full plan (private answers included), **Edit plan** in the normal day builder (stamped "Edited by you"; works even while edits are locked), reset a PIN, delete, and (owner) **Make admin**.
- **Trip rules** — lock edits now or schedule an **auto-lock** (everyone sees a countdown); Colombo/Galle nights, the date window and whether the shorter trip can be submitted (you'll see how many plans need re-picks before anything changes); preview, area filtering, browsing, 👀 peek, the spectrum, the Halal button and the default currency.
- **Content** — hide an option (people who picked it see "No longer available"), flag it to re-check, or feature it.
- **Announcement** — a banner for everyone, on or off.
- **Data** — *JSON* is best for AI analysis; the two CSVs are for spreadsheets.
- **Activity** — every organizer action, and who peeked at whom.

## Editing content

All activities, pairs and regions live in `src/content/`:

- `options.ts` — every daytime/evening option (titles, descriptions, prices, vibe…)
- `pairs.ts` — which options face off in each A-vs-B matchup
- `regions.ts` — regions and the drive-time matrix
- `preferences.ts` — the choices on the "extras" step

Photos come from `scripts/image-picks.json` (Wikimedia Commons file names). After changing it, run `npm run photos` to download, optimize and re-credit them.

## Troubleshooting

- **"Supabase is not configured"** on the live site → an environment variable is missing or misspelled in Vercel. Fix it and redeploy.
- **"Database error: … relation does not exist"** → the SQL in step 3 wasn't run (or was run in a different project).
- **Everyone got logged out** → `SESSION_SECRET` changed. Keep it stable once people have joined.
- **Someone forgot their PIN** → console → People → **Reset PIN** → set a new one and tell them.
- **"column … role does not exist"** or the console won't open → the organizers migration (section 3, item 5) wasn't run.
