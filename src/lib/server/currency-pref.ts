import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_CURRENCY, isCurrency, type CurrencyCode } from "@/lib/currency";

/** Cookie (set by the picker) → the user's saved preference → the organizers' default → USD. */
export async function initialCurrency(saved?: string | null, fallback: CurrencyCode = DEFAULT_CURRENCY): Promise<CurrencyCode> {
  const fromCookie = (await cookies()).get("caravan_ccy")?.value;
  if (isCurrency(fromCookie)) return fromCookie;
  if (isCurrency(saved)) return saved;
  return fallback;
}
