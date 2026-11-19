import { describe, expect, it } from "vitest";
import {
  REDACTED,
  TEMPLATES,
  currentFinancialYear,
  financialYearLabel,
  shareOf,
} from "@/features/exports/domain/templates";
import { buildExpense, NOW } from "./factories";

const rows = (content: string) => content.replace(/^﻿/, "").split("\r\n");

describe("financial year", () => {
  it.each([
    [new Date(2026, 5, 30), 2026],
    [new Date(2026, 6, 1), 2027],
    [NOW, 2027],
  ])("%s falls in FY%i", (date, fy) => {
    expect(currentFinancialYear(date)).toBe(fy);
  });

  it("labels years the Australian way", () => {
    expect(financialYearLabel(2026)).toBe("FY2025–26");
  });
});

describe("tax report", () => {
  const expenses = [
    buildExpense({ date: "2025-06-30", category: "Bills", amountCents: 999, description: "Before FY" }),
    buildExpense({ date: "2025-07-01", category: "Bills", amountCents: 10000, description: "Power" }),
    buildExpense({ date: "2026-06-30", category: "Food", amountCents: 1250, description: "Lunch, team" }),
    buildExpense({ date: "2026-07-01", category: "Food", amountCents: 500, description: "After FY" }),
  ];

  it("includes only the financial year, with subtotals and a total", () => {
    const artifact = TEMPLATES["tax-report"].build(expenses, { financialYear: 2026 }, NOW);
    expect(artifact).toMatchObject({ filename: "spendwise-tax-report-fy2026.csv", recordCount: 2 });
    expect(rows(artifact.content)).toEqual([
      "Expense report FY2025–26 (2025-07-01 to 2026-06-30)",
      "",
      "Date,Category,Description,Amount (AUD)",
      "2025-07-01,Bills,Power,100.00",
      '2026-06-30,Food,"Lunch, team",12.50',
      "",
      "Category subtotals",
      ",Food,,12.50",
      ",Bills,,100.00",
      ",Total,,112.50",
    ]);
  });

  it("redacts descriptions on request", () => {
    const { content } = TEMPLATES["tax-report"].build(expenses, { financialYear: 2026, redact: true }, NOW);
    expect(content).not.toContain("Power");
    expect(content).toContain(`2025-07-01,Bills,${REDACTED},100.00`);
  });
});

describe("monthly summary", () => {
  it("pivots months by category, oldest first, with totals", () => {
    const expenses = [
      buildExpense({ date: "2026-10-03", category: "Food", amountCents: 1000 }),
      buildExpense({ date: "2026-10-20", category: "Food", amountCents: 250 }),
      buildExpense({ date: "2026-11-01", category: "Other", amountCents: 700 }),
      buildExpense({ date: "2026-08-31", category: "Food", amountCents: 9999 }),
    ];
    const artifact = TEMPLATES["monthly-summary"].build(expenses, { months: 2 }, NOW);
    expect(artifact).toMatchObject({ filename: "spendwise-monthly-summary-2026-10-to-2026-11.csv", recordCount: 3 });
    expect(rows(artifact.content)).toEqual([
      "Month,Food,Transportation,Entertainment,Shopping,Bills,Other,Total (AUD)",
      "October 2026,12.50,0.00,0.00,0.00,0.00,0.00,12.50",
      "November 2026,0.00,0.00,0.00,0.00,0.00,7.00,7.00",
      "Total,12.50,0.00,0.00,0.00,0.00,7.00,19.50",
    ]);
  });
});

describe("category analysis", () => {
  it("ranks categories by spend with averages and shares", () => {
    const expenses = [
      buildExpense({ category: "Food", amountCents: 1000 }),
      buildExpense({ category: "Food", amountCents: 2001 }),
      buildExpense({ category: "Bills", amountCents: 6000 }),
    ];
    expect(rows(TEMPLATES["category-analysis"].build(expenses, {}, NOW).content)).toEqual([
      "Category,Transactions,Total (AUD),Average (AUD),Share of spend (%),Largest (AUD)",
      "Bills,1,60.00,60.00,66.7,60.00",
      "Food,2,30.01,15.01,33.3,20.01",
    ]);
  });

  it("computes shares with integer maths", () => {
    expect(shareOf(1, 3)).toBe("33.3");
    expect(shareOf(0, 0)).toBe("0.0");
    expect(shareOf(5, 5)).toBe("100.0");
  });
});

describe("full data", () => {
  it("writes every field, oldest first, and records redaction", () => {
    const a = buildExpense({ date: "2026-11-02", description: "Secret" });
    const b = buildExpense({ date: "2026-11-01" });
    const doc = JSON.parse(TEMPLATES["full-data"].build([a, b], { redact: true }, NOW).content);
    expect(doc).toMatchObject({ version: 1, exportedAt: NOW.toISOString(), currency: "AUD", redacted: true });
    expect(doc.expenses.map((e: { id: string }) => e.id)).toEqual([b.id, a.id]);
    expect(doc.expenses[1]).toEqual({ ...a, description: REDACTED });
  });
});
