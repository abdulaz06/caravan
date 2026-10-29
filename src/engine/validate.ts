// Preset validation: the zod schema checks each field's shape; this checks
// that the preset holds together — every id it mentions exists, matchups pair
// options of the right slot and pool, the bases chain up with transfers,
// every activity has a photo, every nightlife item has a family-friendly
// stand-in, and nothing family mode can show mentions drinks or nightlife.
// Used by `npm run preset:validate`, the unit tests and the app at startup.
import { CURRENCY_CODES } from "@/lib/currency";
import { compileCatalog, shownText, type Activity } from "./catalog";
import { bannedIn } from "./family-words";
import { photoSetSchema, presetSchema, type PhotoSet, type TripPreset } from "./preset-schema";

export type ValidationResult =
  | { ok: true; preset: TripPreset; photos: PhotoSet; problems: []; warnings: string[] }
  | { ok: false; preset?: TripPreset; photos?: PhotoSet; problems: string[]; warnings: string[] };

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;

export function validatePreset(raw: unknown, rawPhotos: unknown): ValidationResult {
  const parsed = presetSchema.safeParse(raw);
  const photosParsed = photoSetSchema.safeParse(rawPhotos);
  const problems: string[] = [];
  /** Worth fixing, but the app copes (e.g. an activity without a photo gets an illustrated fallback). */
  const warnings: string[] = [];
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 40)) problems.push(`preset.json ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  if (!photosParsed.success) {
    for (const issue of photosParsed.error.issues.slice(0, 20)) problems.push(`photos.json ${issue.path.join(".")}: ${issue.message}`);
  }
  if (!parsed.success || !photosParsed.success) return { ok: false, problems, warnings };
  const p = parsed.data;
  const photos = photosParsed.data;
  const err = (msg: string) => problems.push(msg);

  const regionIds = new Set(p.regions.map((r) => r.id));
  const areaIds = new Set(p.areas.map((a) => a.id));
  const baseIds = new Set(p.structure.bases.map((b) => b.id));
  const legIds = new Set(Object.keys(p.travel.legs));
  const hasPhoto = (key: string) => (photos[key]?.length ?? 0) > 0;
  const dup = (list: string[], what: string) => {
    const seen = new Set<string>();
    for (const x of list) {
      if (seen.has(x)) err(`Duplicate ${what} id "${x}"`);
      seen.add(x);
    }
  };
  dup(p.regions.map((r) => r.id), "region");
  dup(p.areas.map((a) => a.id), "area");
  dup(p.structure.bases.map((b) => b.id), "base");
  dup(p.activities.map((a) => a.id), "activity");
  dup(p.pairs.map((x) => x.id), "pair");
  dup(p.specialDates.map((s) => s.id), "special date");

  // ── Places, travel and the map ──
  for (const r of p.regions) if (!r.photos.some(hasPhoto)) err(`Region "${r.id}" has no photo (photo keys: ${r.photos.join(", ")})`);
  for (const [a, b] of p.travel.known) for (const r of [a, b]) if (!regionIds.has(r)) err(`travel.known mentions unknown region "${r}"`);
  for (const [id, l] of Object.entries(p.travel.legs)) for (const r of [l.from, l.to]) if (!regionIds.has(r)) err(`Leg "${id}" mentions unknown region "${r}"`);
  for (const [id, route] of Object.entries(p.travel.routes)) {
    for (const s of route.stops) if (!regionIds.has(s.region)) err(`Route "${id}" mentions unknown region "${s.region}"`);
    for (let i = 1; i < route.stops.length; i++) if (route.stops[i].km < route.stops[i - 1].km) err(`Route "${id}" stops must be in km order`);
  }
  for (const chain of p.map.chains) for (const r of chain) if (!regionIds.has(r)) err(`map.chains mentions unknown region "${r}"`);
  for (const road of p.map.roads) for (const r of [road.from, road.to]) if (!regionIds.has(r)) err(`map.roads mentions unknown region "${r}"`);

  // ── Structure ──
  for (const a of p.areas) if (!baseIds.has(a.home)) err(`Area "${a.id}" has an unknown home base "${a.home}"`);
  for (const b of p.structure.bases) {
    if (!regionIds.has(b.region)) err(`Base "${b.id}" is in unknown region "${b.region}"`);
    if (!areaIds.has(b.area)) err(`Base "${b.id}" draws from unknown area "${b.area}"`);
    if (!hasPhoto(b.photo)) err(`Base "${b.id}" has no photo "${b.photo}"`);
    if (b.nights.min > b.nights.default || b.nights.default > b.nights.max) err(`Base "${b.id}" nights must be min ≤ default ≤ max`);
    if (b.departureLeg && !legIds.has(b.departureLeg)) err(`Base "${b.id}" uses unknown departure leg "${b.departureLeg}"`);
    else if (b.departureLeg && p.travel.legs[b.departureLeg].from !== b.region) err(`Base "${b.id}"'s departure leg should leave from "${b.region}"`);
  }
  if (!p.structure.bases[0].arrivalName) err(`The first base ("${p.structure.bases[0].id}") needs an arrivalName`);
  const bases = p.structure.bases;
  if (p.structure.transfers.length !== bases.length - 1) err(`Expected ${bases.length - 1} transfer(s) between ${bases.length} bases`);
  p.structure.transfers.forEach((t, i) => {
    if (t.from !== bases[i]?.id || t.to !== bases[i + 1]?.id) err(`Transfer ${i + 1} should go from "${bases[i]?.id}" to "${bases[i + 1]?.id}"`);
    for (const l of [t.leg, t.scenicLeg]) if (l && !legIds.has(l)) err(`Transfer to "${t.to}" uses unknown leg "${l}"`);
    if (t.dayArea && !areaIds.has(t.dayArea)) err(`Transfer to "${t.to}" uses unknown area "${t.dayArea}"`);
    if (t.route && !p.travel.routes[t.route]) err(`Transfer to "${t.to}" uses unknown route "${t.route}"`);
    if (t.scenicLeg && !t.route) err(`Transfer to "${t.to}" has a scenic leg but no route`);
  });
  for (const l of [p.structure.arrival.leg, p.structure.departure.leg]) if (!legIds.has(l)) err(`Unknown leg "${l}"`);

  // ── Dates & money ──
  const { window, outer } = p.dates;
  if (window.start < outer.start || window.end > outer.end || window.start > window.end) err("dates.window must sit inside dates.outer");
  const fullTrip = bases.reduce((n, b) => n + b.nights.default, 0) + 1;
  if (daysBetween(window.start, window.end) < fullTrip) err(`dates.window must fit the ${fullTrip}-day default trip`);
  const { length, recommended } = p.dates;
  if (length.min > length.max) err("dates.length must be min ≤ max");
  if (daysBetween(window.start, window.end) < length.max) warnings.push(`dates.window is shorter than the longest trip (${length.max} days)`);
  if (recommended && (recommended.min > recommended.max || recommended.min < length.min || recommended.max > length.max)) {
    err("dates.recommended must sit inside dates.length (min ≤ max)");
  }
  for (const c of [p.currency.local, p.currency.default]) if (!(CURRENCY_CODES as readonly string[]).includes(c)) err(`Currency ${c} isn't supported (see src/lib/currency.ts)`);
  for (const s of p.preferences.stays) {
    for (const b of bases) if (!p.costs.accommodation[s.id]?.[b.id]) err(`costs.accommodation is missing ${s.id} × ${b.id}`);
  }

  // ── Stay in & photos ──
  for (const [slot, s] of Object.entries(p.stayIn)) if (s && !s.photos.some(hasPhoto)) err(`stayIn.${slot} has no photo`);
  if (!hasPhoto(p.destination.heroPhoto)) err(`The hero photo "${p.destination.heroPhoto}" is missing from photos.json`);

  // ── Activities ──
  const byId = new Map(p.activities.map((a) => [a.id, a]));
  for (const a of p.activities) {
    if (a.id === "stay" || a.id.includes("~")) err(`"${a.id}" is a reserved id`);
    if (!regionIds.has(a.region)) err(`${a.id}: unknown region "${a.region}"`);
    for (const ar of a.areas) if (!areaIds.has(ar)) err(`${a.id}: unknown area "${ar}"`);
    if (a.kind === "option" && a.slots.length !== 1) err(`${a.id}: an option has exactly one slot`);
    if (!hasPhoto(a.photo ?? a.id)) warnings.push(`${a.id}: no photo "${a.photo ?? a.id}" yet (shows the illustrated fallback)`);
    if (a.onlyWith && byId.get(a.onlyWith)?.kind !== "option") err(`${a.id}: onlyWith "${a.onlyWith}" isn't an option`);
    if (a.variants && a.kind !== "option") err(`${a.id}: only options can have variants`);
    if (a.routeKm !== undefined && !p.structure.transfers.some((t) => t.dayArea && a.areas.includes(t.dayArea))) err(`${a.id}: routeKm is only for stops on a transfer route`);
  }

  // ── Pairs & special dates ──
  for (const pair of p.pairs) {
    if (!areaIds.has(pair.area)) err(`Pair "${pair.id}" is in unknown area "${pair.area}"`);
    if (pair.special && !p.specialDates.some((s) => s.id === pair.special)) err(`Pair "${pair.id}" names unknown special date "${pair.special}"`);
    if (pair.a === pair.b) err(`Pair "${pair.id}" pairs an option with itself`);
    for (const oid of [pair.a, pair.b]) {
      const o = byId.get(oid);
      if (!o || o.kind !== "option") {
        err(`Pair "${pair.id}" references unknown option "${oid}"`);
        continue;
      }
      if (!o.slots.includes(pair.slot)) err(`Option "${oid}" isn't a ${pair.slot} option but pair "${pair.id}" is`);
      if (!o.areas.includes(pair.area)) err(`Option "${oid}" isn't valid in "${pair.area}" (pair "${pair.id}")`);
    }
  }
  for (const s of p.specialDates) {
    for (const [area, pairId] of Object.entries(s.pairs)) {
      const pair = p.pairs.find((x) => x.id === pairId);
      if (!areaIds.has(area)) err(`Special date "${s.id}" names unknown area "${area}"`);
      if (!pair) err(`Special date "${s.id}" names unknown pair "${pairId}"`);
      else if (pair.special !== s.id || pair.area !== area || pair.slot !== s.slot) err(`Pair "${pairId}" must be special "${s.id}", ${s.slot}, in "${area}"`);
    }
  }
  for (const area of areaIds) {
    for (const slot of ["day", "night"] as const) {
      const used = bases.some((b) => b.area === area) || p.structure.transfers.some((t) => (slot === "day" ? t.dayArea === area : false));
      if (used && !p.pairs.some((x) => x.area === area && x.slot === slot && !x.special)) {
        const isRouteNight = slot === "night" && p.structure.transfers.some((t) => t.dayArea === area) && !bases.some((b) => b.area === area);
        if (!isRouteNight) err(`No ${slot} matchups for area "${area}"`);
      }
    }
  }

  if (problems.length) return { ok: false, preset: p, photos, problems, warnings };

  // ── Family-friendly mode (needs the compiled catalog) ──
  const catalog = compileCatalog(p, photos);
  for (const a of [...catalog.activities, ...catalog.familyStandIns]) {
    if (!catalog.isNightlife(a)) continue;
    if (a.kind === "family") {
      err(`Family stand-in ${a.id} looks like nightlife`);
      continue;
    }
    const swap: Activity | undefined = a.familySwap ? catalog.byId[a.familySwap] : undefined;
    if (!swap) err(`Nightlife item ${a.id} needs a familySwap`);
    else {
      if (catalog.isNightlife(swap)) err(`familySwap for ${a.id} (${swap.id}) is nightlife too`);
      if (!a.slots.every((s) => swap.slots.includes(s))) err(`familySwap for ${a.id} doesn't fit the same slot`);
      if (!a.areas.some((w) => swap.areas.includes(w))) err(`familySwap for ${a.id} is in a different area`);
    }
  }
  for (const a of [...catalog.activities, ...catalog.familyStandIns]) {
    const shown = catalog.byId[catalog.familyIdFor(a.id)];
    if (!shown) continue;
    const bad = shownText(shown).flatMap(bannedIn);
    if (bad.length) err(`Family mode would show "${[...new Set(bad)].join(", ")}" for ${a.id} — add familyText or reword it`);
  }
  for (const [slot, s] of Object.entries(p.stayIn)) {
    if (!s) continue;
    const t = { ...s, ...s.familyText };
    const bad = [t.title, t.tagline, t.description, ...(t.highlights ?? []), s.meta].flatMap(bannedIn);
    if (bad.length) err(`Family mode would show "${[...new Set(bad)].join(", ")}" in stayIn.${slot} — add familyText`);
  }
  const shownCopy = [
    p.destination.familyTagline ?? p.destination.tagline,
    p.destination.blurb,
    ...p.categories.filter((c) => c.id !== "party").map((c) => c.label),
    ...bases.map((b) => b.tagline),
  ];
  for (const t of shownCopy) {
    const bad = bannedIn(t);
    if (bad.length) err(`Family mode would show "${bad.join(", ")}" in "${t}"`);
  }

  return problems.length ? { ok: false, preset: p, photos, problems, warnings } : { ok: true, preset: p, photos, problems: [], warnings };
}
