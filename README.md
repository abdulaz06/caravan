# Lanks 🌴

Build-your-own itinerary app for our friend group's Sri Lanka trip (Dec 2026 – Jan 2027).
Everyone opens the link, picks their dates and their ideal days and nights, and the organizer uses the combined picks to plan the final trip.

- Product spec and rules for Claude Code: [`CLAUDE.md`](./CLAUDE.md)
- Local setup and deployment: [`SETUP.md`](./SETUP.md)
- Activity content (edit freely): [`src/content/`](./src/content)

```bash
npm install
npm run dev        # http://localhost:3000 (uses a local test DB until Supabase is configured)
npm run build      # production build
npm run photos     # re-download/optimize photos after editing scripts/image-picks.json
```

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Framer Motion · dnd-kit · Supabase (server-only) · Vercel.
