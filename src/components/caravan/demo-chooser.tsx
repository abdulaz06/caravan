import { ArrowLeft, ArrowUpRight, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import type { Destination } from "@/lib/server/destinations";
import { Lockup } from "../brand/wordmark";
import { Photo } from "../ui/photo";

/** Pick a demo: one live trip per destination, 12 fictional travellers mid-planning. */
export function DemoChooser({ destinations }: { destinations: Destination[] }) {
  return (
    <div className="min-h-dvh bg-surface-100">
      <div className="mx-auto max-w-[760px] px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex h-14 items-center justify-between">
          <Link href="/" aria-label="Caravan home" className="-ml-1 flex items-center gap-1 rounded-full px-1 py-1 text-ink-2 hover:text-ink">
            <ArrowLeft className="size-4" />
            <Lockup size="sm" />
          </Link>
        </header>
        <h1 className="font-display mt-4 text-[40px] font-semibold leading-[1] tracking-[-0.03em]">
          Try a <span className="italic text-accent-600">demo trip</span>
        </h1>
        <p className="mt-3 max-w-lg text-[15.5px] leading-relaxed text-ink-2">
          Each demo is a trip mid-planning with 12 fictional travellers — some submitted, some still drafting. Plan your own version as a
          guest, or look around the organizer console. Everything resets every night.
        </p>
        <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13.5px] font-medium text-ink-2">
          <li className="flex items-center gap-1.5">
            <UserRound className="size-4 text-accent-600" /> Try it as a guest — no name or PIN
          </li>
          <li className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-secondary-700" /> View as organizer — read-only
          </li>
        </ul>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {destinations.map((d) => (
            <Link
              key={d.id}
              href={`/demo/${d.id}`}
              className="group relative block aspect-[4/5] overflow-hidden rounded-[28px] shadow-card sm:aspect-[3/4]"
              style={{ background: d.colors.deep }}
            >
              <Photo photo={d.photo ?? undefined} alt={d.name} sizes="(min-width: 640px) 360px, 100vw" className="transition duration-700 group-hover:scale-[1.04]" />
              <span className="absolute inset-0" style={{ background: `linear-gradient(to top, ${d.colors.deep} 8%, ${d.colors.deep}d9 36%, ${d.colors.deep}55 60%, transparent 82%)` }} />
              <span className="absolute inset-x-0 bottom-0 p-5 text-white">
                <span className="label block" style={{ color: d.colors.glow }}>
                  Demo · {d.length}
                </span>
                <span className="font-display mt-1.5 block text-[36px] font-semibold leading-none tracking-[-0.03em]">
                  {d.headline[0]} <span className="italic" style={{ color: d.colors.glow }}>{d.headline[1]}</span>
                </span>
                <span className="mt-2 block text-[14px] text-white/85">{d.shape}</span>
                <span className="mt-0.5 block text-[13px] text-white/65">12 travellers · 8 submitted · {d.options} things to do</span>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[14.5px] font-semibold" style={{ color: d.colors.glow }}>
                  Open the {d.name} demo <ArrowUpRight className="size-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
