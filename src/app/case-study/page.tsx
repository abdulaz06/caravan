import type { Metadata } from "next";
import { CaseStudy, type CaseStudyStats } from "@/components/caravan/case-study";
import stats from "../../../content/case-study-stats.json";

const title = "Case study · Planning a group trip without the group chat";
const description =
  "How 13 friends planned a trip on Caravan — 8 full plans in a week — and what it took: the problem, design decisions, architecture and the hard parts.";

// The link preview is its own image (opengraph-image.jpg next to this page,
// from scripts/make-brand-assets.mjs) so a shared link reads as the case study.
export const metadata: Metadata = {
  title: "Case study",
  description,
  openGraph: { title, description, type: "article", siteName: "Caravan" },
  twitter: { card: "summary_large_image", title, description },
};

export default function CaseStudyPage() {
  return <CaseStudy stats={stats as CaseStudyStats} />;
}
