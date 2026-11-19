import { describe, expect, it } from "vitest";
import type { Expense } from "@/features/expenses/domain/types";
import { FORMAT_SPECS, type ExportContext } from "@/features/expenses/export/formats";
import { defaultExportOptions, summarizeExport, type ExportOptions } from "@/features/expenses/export/options";
import { buildExpense, NOW } from "./factories";

function context(records: Expense[], options: Partial<ExportOptions> = {}): ExportContext {
  return {
    records,
    summary: summarizeExport(records),
    options: { ...defaultExportOptions(NOW), ...options },
    generatedAt: NOW,
  };
}

async function bytesOf(parts: BlobPart[]): Promise<Uint8Array> {
  return new Uint8Array(await new Blob(parts).arrayBuffer());
}

const sample = [
  buildExpense({
    id: "a",
    date: "2026-11-01",
    category: "Food",
    amountCents: 1250,
    description: 'Lunch, with "friends"',
  }),
  buildExpense({ id: "b", date: "2026-11-03", category: "Bills", amountCents: 123456, description: "Electricity" }),
];

describe("CSV format", () => {
  it("writes a BOM then RFC 4180 rows", async () => {
    const bytes = await bytesOf(FORMAT_SPECS.csv.encode(context(sample)));
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toBe(
      'Date,Category,Amount (AUD),Description\r\n2026-11-01,Food,12.50,"Lunch, with ""friends"""\r\n2026-11-03,Bills,1234.56,Electricity',
    );
  });
});

describe("JSON format", () => {
  it("includes filters, summary and exact integer amounts", async () => {
    const parts = FORMAT_SPECS.json.encode(context(sample, { from: "2026-11-01", categories: ["Food", "Bills"] }));
    const doc = JSON.parse(new TextDecoder().decode(await bytesOf(parts)));
    expect(doc).toMatchObject({
      version: 1,
      generatedAt: NOW.toISOString(),
      currency: "AUD",
      filters: { from: "2026-11-01", to: null, categories: ["Food", "Bills"] },
      summary: { count: 2, totalCents: 124706, total: "1247.06" },
    });
    expect(doc.expenses[1]).toEqual({
      id: "b",
      date: "2026-11-03",
      category: "Bills",
      description: "Electricity",
      amountCents: 123456,
      amount: "1234.56",
      createdAt: sample[1].createdAt,
      updatedAt: sample[1].updatedAt,
    });
  });

  it("writes null for an unfiltered category list", async () => {
    const doc = JSON.parse(new TextDecoder().decode(await bytesOf(FORMAT_SPECS.json.encode(context(sample)))));
    expect(doc.filters.categories).toBeNull();
  });
});
