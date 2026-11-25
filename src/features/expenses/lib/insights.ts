import { monthKey, toIsoDate } from "../domain/dates";
import { CATEGORIES, type Category, type Expense, type IsoDate } from "../domain/types";
import type { CategoryTotal } from "./analytics";

export const TOP_CATEGORY_COUNT = 3;

export interface MonthlySpending {
  /** `YYYY-MM` of the month described. */
  month: string;
  totalCents: number;
  count: number;
  /** Categories with spending this month, largest first; ties keep CATEGORIES order. */
  byCategory: CategoryTotal[];
  /** The first TOP_CATEGORY_COUNT of byCategory. */
  top: CategoryTotal[];
}

/** Spending by category for the calendar month containing `now`. */
export function monthlySpending(expenses: readonly Expense[], now: Date): MonthlySpending {
  const month = monthKey(toIsoDate(now));
  const totals = new Map<Category, { totalCents: number; count: number }>(
    CATEGORIES.map((c) => [c, { totalCents: 0, count: 0 }]),
  );
  let totalCents = 0;
  let count = 0;

  for (const e of expenses) {
    if (monthKey(e.date) !== month) continue;
    const bucket = totals.get(e.category)!;
    bucket.totalCents += e.amountCents;
    bucket.count += 1;
    totalCents += e.amountCents;
    count += 1;
  }

  // Array.prototype.sort is stable, so equal totals stay in CATEGORIES order.
  const byCategory = [...totals.entries()]
    .filter(([, t]) => t.count > 0)
    .map(([category, t]) => ({ category, ...t, share: totalCents > 0 ? t.totalCents / totalCents : 0 }))
    .sort((a, b) => b.totalCents - a.totalCents);

  return { month, totalCents, count, byCategory, top: byCategory.slice(0, TOP_CATEGORY_COUNT) };
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** The day's allowance in cents (floored), for display. The streak itself compares exactly. */
export function dailyAllowanceCents(monthlyBudgetCents: number, now: Date): number {
  return Math.floor(monthlyBudgetCents / daysInMonth(now.getFullYear(), now.getMonth()));
}

/**
 * Consecutive days, ending today, on which spending was at or under the daily allowance
 * (monthly budget ÷ days in that day's month). Today counts while it's under, since it's
 * "so far". Counting stops at the first day over the allowance, and never goes back before
 * the earliest expense: there's no record of earlier days to claim them.
 */
export function budgetStreak(expenses: readonly Expense[], monthlyBudgetCents: number, now: Date): number {
  const today = toIsoDate(now);
  const daily = new Map<IsoDate, number>();
  let earliest: IsoDate | null = null;
  for (const e of expenses) {
    if (e.date > today) continue; // Future-dated expenses haven't happened yet.
    daily.set(e.date, (daily.get(e.date) ?? 0) + e.amountCents);
    if (earliest === null || e.date < earliest) earliest = e.date;
  }
  if (earliest === null) return 0;

  let streak = 0;
  // Build each day from calendar parts so DST changes can't skip or repeat a day.
  for (let offset = 0; ; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const iso = toIsoDate(day);
    if (iso < earliest) break;
    const spent = daily.get(iso) ?? 0;
    // spent ≤ budget / days, compared in integers so cents never round.
    if (spent * daysInMonth(day.getFullYear(), day.getMonth()) > monthlyBudgetCents) break;
    streak += 1;
  }
  return streak;
}
