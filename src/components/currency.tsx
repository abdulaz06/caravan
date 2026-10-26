"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  FALLBACK_RATES,
  formatMoney,
  formatRange,
  isCurrency,
  rateLabel,
  type CurrencyCode,
  type Rates,
} from "@/lib/currency";

export const CURRENCY_COOKIE = "caravan_ccy";
const STORAGE_KEY = "caravan.currency";

// A tiny external store: localStorage for speed, a cookie so the server can
// render the same currency on the next visit (no flash).
let current: CurrencyCode | null = null;
const listeners = new Set<() => void>();
function readLocal(): CurrencyCode | null {
  if (current) return current;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (isCurrency(v)) current = v;
  } catch {
    // storage blocked — fine
  }
  return current;
}
function writeLocal(code: CurrencyCode) {
  current = code;
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // ignore
  }
  document.cookie = `${CURRENCY_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

type Ctx = {
  code: CurrencyCode;
  rates: Rates;
  setCode: (c: CurrencyCode) => void;
  money: (usd: number) => string;
  range: (r: [number, number]) => string;
  rateNote: string;
};

const CurrencyContext = createContext<Ctx>({
  code: DEFAULT_CURRENCY,
  rates: FALLBACK_RATES,
  setCode: () => {},
  money: (u) => formatMoney(u, DEFAULT_CURRENCY, FALLBACK_RATES),
  range: (r) => formatRange(r, DEFAULT_CURRENCY, FALLBACK_RATES),
  rateNote: rateLabel(FALLBACK_RATES),
});

export function useCurrency() {
  return useContext(CurrencyContext);
}

/**
 * `initial` comes from the server (cookie → saved preference → USD), so the
 * first render matches; localStorage wins afterwards if it differs.
 */
export function CurrencyProvider({
  initial,
  rates,
  children,
}: {
  initial: CurrencyCode;
  rates: Rates;
  children: React.ReactNode;
}) {
  const code = useSyncExternalStore(
    subscribe,
    () => readLocal() ?? initial,
    () => initial,
  );
  const setCode = useCallback((c: CurrencyCode) => writeLocal(c), []);
  const value = useMemo<Ctx>(
    () => ({
      code,
      rates,
      setCode,
      money: (u) => formatMoney(u, code, rates),
      range: (r) => formatRange(r, code, rates),
      rateNote: rateLabel(rates),
    }),
    [code, rates, setCode],
  );
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

/** Compact header currency picker. `onPick` lets the trip editor save it to preferences. */
export function CurrencyPicker({ onPick, className }: { onPick?: (c: CurrencyCode) => void; className?: string }) {
  const { code, setCode, rateNote, rates } = useCurrency();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = CURRENCIES.find((c) => c.code === code)!;

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Currency: ${meta.name}. Change currency`}
        aria-expanded={open}
        className="flex h-9 items-center gap-1.5 rounded-full bg-paper pl-1.5 pr-2.5 text-[13px] font-bold shadow-card ring-1 ring-ink/5 transition hover:bg-white"
      >
        <CurrencyMark mark={meta.mark} />
        <span className="tabular-nums">{code}</span>
        <ChevronDown className={cn("size-3.5 text-ink-3 transition", open && "rotate-180")} strokeWidth={2.75} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            className="absolute right-0 top-11 z-50 w-60 origin-top-right overflow-hidden rounded-2xl bg-paper p-1.5 shadow-lift ring-1 ring-ink/5"
            role="listbox"
            aria-label="Currency"
          >
            <p className="label px-3 pb-1 pt-2 text-ink-3">Show prices in</p>
            <ul className="max-h-[60vh] overflow-y-auto">
              {CURRENCIES.map((c) => (
                <li key={c.code}>
                  <button
                    role="option"
                    aria-selected={c.code === code}
                    onClick={() => {
                      setCode(c.code);
                      onPick?.(c.code);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[14px] transition hover:bg-surface-100",
                      c.code === code && "bg-surface-100 font-semibold",
                    )}
                  >
                    <CurrencyMark mark={c.mark} />
                    <span className="w-10 font-bold tabular-nums">{c.code}</span>
                    <span className="flex-1 truncate text-ink-2">{c.name}</span>
                    {c.code === code && <Check className="size-4 text-primary-600" strokeWidth={3} />}
                  </button>
                </li>
              ))}
            </ul>
            <p className="px-3 pb-2 pt-1.5 text-[11px] leading-snug text-ink-3">
              ≈ {rateNote}
              {rates.source === "live" ? " · open.er-api.com" : ""}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A small round badge with the currency's symbol (flag emoji don't render on Windows). */
function CurrencyMark({ mark }: { mark: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full bg-primary-100 font-bold leading-none text-primary-800",
        mark.length > 1 ? "text-[9.5px] tracking-[-0.02em]" : "text-[12.5px]",
      )}
    >
      {mark}
    </span>
  );
}
