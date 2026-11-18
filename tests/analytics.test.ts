import { describe, expect, it } from "vitest";
import { summarize } from "@/features/expenses/lib/analytics";
import { NOW, buildExpense } from "./factories";

describe("summarize", () => {
  const expenses = [
    buildExpense({ date: "2026-11-02", amountCents: 3000, category: "Food" }),
    buildExpense({ date: "2026-11-15", amountCents: 6000, category: "Bills" }),
    buildExpense({ date: "2026-10-20", amountCents: 6000, category: "Food" }),
    buildExpense({ date: "2025-01-01", amountCents: 1000, category: "Other" }),
  ];
  const summary = summarize(expenses, NOW);

  it("totals everything and this/last month", () => {
    expect(summary.totalCents).toBe(16000);
    expect(summary.count).toBe(4);
    expect(summary.thisMonthCents).toBe(9000);
    expect(summary.lastMonthCents).toBe(6000);
    expect(summary.monthOverMonth).toBeCloseTo(0.5);
  });

  it("computes the daily average from the day of the month", () => {
    expect(summary.dailyAverageThisMonthCents).toBe(500); // 9000 / 18 days
  });

  it("ranks categories by total and omits empty ones", () => {
    expect(summary.byCategory.map((c) => [c.category, c.totalCents])).toEqual([
      ["Food", 9000],
      ["Bills", 6000],
      ["Other", 1000],
    ]);
    expect(summary.byCategory[0].share).toBeCloseTo(9000 / 16000);
  });

  it("returns the last 6 months including empty ones", () => {
    expect(summary.byMonth.map((m) => [m.month, m.totalCents])).toEqual([
      ["2026-06", 0],
      ["2026-07", 0],
      ["2026-08", 0],
      ["2026-09", 0],
      ["2026-10", 6000],
      ["2026-11", 9000],
    ]);
  });

  it("returns null month-over-month change when last month is empty", () => {
    expect(summarize([buildExpense({ date: "2026-11-01" })], NOW).monthOverMonth).toBeNull();
  });

  it("handles no expenses", () => {
    const empty = summarize([], NOW);
    expect(empty.totalCents).toBe(0);
    expect(empty.byCategory).toEqual([]);
  });
});
