// What a 👀 peek may show: picks (titles, area, cover photo), dates and the
// balance meter. Never ids, details, day notes or private answers.

export type PeekItem = { title: string; area: string | null; photo: string | null; emoji: string | null };
export type PeekDay = { label: string; name: string; day: PeekItem[]; night: PeekItem[] };
export type PeekPlan = {
  name: string;
  status: "new" | "draft" | "submitted";
  dates: string | null;
  length: string | null;
  days: PeekDay[];
  balance: { score: number | null; title: string };
};
