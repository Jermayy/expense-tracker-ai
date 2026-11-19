import { describe, expect, it, vi } from "vitest";
import { defaultExportOptions } from "@/features/expenses/export/options";
import {
  buildExportFile,
  ExportValidationError,
  isShareCancelled,
  runExport,
  shareExport,
} from "@/features/expenses/export/runExport";
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

describe("redaction", () => {
  const secret = [buildExpense({ description: "Secret gift" })];
  const text = async (format: "csv" | "json" | "pdf", redact: boolean) => {
    const file = buildExportFile(secret, { ...defaultExportOptions(NOW), format, redact }, NOW);
    return new Blob(file.parts).text();
  };

  it.each(["csv", "json"] as const)("removes descriptions from %s", async (format) => {
    expect(await text(format, false)).toContain("Secret gift");
    const redacted = await text(format, true);
    expect(redacted).not.toContain("Secret gift");
    expect(redacted).toContain("[redacted]");
  });

  it("removes descriptions from the PDF", async () => {
    // PDF text is hex-encoded, so compare the encoded form of the description.
    const hex = (t: string) => Array.from(t, (c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    expect(await text("pdf", false)).toContain(hex("Secret gift"));
    expect(await text("pdf", true)).not.toContain(hex("Secret gift"));
  });

  it("flags redaction in JSON", async () => {
    expect(JSON.parse(await text("json", true)).redacted).toBe(true);
  });
});

describe("shareExport", () => {
  it("hands the built file to the share sheet", async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>(async () => {});
    const file = await shareExport(
      expenses,
      { ...defaultExportOptions(NOW), format: "json" },
      { now: () => NOW, share },
    );
    const data = share.mock.calls[0][0];
    expect(data.files?.[0].name).toBe("expenses-2026-11-18.json");
    expect(data.files?.[0].type).toBe("application/json");
    expect(file.summary.count).toBe(2);
  });

  it("tells a cancelled share apart from a failure", () => {
    expect(isShareCancelled(new DOMException("closed", "AbortError"))).toBe(true);
    expect(isShareCancelled(new DOMException("blocked", "NotAllowedError"))).toBe(false);
    expect(isShareCancelled(new Error("x"))).toBe(false);
  });
});
