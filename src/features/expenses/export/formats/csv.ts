import { formatMonthLong, monthKey } from "../../domain/dates";
import { financialYearLabel, financialYearOf } from "../../domain/financialYear";
import { CURRENCY, centsToDecimalString } from "../../domain/money";
import { CATEGORIES, type Category, type Expense } from "../../domain/types";
import { escapeCsvCell, expensesToCsv } from "../../lib/csv";
import type { ExportLayout } from "../options";
import { describePeriod } from "./describe";
import type { ExportContext, ExportFormatSpec } from "./types";

// The summary layouts are adapted from V3's export templates: they summarise the records the
// dialog has already filtered instead of choosing their own date range.

const toCsv = (rows: readonly (readonly string[])[]) =>
  rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
const money = centsToDecimalString;

function totalsByCategory(records: readonly Expense[]) {
  const totals = new Map<Category, { count: number; cents: number; max: number }>();
  for (const e of records) {
    const t = totals.get(e.category) ?? { count: 0, cents: 0, max: 0 };
    totals.set(e.category, { count: t.count + 1, cents: t.cents + e.amountCents, max: Math.max(t.max, e.amountCents) });
  }
  return totals;
}

/** `part / whole` as a percentage with one decimal, using integer maths. */
export function shareOf(part: number, whole: number): string {
  if (whole === 0) return "0.0";
  const tenths = Math.round((part * 1000) / whole);
  return `${Math.floor(tenths / 10)}.${tenths % 10}`;
}

/** Every `YYYY-MM` key from `first` to `last` inclusive. */
export function monthKeysBetween(first: string, last: string): string[] {
  const keys: string[] = [];
  let [y, m] = first.split("-").map(Number);
  const [ly, lm] = last.split("-").map(Number);
  while (y < ly || (y === ly && m <= lm)) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

function taxReport({ records, summary, options, generatedAt }: ExportContext): string {
  const fy = options.from && options.to ? financialYearOf({ from: options.from, to: options.to }, generatedAt) : null;
  const totals = totalsByCategory(records);
  return toCsv([
    [`Expense report${fy ? ` ${financialYearLabel(fy)}` : ""}: ${describePeriod(options)}`],
    [],
    ["Date", "Category", `Amount (${CURRENCY})`, "Description"],
    ...records.map((e) => [e.date, e.category, money(e.amountCents), e.description]),
    [],
    ["Category subtotals"],
    ...CATEGORIES.filter((c) => totals.has(c)).map((c) => ["", c, money(totals.get(c)!.cents), ""]),
    ["", "Total", money(summary.totalCents), ""],
  ]);
}

function monthlySummary({ records, summary, options }: ExportContext): string {
  const first = options.from || summary.firstDate;
  const last = options.to || summary.lastDate;
  const keys = first && last ? monthKeysBetween(monthKey(first), monthKey(last)) : [];
  const cell = new Map<string, number>();
  for (const e of records) {
    const k = `${monthKey(e.date)}|${e.category}`;
    cell.set(k, (cell.get(k) ?? 0) + e.amountCents);
  }
  const at = (k: string, c: Category) => cell.get(`${k}|${c}`) ?? 0;
  return toCsv([
    ["Month", ...CATEGORIES, `Total (${CURRENCY})`],
    ...keys.map((k) => [
      formatMonthLong(k),
      ...CATEGORIES.map((c) => money(at(k, c))),
      money(CATEGORIES.reduce((sum, c) => sum + at(k, c), 0)),
    ]),
    ["Total", ...CATEGORIES.map((c) => money(keys.reduce((sum, k) => sum + at(k, c), 0))), money(summary.totalCents)],
  ]);
}

function categoryAnalysis({ records, summary }: ExportContext): string {
  const ranked = [...totalsByCategory(records).entries()].sort((a, b) => b[1].cents - a[1].cents);
  return toCsv([
    [
      "Category",
      "Transactions",
      `Total (${CURRENCY})`,
      `Average (${CURRENCY})`,
      "Share of spend (%)",
      `Largest (${CURRENCY})`,
    ],
    ...ranked.map(([c, t]) => [
      c,
      String(t.count),
      money(t.cents),
      money(Math.round(t.cents / t.count)),
      shareOf(t.cents, summary.totalCents),
      money(t.max),
    ]),
  ]);
}

const LAYOUTS: Record<ExportLayout, (context: ExportContext) => string> = {
  itemised: ({ records }) => expensesToCsv(records),
  "tax-report": taxReport,
  "monthly-summary": monthlySummary,
  "category-analysis": categoryAnalysis,
};

export const csvFormat: ExportFormatSpec = {
  id: "csv",
  label: "CSV",
  description: "Spreadsheets: Excel, Numbers, Google Sheets",
  extension: "csv",
  mimeType: "text/csv;charset=utf-8",
  // The BOM makes Excel read the file as UTF-8.
  encode: (context) => ["﻿", LAYOUTS[context.options.layout](context)],
};
