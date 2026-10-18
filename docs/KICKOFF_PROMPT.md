# Kickoff prompt (v1 build)

Model: Opus 5.5 · Effort: high

---

Build v1 of Lanks end to end. The full product spec is in CLAUDE.md — read it completely first and treat it as the source of truth. Aesthetics are the top priority: this should look like a beautiful, polished travel product on a phone, not a template.

Work autonomously through the whole build. Only stop to ask me for things only I can do (creating accounts, pasting keys).

1. **Repo setup.** This folder already has CLAUDE.md, README.md, .gitignore, .env.example and docs/. Scaffold the Next.js (App Router, TypeScript, Tailwind) app around them without overwriting those files (scaffold in a temp dir and merge if needed). `git init`, make the first commit, then check whether the GitHub CLI (`gh`) is installed and logged in. If it is, create a **private** repo `abdulaz06/lanks` and push. If not, give me the exact steps to create the empty repo on github.com and the commands to push, and wait for me.
2. **Content research.** Use web search to research real, currently operating Sri Lanka activities and venues for late December, following the content rules in CLAUDE.md (~10 day pairs, ~8 night pairs, 1 NYE pair, region-tagged, vibe-scored, with properly credited Wikimedia Commons/Unsplash images). Write them to `src/content/`. Also build the regions + travel-time matrix.
3. **Design system first.** Before building screens, set the visual direction from the spec (tropical travel-poster): fonts, color tokens, textures/illustrations, motion principles. Make it distinctive.
4. **Build all features in the spec:** identity (name + PIN, cookie session, returning-user name list), dates calendar, day builder (pool of pairs, A-vs-B matchup sheet, chill night in, NYE pair pinned to Dec 31, drag-to-reorder days, move/swap single slots, notes, quick fill, balance meter, auto-inserted road-trip segments with durations and travel warnings), optional preferences step, review & submit, autosave, group overview with date-availability heatmap, browse-others (after submitting), admin page (lock edits, participants, reset PIN, delete, JSON + CSV export), Open Graph image and favicon.
5. **Supabase.** Write the SQL migration in `supabase/migrations/`. I've never used Supabase, so write `SETUP.md` with click-by-click steps (create project, run the SQL, where to copy each key, fill `.env.local`, add the same env vars in Vercel, import the GitHub repo in Vercel and deploy). Then pause and walk me through it so we can test against the real database.
6. **Verify.** `npm run build` must pass. Run the app and use Playwright to screenshot every key screen at an iPhone-size viewport (and one desktop), review the screenshots critically against the design direction, and fix anything that looks off. Test the full flow: join → dates spanning Dec 31 → build days → reorder → submit → edit → second user → group overview → admin lock → export.
7. Commit in logical chunks and push to `main` as you go.

When done, give me: the local run command, what's left for me to do to deploy, and a short list of the content in `src/content/` so I can review the activities.
