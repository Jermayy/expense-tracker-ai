import { describe, expect, it } from "vitest";
import type { Expense } from "@/features/expenses/domain/types";
import { FORMAT_SPECS, type ExportContext } from "@/features/expenses/export/formats";
import { encodeWinAnsi, textWidth, truncateToWidth } from "@/features/expenses/export/formats/pdfDocument";
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

const latin1 = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join("");

/** Minimal PDF reader for assertions: checks the xref table and pulls out drawn text. */
function inspectPdf(bytes: Uint8Array) {
  const source = latin1(bytes);
  const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(source)?.[1]);
  const xref = source.slice(startxref);
  const offsets = [...xref.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  offsets.forEach((offset, i) => expect(source.startsWith(`${i + 1} 0 obj\n`, offset)).toBe(true));

  const text = [...source.matchAll(/<([0-9a-f]+)> Tj/g)].map((m) =>
    m[1]
      .match(/../g)!
      .map((h) => String.fromCharCode(parseInt(h, 16)))
      .join(""),
  );
  return {
    source,
    pageCount: Number(/\/Type \/Pages \/Kids \[[^\]]*\] \/Count (\d+)/.exec(source)?.[1]),
    text,
  };
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
      'Date,Description,Category,Amount (AUD)\r\n2026-11-01,"Lunch, with ""friends""",Food,12.50\r\n2026-11-03,Electricity,Bills,1234.56',
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

describe("PDF format", () => {
  it("produces a well-formed single-page report with totals", async () => {
    const pdf = inspectPdf(
      await bytesOf(FORMAT_SPECS.pdf.encode(context(sample, { from: "2026-11-01", to: "2026-11-30" }))),
    );
    expect(pdf.source.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.pageCount).toBe(1);
    expect(pdf.text).toEqual(
      expect.arrayContaining([
        "Expense report",
        "Period: 1 Nov 2026 \x96 30 Nov 2026", // en dash as its WinAnsi byte
        "Categories: All categories",
        "2",
        'Lunch, with "friends"',
        "$1,234.56",
        "Total",
        "$1,247.06",
        "Page 1 of 1",
      ]),
    );
  });

  it("paginates long reports and numbers every page", async () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      buildExpense({ date: `2026-${String((i % 12) + 1).padStart(2, "0")}-01`, description: `Item ${i}` }),
    );
    const pdf = inspectPdf(await bytesOf(FORMAT_SPECS.pdf.encode(context(many))));
    expect(pdf.pageCount).toBeGreaterThan(2);
    expect(pdf.text).toContain(`Page ${pdf.pageCount} of ${pdf.pageCount}`);
    // The table header repeats on every page.
    expect(pdf.text.filter((t) => t === "DESCRIPTION")).toHaveLength(pdf.pageCount);
    expect(pdf.text.filter((t) => t.startsWith("Item "))).toHaveLength(120);
  });

  it("says so when there is nothing to list", async () => {
    const pdf = inspectPdf(await bytesOf(FORMAT_SPECS.pdf.encode(context([]))));
    expect(pdf.text).toContain("No expenses match the selected filters.");
  });

  it("truncates long descriptions to fit the column", async () => {
    const long = buildExpense({ description: "W".repeat(200) });
    const pdf = inspectPdf(await bytesOf(FORMAT_SPECS.pdf.encode(context([long]))));
    const drawn = pdf.text.find((t) => t.startsWith("WWW"))!;
    expect(drawn.length).toBeLessThan(200);
    expect(drawn.endsWith("\x85")).toBe(true); // WinAnsi ellipsis
  });
});

describe("PDF text helpers", () => {
  it("maps typographic punctuation to WinAnsi and the rest to ?", () => {
    expect(encodeWinAnsi("Café – “ok” €5 🍕 am")).toEqual([
      0x43, 0x61, 0x66, 0xe9, 0x20, 0x96, 0x20, 0x93, 0x6f, 0x6b, 0x94, 0x20, 0x80, 0x35, 0x20, 0x3f, 0x20, 0x61, 0x6d,
    ]);
  });

  it("measures with Helvetica metrics", () => {
    expect(textWidth("ii", 10)).toBeCloseTo(4.44);
    expect(textWidth("WW", 10)).toBeCloseTo(18.88);
  });

  it("leaves short text alone and fits long text within the width", () => {
    expect(truncateToWidth("Lunch", 9, 100)).toBe("Lunch");
    const cut = truncateToWidth("A fairly long description of a purchase", 9, 60);
    expect(cut.endsWith("…")).toBe(true);
    expect(textWidth(cut, 9)).toBeLessThanOrEqual(60);
  });
});
