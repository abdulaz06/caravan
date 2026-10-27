import type { Metadata } from "next";
import { CaseStudy, type CaseStudyStats } from "@/components/caravan/case-study";
import stats from "../../../content/case-study-stats.json";

export const metadata: Metadata = {
  title: "Case study",
  description: "How a group trip planner for 13 friends became Caravan: the problem, the idea, results, design decisions, architecture and the hard parts.",
};

export default function CaseStudyPage() {
  return <CaseStudy stats={stats as CaseStudyStats} dev={process.env.NODE_ENV !== "production"} />;
}
