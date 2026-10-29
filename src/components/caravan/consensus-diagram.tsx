/**
 * How the group plan is made, as an inline SVG: everyone's plans → equal
 * voice → dates → the slots the trip's rules allow → fair floor → fill →
 * improve → splits & reasons → the plan everyone RSVPs to. Colours come
 * from the page's tokens (same look as the architecture diagram).
 */
export function ConsensusDiagram({ className }: { className?: string }) {
  const box = (x: number, y: number, w: number, h: number, title: string, lines: string[], tone: "dark" | "light" | "accent" = "light") => {
    const fill = tone === "dark" ? "var(--color-primary-900)" : tone === "accent" ? "var(--color-accent-500)" : "var(--color-paper)";
    const ink = tone === "light" ? "var(--color-ink)" : "var(--color-paper)";
    const sub = tone === "light" ? "var(--color-ink-3)" : "rgb(255 255 255 / 0.75)";
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx={14} fill={fill} stroke="var(--color-surface-300)" strokeWidth={tone === "light" ? 1.5 : 0} />
        <text x={x + 16} y={y + 27} fontSize={15} fontWeight={700} fill={ink} fontFamily="var(--font-sans)">
          {title}
        </text>
        {lines.map((l, i) => (
          <text key={l} x={x + 16} y={y + 48 + i * 18} fontSize={12.5} fill={sub} fontFamily="var(--font-sans)">
            {l}
          </text>
        ))}
      </g>
    );
  };
  const arrow = (d: string) => <path d={d} fill="none" stroke="var(--color-ink-3)" strokeWidth={1.6} markerEnd="url(#cons-arrow)" />;
  // Twelve little plan cards: everyone's own version of the trip.
  const cards = Array.from({ length: 12 }, (_, i) => (
    <rect key={i} x={24 + (i % 6) * 34} y={30 + Math.floor(i / 6) * 40} width={26} height={32} rx={6} fill={i % 3 === 0 ? "var(--color-highlight-200)" : "var(--color-surface-200)"} stroke="var(--color-surface-300)" />
  ));
  return (
    <svg
      viewBox="0 0 760 590"
      className={className}
      role="img"
      aria-label="How the group plan is made: everyone's plans become equal votes; the dates are chosen by who can make the whole window; slots follow the trip's own rules; a fair floor gives everyone some of their picks; the rest is filled by popularity and improved by swaps; splits and reasons are added; the published plan gets RSVPs."
    >
      <defs>
        <marker id="cons-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="var(--color-ink-3)" />
        </marker>
      </defs>
      <g>
        <rect x={10} y={10} width={232} height={116} rx={14} fill="var(--color-surface-50)" stroke="var(--color-surface-300)" strokeWidth={1.5} />
        {cards}
        <text x={24} y={118} fontSize={12.5} fill="var(--color-ink-3)" fontFamily="var(--font-sans)">
          Everyone&apos;s own plan: dates + picks
        </text>
      </g>
      {arrow("M244 68 L282 68")}
      {box(286, 10, 220, 116, "1 · Equal voice", ["Each person's picks share", "one vote (drafts count less)", "Stay-ins = demand for rest"])}
      {arrow("M508 68 L546 68")}
      {box(550, 10, 200, 116, "2 · Dates", ["Length: most people there", "for all of it × days", "Window: most free, person-days"])}
      {arrow("M650 128 L650 166")}
      {box(390, 170, 360, 100, "3 · Slots, inside the trip's rules", ["Pools, on-the-way stops, weekdays, NYE by vote", "One main meal a slot · extras close by", "No duplicates · no late night before an early start"], "dark")}
      {arrow("M388 220 L330 220")}
      {box(10, 170, 316, 100, "A · Most popular first", ["Fill by score, improve, add popular", "extras: the yardstick (this is", "Majority rules)"])}
      {arrow("M168 272 L168 310")}
      {box(10, 314, 316, 100, "B · Lift the lowest share", ["The least-satisfied person, then the", "next — giving up at most 15% of the", "popularity (an organizer knob)"], "accent")}
      {arrow("M328 364 L386 364")}
      {box(390, 314, 360, 100, "C · Improve", ["Deterministic swaps and moves while", "popularity + λ·fairness − penalties improves", "(never lowering the lowest share)"])}
      {arrow("M570 416 L570 454")}
      {box(390, 458, 360, 120, "The plan", ["Reason chips on every item · runners-up", "Split suggestions (\"5 dive / 8 whales\")", "Satisfaction: min, median, Jain's index", "Published → RSVPs with live headcounts"], "dark")}
      {box(10, 458, 316, 120, "The organizer decides how", ["Everyone gets a say · lift, then popular", "Majority rules · most picked wins", "Custom · slide between the two", "Locks, swaps, splits survive regenerating"])}
      {arrow("M328 518 L386 518")}
    </svg>
  );
}
