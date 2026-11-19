import { formatMonthLong, monthKey, recentMonthKeys, toIsoDate } from "@/features/expenses/domain/dates";
import { CURRENCY, centsToDecimalString } from "@/features/expenses/domain/money";
import { CATEGORIES, type Category, type Expense } from "@/features/expenses/domain/types";
import { escapeCsvCell } from "@/features/expenses/lib/csv";

export const TEMPLATE_IDS = ["tax-report", "monthly-summary", "category-analysis", "full-data"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export interface TemplateParams {
  /** Australian financial year, named by the year it ends: FY2026 = 1 Jul 2025 – 30 Jun 2026. */
  financialYear?: number;
  /** Number of months, ending with the current one. */
  months?: number;
  /** Replace descriptions with a placeholder before the file leaves the device. */
  redact?: boolean;
}

export interface ExportArtifact {
  filename: string;
  mimeType: string;
  content: string;
  /** Expenses that went into the file. */
  recordCount: number;
}

export interface ExportTemplate {
  id: TemplateId;
  name: string;
  tagline: string;
  /** Who it's for / what to do with it. */
  useCase: string;
  format: "CSV" | "JSON";
  /** Fields included, shown in the privacy summary. */
  fields: readonly string[];
  includesDescriptions: boolean;
  build: (expenses: readonly Expense[], params: TemplateParams, now: Date) => ExportArtifact;
}

export const REDACTED = "[redacted]";
export const DEFAULT_SUMMARY_MONTHS = 12;

const CSV_MIME = "text/csv;charset=utf-8";

function csv(rows: readonly (readonly string[])[]): string {
  // BOM so Excel reads UTF-8; CRLF per RFC 4180.
  return "﻿" + rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

const description = (e: Expense, params: TemplateParams) => (params.redact ? REDACTED : e.description);
const byDateAsc = (a: Expense, b: Expense) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);

/** The financial year containing `now` (July starts a new one). */
export function currentFinancialYear(now: Date): number {
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

export function financialYearRange(fy: number): { from: string; to: string } {
  return { from: `${fy - 1}-07-01`, to: `${fy}-06-30` };
}

export function financialYearLabel(fy: number): string {
  return `FY${fy - 1}–${String(fy).slice(2)}`;
}

function totalsByCategory(expenses: readonly Expense[]): Map<Category, { count: number; cents: number; max: number }> {
  const totals = new Map<Category, { count: number; cents: number; max: number }>();
  for (const e of expenses) {
    const t = totals.get(e.category) ?? { count: 0, cents: 0, max: 0 };
    totals.set(e.category, { count: t.count + 1, cents: t.cents + e.amountCents, max: Math.max(t.max, e.amountCents) });
  }
  return totals;
}

const taxReport: ExportTemplate = {
  id: "tax-report",
  name: "Tax report",
  tagline: "Every expense in a financial year, with category subtotals",
  useCase: "Hand to your accountant at tax time",
  format: "CSV",
  fields: ["Date", "Category", "Description", "Amount"],
  includesDescriptions: true,
  build(expenses, params, now) {
    const fy = params.financialYear ?? currentFinancialYear(now);
    const { from, to } = financialYearRange(fy);
    const rows = expenses.filter((e) => e.date >= from && e.date <= to).sort(byDateAsc);
    const totals = totalsByCategory(rows);
    const grand = rows.reduce((sum, e) => sum + e.amountCents, 0);
    const content = csv([
      [`Expense report ${financialYearLabel(fy)} (${from} to ${to})`],
      [],
      ["Date", "Category", "Description", `Amount (${CURRENCY})`],
      ...rows.map((e) => [e.date, e.category, description(e, params), centsToDecimalString(e.amountCents)]),
      [],
      ["Category subtotals"],
      ...CATEGORIES.filter((c) => totals.has(c)).map((c) => ["", c, "", centsToDecimalString(totals.get(c)!.cents)]),
      ["", "Total", "", centsToDecimalString(grand)],
    ]);
    return { filename: `spendwise-tax-report-fy${fy}.csv`, mimeType: CSV_MIME, content, recordCount: rows.length };
  },
};

const monthlySummary: ExportTemplate = {
  id: "monthly-summary",
  name: "Monthly summary",
  tagline: "Spend per month, broken down by category",
  useCase: "Budget reviews and spotting trends",
  format: "CSV",
  fields: ["Month", "Category totals"],
  includesDescriptions: false,
  build(expenses, params, now) {
    const keys = recentMonthKeys(now, params.months ?? DEFAULT_SUMMARY_MONTHS);
    const inRange = expenses.filter((e) => keys.includes(monthKey(e.date)));
    const cell = new Map<string, number>();
    for (const e of inRange) {
      const k = `${monthKey(e.date)}|${e.category}`;
      cell.set(k, (cell.get(k) ?? 0) + e.amountCents);
    }
    const monthTotal = (k: string) => CATEGORIES.reduce((sum, c) => sum + (cell.get(`${k}|${c}`) ?? 0), 0);
    const categoryTotal = (c: Category) => keys.reduce((sum, k) => sum + (cell.get(`${k}|${c}`) ?? 0), 0);
    const content = csv([
      ["Month", ...CATEGORIES, `Total (${CURRENCY})`],
      ...keys.map((k) => [
        formatMonthLong(k),
        ...CATEGORIES.map((c) => centsToDecimalString(cell.get(`${k}|${c}`) ?? 0)),
        centsToDecimalString(monthTotal(k)),
      ]),
      [
        "Total",
        ...CATEGORIES.map((c) => centsToDecimalString(categoryTotal(c))),
        centsToDecimalString(keys.reduce((s, k) => s + monthTotal(k), 0)),
      ],
    ]);
    return {
      filename: `spendwise-monthly-summary-${keys[0]}-to-${keys[keys.length - 1]}.csv`,
      mimeType: CSV_MIME,
      content,
      recordCount: inRange.length,
    };
  },
};

/** `part / whole` as a percentage with one decimal, using integer maths. */
export function shareOf(part: number, whole: number): string {
  if (whole === 0) return "0.0";
  const tenths = Math.round((part * 1000) / whole);
  return `${Math.floor(tenths / 10)}.${tenths % 10}`;
}

const categoryAnalysis: ExportTemplate = {
  id: "category-analysis",
  name: "Category analysis",
  tagline: "Totals, averages and share of spend per category",
  useCase: "Find where to cut back",
  format: "CSV",
  fields: ["Category", "Count", "Total", "Average", "Share", "Largest"],
  includesDescriptions: false,
  build(expenses) {
    const totals = totalsByCategory(expenses);
    const grand = expenses.reduce((sum, e) => sum + e.amountCents, 0);
    const ranked = [...totals.entries()].sort((a, b) => b[1].cents - a[1].cents);
    const content = csv([
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
        centsToDecimalString(t.cents),
        centsToDecimalString(Math.round(t.cents / t.count)),
        shareOf(t.cents, grand),
        centsToDecimalString(t.max),
      ]),
    ]);
    return { filename: "spendwise-category-analysis.csv", mimeType: CSV_MIME, content, recordCount: expenses.length };
  },
};

export const FULL_DATA_VERSION = 1;

const fullData: ExportTemplate = {
  id: "full-data",
  name: "Full data",
  tagline: "Every expense with all fields, as structured JSON",
  useCase: "Backups and moving data to other tools",
  format: "JSON",
  fields: ["ID", "Date", "Category", "Description", "Amount (cents)", "Timestamps"],
  includesDescriptions: true,
  build(expenses, params, now) {
    const content = JSON.stringify(
      {
        version: FULL_DATA_VERSION,
        exportedAt: now.toISOString(),
        currency: CURRENCY,
        redacted: Boolean(params.redact),
        expenses: [...expenses].sort(byDateAsc).map((e) => ({ ...e, description: description(e, params) })),
      },
      null,
      2,
    );
    return {
      filename: `spendwise-data-${toIsoDate(now)}.json`,
      mimeType: "application/json",
      content,
      recordCount: expenses.length,
    };
  },
};

export const TEMPLATES: Record<TemplateId, ExportTemplate> = {
  "tax-report": taxReport,
  "monthly-summary": monthlySummary,
  "category-analysis": categoryAnalysis,
  "full-data": fullData,
};

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === "string" && (TEMPLATE_IDS as readonly string[]).includes(value);
}
