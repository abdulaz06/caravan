import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, Rubik_Dirt } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
  style: ["normal", "italic"],
  display: "swap",
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  axes: ["wdth"],
  display: "swap",
});

const rubikDirt = Rubik_Dirt({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-rubik-dirt",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Lanks by 10hyaya",
    template: "%s · Lanks by 10hyaya",
  },
  description:
    "The 10hyaya group trip to Sri Lanka, Dec '26 – Jan '27. Pick your dates, choose your days and nights, and help shape the plan. Takes 5 minutes.",
  applicationName: "Lanks by 10hyaya",
  openGraph: {
    title: "Lanks by 10hyaya · Build your dream Sri Lanka trip 🌴",
    description:
      "The 10hyaya group trip, Dec '26 – Jan '27. Whales, safaris, sunrise climbs, beach parties — pick your days and nights. Takes 5 minutes.",
    siteName: "Lanks by 10hyaya",
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lanks by 10hyaya · Build your dream Sri Lanka trip 🌴",
    description: "The 10hyaya group trip, Dec '26 – Jan '27. Pick your days and nights. Takes 5 minutes.",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f7eee0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${instrument.variable} ${rubikDirt.variable}`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
