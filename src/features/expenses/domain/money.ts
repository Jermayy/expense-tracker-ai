export const CURRENCY = "AUD";
export const LOCALE = "en-AU";

/** Largest single expense accepted: $10,000,000.00. Guards against typos and float overflow. */
export const MAX_AMOUNT_CENTS = 1_000_000_000;

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
});

const compactFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  notation: "compact",
  // 3 significant digits: "$618", "$1.25K". Avoids odd labels like "$618.4".
  maximumSignificantDigits: 3,
});

export function formatCents(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

export function formatCentsCompact(cents: number): string {
  return compactFormatter.format(cents / 100);
}

/** Plain decimal string with two places, e.g. `1234.50`. Used for CSV and form fields. */
export function centsToDecimalString(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * Parse a user-typed amount ("12", "12.5", "1,234.56", "$9.99") into cents
 * using string arithmetic, so no float rounding ever touches the value.
 * Returns null when the text is not a valid non-negative amount with at most 2 decimals.
 */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, "").replace(/,/g, "");
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const cents = whole * 100 + fraction;
  return Number.isSafeInteger(cents) ? cents : null;
}
