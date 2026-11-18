import { describe, expect, it } from "vitest";
import { isIsoDate, recentMonthKeys, toIsoDate } from "@/features/expenses/domain/dates";

describe("isIsoDate", () => {
  it("accepts real dates", () => {
    expect(isIsoDate("2024-02-29")).toBe(true);
  });

  it.each(["2025-02-29", "2025-13-01", "2025-1-01", "20250101", "", null, 20250101])("rejects %s", (value) => {
    expect(isIsoDate(value)).toBe(false);
  });
});

describe("recentMonthKeys", () => {
  it("spans the year boundary, oldest first", () => {
    expect(recentMonthKeys(new Date(2026, 1, 15), 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("handles month-end dates without skipping months", () => {
    expect(recentMonthKeys(new Date(2026, 2, 31), 2)).toEqual(["2026-02", "2026-03"]);
  });
});

it("toIsoDate uses the local calendar date", () => {
  expect(toIsoDate(new Date(2026, 0, 1, 0, 30))).toBe("2026-01-01");
});
