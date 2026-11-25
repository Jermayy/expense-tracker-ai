import { describe, expect, it } from "vitest";
import { budgetStreak, dailyAllowanceCents, daysInMonth, monthlyInsights } from "@/features/expenses/lib/insights";
import { BUDGET_STORAGE_KEY, loadBudget, parseBudget, saveBudget } from "@/features/expenses/lib/budget";
import { StorageError } from "@/features/expenses/lib/storage";
import { buildExpense, NOW } from "./factories";

// NOW is 18 Nov 2026. November has 30 days, so $3,000/month is exactly $100/day.
const BUDGET = 300_000;

describe("monthlyInsights", () => {
  it("totals only the current month, largest category first", () => {
    const result = monthlyInsights(
      [
        buildExpense({ date: "2026-11-01", category: "Food", amountCents: 42_000 }),
        buildExpense({ date: "2026-11-18", category: "Transportation", amountCents: 18_000 }),
        buildExpense({ date: "2026-11-05", category: "Entertainment", amountCents: 9_500 }),
        buildExpense({ date: "2026-11-30", category: "Bills", amountCents: 5_000 }),
        buildExpense({ date: "2026-10-31", category: "Shopping", amountCents: 99_900 }),
        buildExpense({ date: "2026-12-01", category: "Shopping", amountCents: 99_900 }),
      ],
      NOW,
    );
    expect(result.month).toBe("2026-11");
    expect(result.totalCents).toBe(74_500);
    expect(result.count).toBe(4);
    expect(result.byCategory.map((c) => c.category)).toEqual(["Food", "Transportation", "Entertainment", "Bills"]);
    expect(result.top.map((c) => c.category)).toEqual(["Food", "Transportation", "Entertainment"]);
    expect(result.byCategory[0].share).toBeCloseTo(42_000 / 74_500);
  });

  it("keeps the fixed category order for ties", () => {
    const result = monthlyInsights(
      [
        buildExpense({ category: "Other", amountCents: 500 }),
        buildExpense({ category: "Bills", amountCents: 500 }),
        buildExpense({ category: "Food", amountCents: 500 }),
      ],
      NOW,
    );
    expect(result.top.map((c) => c.category)).toEqual(["Food", "Bills", "Other"]);
  });

  it("returns fewer than three when fewer categories have spending", () => {
    const result = monthlyInsights([buildExpense({ category: "Food" })], NOW);
    expect(result.top).toHaveLength(1);
  });

  it("is empty when nothing was spent this month", () => {
    const result = monthlyInsights([buildExpense({ date: "2026-10-01" })], NOW);
    expect(result).toMatchObject({ totalCents: 0, count: 0, byCategory: [], top: [] });
  });
});

describe("daysInMonth / dailyAllowanceCents", () => {
  it("handles month lengths and leap years", () => {
    expect(daysInMonth(2026, 10)).toBe(30);
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(daysInMonth(2028, 1)).toBe(29);
  });

  it("floors the allowance to whole cents", () => {
    expect(dailyAllowanceCents(BUDGET, NOW)).toBe(10_000);
    expect(dailyAllowanceCents(100_000, NOW)).toBe(3_333);
  });
});

describe("budgetStreak", () => {
  it("is zero with no expenses", () => {
    expect(budgetStreak([], BUDGET, NOW)).toBe(0);
  });

  it("counts back from today to the earliest expense when every day is under", () => {
    const expenses = [
      buildExpense({ date: "2026-11-07", amountCents: 5_000 }),
      buildExpense({ date: "2026-11-15", amountCents: 9_999 }),
    ];
    expect(budgetStreak(expenses, BUDGET, NOW)).toBe(12); // 7th..18th inclusive
  });

  it("stops at the most recent day over the allowance", () => {
    const expenses = [
      buildExpense({ date: "2026-11-01", amountCents: 100 }),
      buildExpense({ date: "2026-11-10", amountCents: 6_000 }),
      buildExpense({ date: "2026-11-10", amountCents: 4_001 }), // same day, totals $100.01
    ];
    expect(budgetStreak(expenses, BUDGET, NOW)).toBe(8); // 11th..18th
  });

  it("counts a day spent exactly at the allowance", () => {
    expect(budgetStreak([buildExpense({ date: "2026-11-18", amountCents: 10_000 })], BUDGET, NOW)).toBe(1);
  });

  it("is zero when today is already over", () => {
    const expenses = [
      buildExpense({ date: "2026-11-01", amountCents: 100 }),
      buildExpense({ date: "2026-11-18", amountCents: 10_001 }),
    ];
    expect(budgetStreak(expenses, BUDGET, NOW)).toBe(0);
  });

  it("uses each day's own month length across a month boundary", () => {
    // $3,100/month: October (31 days) allows $100/day, November (30 days) $103.33.
    const budget = 310_000;
    const now = new Date(2026, 10, 2, 12);
    const expenses = [
      buildExpense({ date: "2026-10-30", amountCents: 10_001 }), // over October's $100
      buildExpense({ date: "2026-10-31", amountCents: 10_000 }), // exactly October's $100
      buildExpense({ date: "2026-11-01", amountCents: 10_300 }), // under November's $103.33
    ];
    expect(budgetStreak(expenses, budget, now)).toBe(3); // 31 Oct, 1 Nov, 2 Nov
  });

  it("ignores future-dated expenses", () => {
    const expenses = [
      buildExpense({ date: "2026-11-17", amountCents: 100 }),
      buildExpense({ date: "2026-11-19", amountCents: 999_999 }),
    ];
    expect(budgetStreak(expenses, BUDGET, NOW)).toBe(2);
  });

  it("counts each day once across a daylight-saving change", () => {
    // Sydney clocks go forward on 4 Oct 2026.
    const now = new Date(2026, 9, 6, 12);
    expect(budgetStreak([buildExpense({ date: "2026-10-01", amountCents: 100 })], BUDGET, now)).toBe(6);
  });
});

describe("budget storage", () => {
  it("round-trips a saved budget", () => {
    saveBudget(250_000);
    expect(loadBudget()).toBe(250_000);
  });

  it("treats missing, malformed or invalid data as not set", () => {
    expect(parseBudget(null)).toBeNull();
    expect(parseBudget("{not json")).toBeNull();
    expect(parseBudget(JSON.stringify({ version: 2, monthlyBudgetCents: 100 }))).toBeNull();
    expect(parseBudget(JSON.stringify({ version: 1, monthlyBudgetCents: -5 }))).toBeNull();
    expect(parseBudget(JSON.stringify({ version: 1, monthlyBudgetCents: 1.5 }))).toBeNull();
  });

  it("rejects invalid amounts without writing", () => {
    expect(() => saveBudget(0)).toThrow(StorageError);
    expect(window.localStorage.getItem(BUDGET_STORAGE_KEY)).toBeNull();
  });

  it("throws StorageError when storage is unavailable", () => {
    const failing = {
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    } as unknown as Storage;
    expect(() => saveBudget(100, failing)).toThrow(StorageError);
  });
});
