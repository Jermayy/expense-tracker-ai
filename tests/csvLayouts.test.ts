import { describe, expect, it } from "vitest";
import type { Expense } from "@/features/expenses/domain/types";
import { FORMAT_SPECS } from "@/features/expenses/export/formats";
import { monthKeysBetween, shareOf } from "@/features/expenses/export/formats/csv";
import {
  defaultExportOptions,
  presetRange,
  selectExportRecords,
  summarizeExport,
  type ExportOptions,
} from "@/features/expenses/export/options";
import { buildExpense, NOW } from "./factories";

/** Run the CSV encoder the way the dialog does: filter first, then lay out. */
function csvRows(expenses: Expense[], patch: Partial<ExportOptions>): string[] {
  const options = { ...defaultExportOptions(NOW), ...patch };
  const records = selectExportRecords(expenses, options);
  const parts = FORMAT_SPECS.csv.encode({ records, summary: summarizeExport(records), options, generatedAt: NOW });
  return (parts.join("") as string).replace(/^﻿/, "").split("\r\n");
}

describe("tax report layout", () => {
  const expenses = [
    buildExpense({ date: "2025-06-30", category: "Bills", amountCents: 999, description: "Before FY" }),
    buildExpense({ date: "2025-07-01", category: "Bills", amountCents: 10000, description: "Power" }),
    buildExpense({ date: "2026-06-30", category: "Food", amountCents: 1250, description: "Lunch, team" }),
    buildExpense({ date: "2026-07-01", category: "Food", amountCents: 500, description: "After FY" }),
  ];

  it("lists the financial year's expenses with category subtotals and a total", () => {
    expect(csvRows(expenses, { layout: "tax-report", ...presetRange("last-fy", NOW) })).toEqual([
      "Expense report FY2025–26: 1 July 2025 – 30 June 2026",
      "",
      "Date,Category,Amount (AUD),Description",
      "2025-07-01,Bills,100.00,Power",
      '2026-06-30,Food,12.50,"Lunch, team"',
      "",
      "Category subtotals",
      ",Food,12.50,",
      ",Bills,100.00,",
      ",Total,112.50,",
    ]);
  });

  it("describes a custom period when it isn't a financial year", () => {
    expect(csvRows(expenses, { layout: "tax-report", from: "2026-06-01" })[0]).toBe("Expense report: From 1 June 2026");
  });
});

describe("monthly summary layout", () => {
  it("has a row for every month in the range, including empty ones", () => {
    const expenses = [
      buildExpense({ date: "2026-08-03", category: "Food", amountCents: 1000 }),
      buildExpense({ date: "2026-08-20", category: "Food", amountCents: 250 }),
      buildExpense({ date: "2026-10-01", category: "Other", amountCents: 700 }),
    ];
    expect(csvRows(expenses, { layout: "monthly-summary" })).toEqual([
      "Month,Food,Transportation,Entertainment,Shopping,Bills,Other,Total (AUD)",
      "August 2026,12.50,0.00,0.00,0.00,0.00,0.00,12.50",
      "September 2026,0.00,0.00,0.00,0.00,0.00,0.00,0.00",
      "October 2026,0.00,0.00,0.00,0.00,0.00,7.00,7.00",
      "Total,12.50,0.00,0.00,0.00,0.00,7.00,19.50",
    ]);
  });

  it("spans the chosen dates rather than just the records", () => {
    const rows = csvRows([buildExpense({ date: "2026-11-02" })], {
      layout: "monthly-summary",
      ...presetRange("this-fy", NOW),
    });
    expect(rows.slice(1, -1).map((r) => r.split(",")[0])).toEqual([
      "July 2026",
      "August 2026",
      "September 2026",
      "October 2026",
      "November 2026",
    ]);
  });

  it("lists month keys across a year boundary", () => {
    expect(monthKeysBetween("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("category analysis layout", () => {
  it("ranks categories by spend, honouring the category filter", () => {
    const expenses = [
      buildExpense({ category: "Food", amountCents: 1000 }),
      buildExpense({ category: "Food", amountCents: 2001 }),
      buildExpense({ category: "Bills", amountCents: 6000 }),
      buildExpense({ category: "Other", amountCents: 50000 }),
    ];
    expect(csvRows(expenses, { layout: "category-analysis", categories: ["Food", "Bills"] })).toEqual([
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
