// Currency list, fallback rates and formatting. All content prices are USD.

export const CURRENCIES = [
  { code: "LKR", name: "Sri Lankan rupee", symbol: "Rs", mark: "Rs", locale: "en-LK" },
  { code: "USD", name: "US dollar", symbol: "$", mark: "$", locale: "en-US" },
  { code: "GBP", name: "British pound", symbol: "£", mark: "£", locale: "en-GB" },
  { code: "EUR", name: "Euro", symbol: "€", mark: "€", locale: "en-IE" },
  { code: "AED", name: "UAE dirham", symbol: "AED", mark: "Dh", locale: "en-AE" },
  { code: "INR", name: "Indian rupee", symbol: "₹", mark: "₹", locale: "en-IN" },
  { code: "SAR", name: "Saudi riyal", symbol: "SAR", mark: "SR", locale: "en-SA" },
  { code: "QAR", name: "Qatari riyal", symbol: "QAR", mark: "QR", locale: "en-QA" },
  { code: "CAD", name: "Canadian dollar", symbol: "CA$", mark: "C$", locale: "en-CA" },
  { code: "AUD", name: "Australian dollar", symbol: "A$", mark: "A$", locale: "en-AU" },
  { code: "GEL", name: "Georgian lari", symbol: "₾", mark: "₾", locale: "en-GB" },
  { code: "JPY", name: "Japanese yen", symbol: "¥", mark: "¥", locale: "en-US" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];
export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as unknown as [CurrencyCode, ...CurrencyCode[]];
export const DEFAULT_CURRENCY: CurrencyCode = "USD";

export const isCurrency = (c: unknown): c is CurrencyCode =>
  typeof c === "string" && CURRENCIES.some((x) => x.code === c);

export type Rates = {
  /** units of each currency per 1 USD */
  rates: Record<CurrencyCode, number>;
  date: string; // YYYY-MM-DD the rates are from
  source: "live" | "fallback";
};

/** Used when the live API is unavailable (mid-Oct 2026 values). */
export const FALLBACK_RATES: Rates = {
  rates: {
    USD: 1,
    LKR: 331,
    GBP: 0.75,
    EUR: 0.89,
    AED: 3.6725,
    INR: 95.2,
    SAR: 3.75,
    QAR: 3.64,
    CAD: 1.41,
    AUD: 1.44,
    GEL: 2.72,
    JPY: 152,
  },
  date: "2026-10-19",
  source: "fallback",
};

/** Round to a friendly step for the size of the number. */
function friendly(n: number): number {
  const a = Math.abs(n);
  if (a === 0) return 0;
  if (a < 20) return Math.round(n);
  if (a < 200) return Math.round(n / 5) * 5;
  if (a < 2000) return Math.round(n / 10) * 10;
  if (a < 20000) return Math.round(n / 100) * 100;
  if (a < 200000) return Math.round(n / 500) * 500;
  return Math.round(n / 1000) * 1000;
}

export function convert(usd: number, code: CurrencyCode, rates: Rates): number {
  return usd * (rates.rates[code] ?? FALLBACK_RATES.rates[code] ?? 1);
}

const formatters = new Map<string, Intl.NumberFormat>();
function nf(code: CurrencyCode): Intl.NumberFormat {
  let f = formatters.get(code);
  if (!f) {
    const c = CURRENCIES.find((x) => x.code === code)!;
    f = new Intl.NumberFormat(c.locale, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    });
    formatters.set(code, f);
  }
  return f;
}

/** "$45", "Rs 15,000", "AED 165" — rounded to a friendly step. */
export function formatMoney(usd: number, code: CurrencyCode, rates: Rates): string {
  if (!Number.isFinite(usd)) return "∞";
  return nf(code).format(friendly(convert(usd, code, rates)));
}

/** "$15–35" style range; "Free" when both ends are 0. */
export function formatRange(range: [number, number], code: CurrencyCode, rates: Rates): string {
  const [lo, hi] = range;
  if (lo === 0 && hi === 0) return "Free";
  const a = formatMoney(lo, code, rates);
  if (!Number.isFinite(hi)) return `${a}+`;
  const b = formatMoney(hi, code, rates);
  if (a === b) return a;
  // Drop the repeated symbol on the high end: "$15–35", "Rs 5,000–8,000".
  const strip = b.replace(/^[^\d]*/, "");
  return `${a}–${strip}`;
}

export function rateLabel(rates: Rates): string {
  const d = new Date(`${rates.date}T00:00:00Z`);
  const when = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return rates.source === "live" ? `rates from ${when}` : `offline rates (${when})`;
}
