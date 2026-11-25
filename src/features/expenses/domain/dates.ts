import { LOCALE } from "./money";
import type { IsoDate } from "./types";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True when `value` is a real calendar date in `YYYY-MM-DD` form (rejects 2025-02-30). */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string") return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Local calendar date for `now` as `YYYY-MM-DD`. */
export function toIsoDate(now: Date): IsoDate {
  // Pad so years before 1000 still give `YYYY-MM-DD`, which isIsoDate accepts and strings compare by.
  const y = String(now.getFullYear()).padStart(4, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** `YYYY-MM` key for grouping by month. */
export function monthKey(date: IsoDate): string {
  return date.slice(0, 7);
}

/** The `count` month keys ending at (and including) the month of `now`, oldest first. */
export function recentMonthKeys(now: Date, count: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(toIsoDate(d).slice(0, 7));
  }
  return keys;
}

function parseLocal(date: IsoDate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const dayFormatter = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" });
const monthFormatter = new Intl.DateTimeFormat(LOCALE, { month: "short" });
const monthYearFormatter = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric" });

export function formatDate(date: IsoDate): string {
  return dayFormatter.format(parseLocal(date));
}

export function formatMonthShort(key: string): string {
  return monthFormatter.format(parseLocal(`${key}-01`));
}

export function formatMonthLong(key: string): string {
  return monthYearFormatter.format(parseLocal(`${key}-01`));
}
