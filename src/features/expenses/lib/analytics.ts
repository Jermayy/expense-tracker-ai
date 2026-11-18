import { monthKey, recentMonthKeys, toIsoDate } from "../domain/dates";
import { CATEGORIES, type Category, type Expense } from "../domain/types";

export interface CategoryTotal {
  category: Category;
  totalCents: number;
  count: number;
  /** Share of the overall total, 0–1. */
  share: number;
}

export interface MonthTotal {
  month: string;
  totalCents: number;
  count: number;
}

export interface SpendingSummary {
  totalCents: number;
  count: number;
  thisMonthCents: number;
  lastMonthCents: number;
  /** Fractional change vs last month, or null when last month had no spending. */
  monthOverMonth: number | null;
  /** Average spend per day so far this month. */
  dailyAverageThisMonthCents: number;
  /** Categories with spending, largest first. */
  byCategory: CategoryTotal[];
  /** Last 6 months, oldest first, including empty months. */
  byMonth: MonthTotal[];
}

export const TREND_MONTHS = 6;

export function summarize(expenses: readonly Expense[], now: Date): SpendingSummary {
  const months = recentMonthKeys(now, TREND_MONTHS);
  const currentMonth = months[months.length - 1];
  const previousMonth = months[months.length - 2];

  const monthTotals = new Map<string, MonthTotal>(months.map((month) => [month, { month, totalCents: 0, count: 0 }]));
  const categoryTotals = new Map<Category, { totalCents: number; count: number }>(
    CATEGORIES.map((c) => [c, { totalCents: 0, count: 0 }]),
  );

  let totalCents = 0;
  let lastMonthCents = 0;
  let thisMonthCents = 0;

  for (const e of expenses) {
    totalCents += e.amountCents;
    const bucket = categoryTotals.get(e.category)!;
    bucket.totalCents += e.amountCents;
    bucket.count += 1;

    const key = monthKey(e.date);
    const month = monthTotals.get(key);
    if (month) {
      month.totalCents += e.amountCents;
      month.count += 1;
    }
    if (key === currentMonth) thisMonthCents += e.amountCents;
    if (key === previousMonth) lastMonthCents += e.amountCents;
  }

  const dayOfMonth = Number(toIsoDate(now).slice(8, 10));

  const byCategory = [...categoryTotals.entries()]
    .filter(([, t]) => t.count > 0)
    .map(([category, t]) => ({
      category,
      ...t,
      share: totalCents > 0 ? t.totalCents / totalCents : 0,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);

  return {
    totalCents,
    count: expenses.length,
    thisMonthCents,
    lastMonthCents,
    monthOverMonth: lastMonthCents > 0 ? (thisMonthCents - lastMonthCents) / lastMonthCents : null,
    dailyAverageThisMonthCents: Math.round(thisMonthCents / dayOfMonth),
    byCategory,
    byMonth: [...monthTotals.values()],
  };
}
