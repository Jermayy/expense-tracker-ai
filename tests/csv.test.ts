import { describe, expect, it } from "vitest";
import { escapeCsvCell, expensesToCsv } from "@/features/expenses/lib/csv";
import { buildExpense } from "./factories";

describe("expensesToCsv", () => {
  it("writes a header and one row per expense", () => {
    const csv = expensesToCsv([
      buildExpense({ date: "2026-11-01", description: "Lunch", category: "Food", amountCents: 1250 }),
    ]);
    expect(csv).toBe("Date,Description,Category,Amount (AUD)\r\n2026-11-01,Lunch,Food,12.50");
  });
});

describe("escapeCsvCell", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(escapeCsvCell('Dinner, "fancy"')).toBe('"Dinner, ""fancy"""');
    expect(escapeCsvCell("a\nb")).toBe('"a\nb"');
  });

  it.each(["=SUM(A1)", "+1", "-1", "@cmd"])("neutralises formula injection in %s", (value) => {
    expect(escapeCsvCell(value).startsWith("'")).toBe(true);
  });
});
