/**
 * Caravan's architecture as an inline SVG: browser → Next.js on Vercel →
 * trip engine + presets → Supabase, with the cron, rates API and photo
 * pipeline around it. Colours come from the page's tokens.
 */
export function ArchitectureDiagram({ className }: { className?: string }) {
  const box = (x: number, y: number, w: number, h: number, title: string, lines: string[], tone: "dark" | "light" | "accent" = "light") => {
    const fill = tone === "dark" ? "var(--color-primary-900)" : tone === "accent" ? "var(--color-accent-500)" : "var(--color-paper)";
    const ink = tone === "light" ? "var(--color-ink)" : "var(--color-paper)";
    const sub = tone === "light" ? "var(--color-ink-3)" : "rgb(255 255 255 / 0.72)";
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx={14} fill={fill} stroke="var(--color-surface-300)" strokeWidth={tone === "light" ? 1.5 : 0} />
        <text x={x + 16} y={y + 28} fontSize={15} fontWeight={700} fill={ink} fontFamily="var(--font-sans)">
          {title}
        </text>
        {lines.map((l, i) => (
          <text key={l} x={x + 16} y={y + 50 + i * 19} fontSize={12.5} fill={sub} fontFamily="var(--font-sans)">
            {l}
          </text>
        ))}
      </g>
    );
  };
  const arrow = (d: string, label?: { x: number; y: number; text: string }) => (
    <g>
      <path d={d} fill="none" stroke="var(--color-ink-3)" strokeWidth={1.6} markerEnd="url(#arch-arrow)" />
      {label && (
        <text x={label.x} y={label.y} fontSize={11.5} fill="var(--color-ink-3)" fontFamily="var(--font-sans)" textAnchor="middle">
          {label.text}
        </text>
      )}
    </g>
  );
  return (
    <svg viewBox="0 0 760 560" className={className} role="img" aria-label="Architecture: the browser talks to Next.js on Vercel; server code runs the trip engine on presets and reads and writes Supabase; a cron resets the demo; exchange rates and photos come from outside services.">
      <defs>
        <marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="var(--color-ink-3)" />
        </marker>
      </defs>
      {box(250, 10, 260, 92, "Phone browser", ["React 19 · Framer Motion · dnd-kit", "Engine + preset sent with the page", "Canvas share images"])}
      {arrow("M380 104 L380 146", { x: 470, y: 130, text: "invite link /t/<slug> · JSON API" })}
      {box(150, 150, 460, 120, "Next.js 16 on Vercel", ["Server components render each trip with its preset theme", "Route handlers /api/t/[slug]/… · zod on every input", "Signed httpOnly cookies (jose) · bcrypt PINs · role checks", "Rate-limited trip creation (salted IP hash)"], "dark")}
      {arrow("M250 272 L180 318")}
      {arrow("M510 272 L580 318")}
      {box(20, 322, 330, 116, "Trip engine (pure TypeScript)", ["Day structure · matchups · quick fill", "Timeline, drive times, budget, routes", "Family-friendly swaps · popular picks", "Versioned plans + safe migrations"])}
      {box(410, 322, 330, 116, "Supabase Postgres", ["trips · participants · itineraries", "activity_log · peeks", "RLS on, no policies — server key only", "Guard refuses the original app's DB"])}
      {arrow("M185 472 L185 442")}
      {box(20, 474, 330, 76, "Presets (JSON + zod)", ["Sri Lanka · Georgia — options, map,", "drive times, theme, credited photos"], "accent")}
      {box(410, 474, 155, 76, "Vercel Cron", ["Nightly demo", "reset"])}
      {box(585, 474, 155, 76, "Exchange rates", ["open.er-api.com", "cached 24 h"])}
      {arrow("M487 472 L520 442")}
      <path d="M612 230 C700 230 700 474 662 474" fill="none" stroke="var(--color-ink-3)" strokeWidth={1.6} strokeDasharray="4 4" markerEnd="url(#arch-arrow)" />
    </svg>
  );
}
