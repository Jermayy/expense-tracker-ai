import { isIsoDate, toIsoDate } from "../domain/dates";
import { currentFinancialYear, financialYearRange, financialYearToDate } from "../domain/financialYear";
import { CATEGORIES, type Category, type Expense, type IsoDate } from "../domain/types";
import { applyFilters, DEFAULT_FILTERS } from "../lib/filters";

export const EXPORT_FORMATS = ["csv", "json", "pdf"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** How a CSV is laid out. JSON and PDF are always itemised. */
export const EXPORT_LAYOUTS = {
  itemised: { label: "Itemised", description: "One row per expense" },
  "tax-report": { label: "Tax report", description: "Itemised, plus category subtotals and a total" },
  "monthly-summary": { label: "Monthly summary", description: "Spend per month, by category" },
  "category-analysis": { label: "Category analysis", description: "Totals, averages and share per category" },
} as const;
export type ExportLayout = keyof typeof EXPORT_LAYOUTS;

/** Layouts that list individual expenses (and so include descriptions). */
export function isItemisedLayout(layout: ExportLayout): boolean {
  return layout === "itemised" || layout === "tax-report";
}

export interface ExportOptions {
  format: ExportFormat;
  /** Inclusive bounds; empty string means unbounded. */
  from: IsoDate | "";
  to: IsoDate | "";
  categories: Category[];
  layout: ExportLayout;
  /** Base name without extension, as typed by the user. */
  filename: string;
}

export const MAX_FILENAME_LENGTH = 80;

export function defaultFilename(now: Date): string {
  return `expenses-${toIsoDate(now)}`;
}

const LAYOUT_SLUGS: Record<ExportLayout, string> = {
  itemised: "expenses",
  "tax-report": "tax-report",
  "monthly-summary": "monthly-summary",
  "category-analysis": "category-analysis",
};

/** A name that says what's in the file, e.g. `tax-report-fy2026` or `monthly-summary-2026-11-18`. */
export function suggestedFilename(
  options: Pick<ExportOptions, "format" | "layout" | "from" | "to">,
  now: Date,
): string {
  const layout = options.format === "csv" ? options.layout : "itemised";
  const preset = activePreset(options, now);
  const fy =
    preset === "this-fy" ? currentFinancialYear(now) : preset === "last-fy" ? currentFinancialYear(now) - 1 : null;
  return `${LAYOUT_SLUGS[layout]}-${fy ? `fy${fy}` : toIsoDate(now)}`;
}

export function defaultExportOptions(now: Date, initial: Partial<ExportOptions> = {}): ExportOptions {
  return {
    format: "csv",
    from: "",
    to: "",
    layout: "itemised",
    filename: defaultFilename(now),
    ...initial,
    // An empty category list from a caller means "no filter", which in this dialog is "all ticked".
    categories: initial.categories?.length
      ? CATEGORIES.filter((c) => initial.categories?.includes(c))
      : [...CATEGORIES],
  };
}

export const DATE_PRESETS = {
  all: "All time",
  "this-month": "This month",
  "last-30": "Last 30 days",
  "this-year": "This year",
  "this-fy": "This FY",
  "last-fy": "Last FY",
} as const;

export type DatePreset = keyof typeof DATE_PRESETS;

export function presetRange(preset: DatePreset, now: Date): { from: IsoDate | ""; to: IsoDate | "" } {
  const today = toIsoDate(now);
  switch (preset) {
    case "all":
      return { from: "", to: "" };
    case "this-month":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "last-30":
      return { from: toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)), to: today };
    case "this-year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case "this-fy":
      return financialYearToDate(currentFinancialYear(now), now);
    case "last-fy":
      return financialYearRange(currentFinancialYear(now) - 1);
  }
}

/** The preset matching the current range, if any, so its chip can show as selected. */
export function activePreset(options: Pick<ExportOptions, "from" | "to">, now: Date): DatePreset | null {
  const presets = Object.keys(DATE_PRESETS) as DatePreset[];
  return (
    presets.find((p) => {
      const range = presetRange(p, now);
      return range.from === options.from && range.to === options.to;
    }) ?? null
  );
}

/** Characters that are invalid in filenames on Windows/macOS, plus control characters. */
// eslint-disable-next-line no-control-regex
const UNSAFE_FILENAME_CHARS = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;

/** Make a user-typed name safe to save: strip unsafe characters, a typed extension and dots at the edges. */
export function sanitizeFilename(input: string, format: ExportFormat): string {
  return input
    .replace(/\s+/g, " ")
    .replace(UNSAFE_FILENAME_CHARS, "")
    .trim()
    .replace(new RegExp(`\\.${format}$`, "i"), "")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, MAX_FILENAME_LENGTH)
    .trim();
}

export type ExportField = "from" | "to" | "categories" | "filename";
export type ExportErrors = Partial<Record<ExportField, string>>;

export function validateExportOptions(options: ExportOptions): ExportErrors {
  const errors: ExportErrors = {};
  if (options.from && !isIsoDate(options.from)) errors.from = "Enter a valid start date.";
  if (options.to && !isIsoDate(options.to)) errors.to = "Enter a valid end date.";
  if (!errors.from && !errors.to && options.from && options.to && options.from > options.to) {
    errors.to = "End date must be on or after the start date.";
  }
  if (options.categories.length === 0) errors.categories = "Select at least one category.";
  if (!sanitizeFilename(options.filename, options.format)) errors.filename = "Enter a file name.";
  return errors;
}

/** Records an export will contain, oldest first so reports read chronologically. */
export function selectExportRecords(expenses: readonly Expense[], options: ExportOptions): Expense[] {
  // In the list filters an empty category list means "any"; here it means nothing is ticked.
  if (options.categories.length === 0) return [];
  return applyFilters(expenses, {
    ...DEFAULT_FILTERS,
    from: options.from,
    to: options.to,
    categories: options.categories,
    sort: "date-asc",
  });
}

export interface ExportSummary {
  count: number;
  totalCents: number;
  /** Earliest and latest dates actually present in the records. */
  firstDate: IsoDate | null;
  lastDate: IsoDate | null;
}

/** Expects records sorted oldest first, as returned by `selectExportRecords`. */
export function summarizeExport(records: readonly Expense[]): ExportSummary {
  return {
    count: records.length,
    totalCents: records.reduce((sum, e) => sum + e.amountCents, 0),
    firstDate: records[0]?.date ?? null,
    lastDate: records[records.length - 1]?.date ?? null,
  };
}
