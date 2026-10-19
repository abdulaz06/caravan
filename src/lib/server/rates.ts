import "server-only";
import { CURRENCIES, FALLBACK_RATES, type CurrencyCode, type Rates } from "@/lib/currency";

const API = "https://open.er-api.com/v6/latest/USD"; // free, no key, updates daily

/** Live USD exchange rates, cached ~24 h by Next's data cache, with a fallback table. */
export async function getRates(): Promise<Rates> {
  try {
    const res = await fetch(API, { next: { revalidate: 60 * 60 * 24 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`rates ${res.status}`);
    const json = (await res.json()) as { result?: string; time_last_update_unix?: number; rates?: Record<string, number> };
    if (json.result !== "success" || !json.rates) throw new Error("bad rates payload");
    const rates = {} as Record<CurrencyCode, number>;
    for (const c of CURRENCIES) {
      const r = json.rates[c.code];
      rates[c.code] = typeof r === "number" && r > 0 ? r : FALLBACK_RATES.rates[c.code];
    }
    const date = json.time_last_update_unix
      ? new Date(json.time_last_update_unix * 1000).toISOString().slice(0, 10)
      : FALLBACK_RATES.date;
    return { rates, date, source: "live" };
  } catch {
    return FALLBACK_RATES;
  }
}
