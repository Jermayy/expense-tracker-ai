import { describe, expect, it } from "vitest";
import {
  currentFinancialYear,
  financialYearLabel,
  financialYearOf,
  financialYearRange,
  financialYearToDate,
} from "@/features/expenses/domain/financialYear";
import { NOW } from "./factories";

describe("financial year", () => {
  it.each([
    [new Date(2026, 5, 30), 2026],
    [new Date(2026, 6, 1), 2027],
    [NOW, 2027],
  ])("%s falls in FY%i", (date, fy) => {
    expect(currentFinancialYear(date)).toBe(fy);
  });

  it("runs 1 July to 30 June and is labelled the Australian way", () => {
    expect(financialYearRange(2026)).toEqual({ from: "2025-07-01", to: "2026-06-30" });
    expect(financialYearLabel(2026)).toBe("FY2025–26");
  });

  it("stops the current year at today", () => {
    expect(financialYearToDate(2027, NOW)).toEqual({ from: "2026-07-01", to: "2026-11-18" });
    expect(financialYearToDate(2026, NOW)).toEqual({ from: "2025-07-01", to: "2026-06-30" });
  });

  it("recognises a range that is exactly a financial year", () => {
    expect(financialYearOf({ from: "2025-07-01", to: "2026-06-30" }, NOW)).toBe(2026);
    expect(financialYearOf({ from: "2026-07-01", to: "2026-11-18" }, NOW)).toBe(2027);
    expect(financialYearOf({ from: "2025-07-02", to: "2026-06-30" }, NOW)).toBeNull();
    expect(financialYearOf({ from: "2025-07-01", to: "2026-03-31" }, NOW)).toBeNull();
  });
});
