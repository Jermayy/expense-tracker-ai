import { describe, expect, it } from "vitest";
import {
  centsToDecimalString,
  formatCents,
  formatCentsCompact,
  parseAmountToCents,
} from "@/features/expenses/domain/money";

describe("parseAmountToCents", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12.05", 1205],
    ["0.1", 10],
    ["1,234.56", 123456],
    ["$9.99", 999],
    ["  7.00 ", 700],
  ])("parses %s to %i cents", (input, expected) => {
    expect(parseAmountToCents(input)).toBe(expected);
  });

  it("avoids float rounding errors", () => {
    expect(parseAmountToCents("0.29")).toBe(29);
    expect(parseAmountToCents("1.15")).toBe(115);
  });

  it.each(["", "abc", "1.234", "-5", "1e3", "1.2.3", "."])("rejects %s", (input) => {
    expect(parseAmountToCents(input)).toBeNull();
  });
});

describe("formatting", () => {
  it("formats cents as AUD", () => {
    expect(formatCents(123456)).toBe("$1,234.56");
  });

  it("renders a plain decimal string", () => {
    expect(centsToDecimalString(5)).toBe("0.05");
    expect(centsToDecimalString(123400)).toBe("1234.00");
  });
});

describe("formatCentsCompact", () => {
  it.each([
    [61842, "$618"],
    [100000, "$1K"],
    [125000, "$1.25K"],
    [0, "$0"],
  ])("formats %i cents as %s", (cents, expected) => {
    expect(formatCentsCompact(cents)).toBe(expected);
  });
});
