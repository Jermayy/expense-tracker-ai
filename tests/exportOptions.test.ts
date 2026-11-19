import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/features/expenses/domain/types";
import {
  activePreset,
  defaultExportOptions,
  fileFields,
  includesDescriptions,
  suggestedFilename,
  presetRange,
  sanitizeFilename,
  selectExportRecords,
  summarizeExport,
  validateExportOptions,
} from "@/features/expenses/export/options";
import { buildExpense, NOW } from "./factories";

describe("defaultExportOptions", () => {
  it("selects every category and names the file after today", () => {
    expect(defaultExportOptions(NOW)).toEqual({
      format: "csv",
      from: "",
      to: "",
      layout: "itemised",
      redact: false,
      categories: [...CATEGORIES],
      filename: "expenses-2026-11-18",
    });
  });

  it("takes a pre-filled range and categories in canonical order", () => {
    const options = defaultExportOptions(NOW, { from: "2026-11-01", categories: ["Other", "Food"] });
    expect(options.from).toBe("2026-11-01");
    expect(options.categories).toEqual(["Food", "Other"]);
  });
});

describe("date presets", () => {
  it.each([
    ["all", "", ""],
    ["this-month", "2026-11-01", "2026-11-18"],
    ["last-30", "2026-10-20", "2026-11-18"],
    ["this-year", "2026-01-01", "2026-11-18"],
    ["this-fy", "2026-07-01", "2026-11-18"],
    ["last-fy", "2025-07-01", "2026-06-30"],
  ] as const)("%s covers %s to %s", (preset, from, to) => {
    expect(presetRange(preset, NOW)).toEqual({ from, to });
  });

  it("recognises the preset a range matches, or none", () => {
    expect(activePreset({ from: "2026-11-01", to: "2026-11-18" }, NOW)).toBe("this-month");
    expect(activePreset({ from: "2026-11-02", to: "2026-11-18" }, NOW)).toBeNull();
  });
});

describe("sanitizeFilename", () => {
  it.each([
    ["  my report  ", "my report"],
    ['a/b\\c:d*e?f"g<h>i|j', "abcdefghij"],
    ["report.csv", "report"],
    ["report.CSV", "report"],
    ["..hidden..", "hidden"],
    ["tab\there", "tab here"],
    ["///", ""],
  ])("%j becomes %j", (input, expected) => {
    expect(sanitizeFilename(input, "csv")).toBe(expected);
  });

  it("only strips the extension of the chosen format", () => {
    expect(sanitizeFilename("report.csv", "json")).toBe("report.csv");
  });

  it("caps the length", () => {
    expect(sanitizeFilename("x".repeat(200), "csv")).toHaveLength(80);
  });
});

describe("validateExportOptions", () => {
  const valid = defaultExportOptions(NOW);

  it("accepts the defaults", () => {
    expect(validateExportOptions(valid)).toEqual({});
  });

  it("rejects a reversed range, no categories and an empty name", () => {
    expect(
      validateExportOptions({ ...valid, from: "2026-11-10", to: "2026-11-01", categories: [], filename: " / " }),
    ).toEqual({
      to: "End date must be on or after the start date.",
      categories: "Select at least one category.",
      filename: "Enter a file name.",
    });
  });

  it("rejects impossible dates", () => {
    expect(validateExportOptions({ ...valid, from: "2026-02-30" }).from).toBe("Enter a valid start date.");
  });
});

describe("selectExportRecords", () => {
  const expenses = [
    buildExpense({ date: "2026-11-05", category: "Food", amountCents: 500 }),
    buildExpense({ date: "2026-10-01", category: "Bills", amountCents: 9000 }),
    buildExpense({ date: "2026-11-01", category: "Bills", amountCents: 1200 }),
    buildExpense({ date: "2026-11-20", category: "Food", amountCents: 300 }),
  ];

  it("filters by inclusive date range and category, oldest first", () => {
    const options = {
      ...defaultExportOptions(NOW),
      from: "2026-11-01",
      to: "2026-11-05",
      categories: ["Bills" as const],
    };
    expect(selectExportRecords(expenses, options).map((e) => e.date)).toEqual(["2026-11-01"]);
  });

  it("returns everything, oldest first, with default options", () => {
    expect(selectExportRecords(expenses, defaultExportOptions(NOW)).map((e) => e.date)).toEqual([
      "2026-10-01",
      "2026-11-01",
      "2026-11-05",
      "2026-11-20",
    ]);
  });

  it("returns nothing when no category is selected", () => {
    expect(selectExportRecords(expenses, { ...defaultExportOptions(NOW), categories: [] })).toEqual([]);
  });
});

describe("summarizeExport", () => {
  it("counts, totals and reports the span", () => {
    const records = [
      buildExpense({ date: "2026-10-01", amountCents: 150 }),
      buildExpense({ date: "2026-11-02", amountCents: 250 }),
    ];
    expect(summarizeExport(records)).toEqual({
      count: 2,
      totalCents: 400,
      firstDate: "2026-10-01",
      lastDate: "2026-11-02",
    });
  });

  it("handles no records", () => {
    expect(summarizeExport([])).toEqual({ count: 0, totalCents: 0, firstDate: null, lastDate: null });
  });
});

describe("suggestedFilename", () => {
  const base = defaultExportOptions(NOW);

  it("names the file after the layout and today", () => {
    expect(suggestedFilename({ ...base, layout: "monthly-summary" }, NOW)).toBe("monthly-summary-2026-11-18");
  });

  it("uses the financial year when the range is one", () => {
    expect(suggestedFilename({ ...base, layout: "tax-report", ...presetRange("last-fy", NOW) }, NOW)).toBe(
      "tax-report-fy2026",
    );
    expect(suggestedFilename({ ...base, ...presetRange("this-fy", NOW) }, NOW)).toBe("expenses-fy2027");
  });

  it("ignores the layout for formats that are always itemised", () => {
    expect(suggestedFilename({ ...base, format: "pdf", layout: "category-analysis" }, NOW)).toBe("expenses-2026-11-18");
  });
});

describe("fileFields", () => {
  const base = defaultExportOptions(NOW);

  it("lists what each format and layout contains", () => {
    expect(fileFields(base)).toEqual(["Date", "Category", "Amount", "Description"]);
    expect(fileFields({ ...base, layout: "monthly-summary" })).toEqual(["Month", "Category totals"]);
    expect(fileFields({ ...base, format: "json", layout: "monthly-summary" })).toContain("Description");
  });

  it("only offers redaction when descriptions are in the file", () => {
    expect(includesDescriptions({ ...base, layout: "tax-report" })).toBe(true);
    expect(includesDescriptions({ ...base, layout: "category-analysis" })).toBe(false);
    expect(includesDescriptions({ ...base, format: "pdf" })).toBe(true);
  });
});
