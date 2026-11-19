import { describe, expect, it, vi } from "vitest";
import { defaultExportOptions } from "@/features/expenses/export/options";
import { buildExportFile, ExportValidationError, runExport } from "@/features/expenses/export/runExport";
import { buildExpense, NOW } from "./factories";

const expenses = [buildExpense({ category: "Food" }), buildExpense({ category: "Bills" })];

describe("buildExportFile", () => {
  it("adds the format's extension to the cleaned-up name", () => {
    const file = buildExportFile(
      expenses,
      { ...defaultExportOptions(NOW), format: "json", filename: " Q4: report.json " },
      NOW,
    );
    expect(file).toMatchObject({ filename: "Q4 report.json", mimeType: "application/json" });
    expect(file.summary.count).toBe(2);
  });

  it("refuses invalid options", () => {
    expect(() => buildExportFile(expenses, { ...defaultExportOptions(NOW), categories: [] }, NOW)).toThrow(
      new ExportValidationError("Select at least one category."),
    );
  });
});

describe("runExport", () => {
  it("downloads only the matching records", async () => {
    const download = vi.fn();
    const options = { ...defaultExportOptions(NOW), format: "json" as const, categories: ["Bills" as const] };
    const file = await runExport(expenses, options, { now: () => NOW, download });

    expect(download).toHaveBeenCalledWith(file.parts, "application/json", "expenses-2026-11-18.json");
    expect(JSON.parse(String(file.parts[0])).expenses).toHaveLength(1);
  });

  it("propagates download failures", async () => {
    const download = vi.fn(() => {
      throw new Error("blocked");
    });
    await expect(runExport(expenses, defaultExportOptions(NOW), { now: () => NOW, download })).rejects.toThrow(
      "blocked",
    );
  });
});
