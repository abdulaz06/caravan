import type { Metadata } from "next";
import Link from "next/link";
import { CaravanMark, Lockup } from "@/components/brand/wordmark";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface-100 px-5 py-16">
      <div className="w-full max-w-sm text-center">
        <CaravanMark className="mx-auto size-14 opacity-80" />
        <h1 className="font-display mt-6 text-[34px] font-semibold leading-[1.05] tracking-[-0.03em]">
          This road <span className="italic text-accent-600">goes nowhere</span>
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          If a friend sent you a trip link, check it was copied in full — or ask them to send it again.
        </p>
        <div className="mt-8 flex flex-col gap-2">
          <Link
            href="/new"
            className="inline-flex h-12 items-center justify-center rounded-full bg-accent-500 px-6 font-semibold text-white shadow-[0_4px_0_0_var(--color-accent-700)] transition active:translate-y-[3px] active:shadow-[0_1px_0_0_var(--color-accent-700)]"
          >
            Start a trip
          </Link>
          <Link href="/" className="inline-flex h-12 items-center justify-center rounded-full font-semibold text-ink-2 hover:bg-surface-200">
            Caravan home
          </Link>
          <Link href="/case-study" className="inline-flex h-10 items-center justify-center rounded-full text-[14px] font-semibold text-accent-600 hover:underline">
            Read the case study
          </Link>
        </div>
        <Lockup size="sm" className="mt-12 opacity-70" />
      </div>
    </main>
  );
}
