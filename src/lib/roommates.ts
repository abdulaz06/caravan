// "Who would you share a room with?" — just for fun. The organizers' view:
// who picked whom (in order), mutual matches (A picked B and B picked A) and
// the most-wanted roommates. Typed names that match someone who has since
// joined count as picking them. Pure, for the console and the exports.
import type { RoommatePick } from "./itinerary";

export type RoommatePerson = { id: string; name: string; picks?: RoommatePick[] };

export type BoardPick = { rank: number; name: string; id: string | null; joined: boolean };
export type RoommateBoard = {
  /** Everyone who picked anyone, with their picks in order. */
  rows: { id: string; name: string; picks: BoardPick[] }[];
  /** A ↔ B, each with the rank they gave the other. Best (lowest) combined rank first. */
  mutual: { a: { id: string; name: string; rank: number }; b: { id: string; name: string; rank: number } }[];
  /** How many people picked each person (joined or not), most first. */
  wanted: { name: string; id: string | null; count: number }[];
};

export function roommateBoard(people: RoommatePerson[]): RoommateBoard {
  const byId = new Map(people.map((p) => [p.id, p]));
  const byName = new Map(people.map((p) => [p.name.trim().toLowerCase(), p]));
  const resolve = (r: RoommatePick) => (r.id && byId.get(r.id)) || byName.get(r.name.trim().toLowerCase()) || null;

  const rows = people
    .filter((p) => p.picks?.length)
    .map((p) => ({
      id: p.id,
      name: p.name,
      picks: p.picks!.map((r, i) => {
        const who = resolve(r);
        return { rank: i + 1, name: who?.name ?? r.name, id: who?.id ?? null, joined: !!who };
      }),
    }));

  const rankOf = new Map<string, number>(); // "from→to" → rank
  for (const r of rows) for (const k of r.picks) if (k.id && k.id !== r.id) rankOf.set(`${r.id}→${k.id}`, k.rank);
  const mutual: RoommateBoard["mutual"] = [];
  for (const [key, rank] of rankOf) {
    const [from, to] = key.split("→");
    const back = rankOf.get(`${to}→${from}`);
    if (back === undefined || from > to) continue; // each pair once
    mutual.push({ a: { id: from, name: byId.get(from)!.name, rank }, b: { id: to, name: byId.get(to)!.name, rank: back } });
  }
  mutual.sort((x, y) => x.a.rank + x.b.rank - (y.a.rank + y.b.rank) || x.a.name.localeCompare(y.a.name));

  const counts = new Map<string, { name: string; id: string | null; count: number }>();
  for (const r of rows) {
    for (const k of r.picks) {
      const key = k.id ?? `name:${k.name.toLowerCase()}`;
      const cur = counts.get(key) ?? { name: k.name, id: k.id, count: 0 };
      cur.count++;
      counts.set(key, cur);
    }
  }
  const wanted = [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { rows, mutual, wanted };
}
