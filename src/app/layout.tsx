import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, Playfair_Display } from "next/font/google";
import { BRAND } from "@/lib/brand";
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

// Display faces only some presets use (see src/lib/theme.ts): not preloaded, so
// pages that don't use them don't download them.
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

// Link previews need an absolute URL. A localhost NEXT_PUBLIC_SITE_URL copied
// into Vercel by mistake is ignored there in favour of the production domain.
function siteUrl(): string {
  const set = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const onVercel = !!(process.env.VERCEL || vercel);
  if (set && !(onVercel && /\/\/(localhost|127\.0\.0\.1)\b/.test(set))) return set;
  return vercel ? `https://${vercel}` : (set ?? "http://localhost:3000");
}

const description =
  "A group-trip planner where everyone builds their own version of the trip from curated options — then the organizer sees exactly where the group overlaps.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${BRAND.name} · ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description,
  applicationName: BRAND.name,
  openGraph: {
    title: `${BRAND.name} · ${BRAND.tagline}`,
    description,
    siteName: BRAND.name,
    type: "website",
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image", title: `${BRAND.name} · ${BRAND.tagline}`, description },
};

export const viewport: Viewport = {
  themeColor: "#f4f0e8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${instrument.variable} ${playfair.variable}`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
