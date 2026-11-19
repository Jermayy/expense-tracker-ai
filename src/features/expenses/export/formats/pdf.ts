import { formatDate } from "../../domain/dates";
import { CURRENCY, LOCALE, formatCents } from "../../domain/money";
import { CATEGORIES } from "../../domain/types";
import type { ExportOptions } from "../options";
import { buildPdf, PAGE_HEIGHT, PAGE_WIDTH, PdfPage, truncateToWidth, type Rgb } from "./pdfDocument";
import type { ExportContext, ExportFormatSpec } from "./types";

export const REPORT_TITLE = "Expense report";

const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const RIGHT = PAGE_WIDTH - MARGIN;
const COL_CATEGORY = MARGIN + 78;
const COL_DESCRIPTION = MARGIN + 176;
const AMOUNT_COLUMN_WIDTH = 84;
const DESCRIPTION_MAX_WIDTH = RIGHT - AMOUNT_COLUMN_WIDTH - COL_DESCRIPTION;

const ROW_HEIGHT = 18;
const BODY_SIZE = 9;
/** Rows stop above this line so the footer always has room. */
const BOTTOM_LIMIT = MARGIN + 24;
const FOOTER_Y = 28;

const INK: Rgb = [0.1, 0.12, 0.16];
const MUTED: Rgb = [0.42, 0.45, 0.5];
const RULE: Rgb = [0.82, 0.84, 0.87];
const ZEBRA: Rgb = [0.965, 0.97, 0.975];
const PANEL: Rgb = [0.95, 0.96, 0.97];

const generatedFormatter = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeStyle: "short" });

export function describePeriod({ from, to }: Pick<ExportOptions, "from" | "to">): string {
  if (from && to) return `${formatDate(from)} – ${formatDate(to)}`;
  if (from) return `From ${formatDate(from)}`;
  if (to) return `Up to ${formatDate(to)}`;
  return "All dates";
}

export function describeCategories({ categories }: Pick<ExportOptions, "categories">): string {
  return categories.length === CATEGORIES.length ? "All categories" : categories.join(", ");
}

function drawTableHeader(page: PdfPage, y: number): number {
  const style = { size: 7.5, color: MUTED, font: "bold" } as const;
  page.text("DATE", MARGIN + 6, y, style);
  page.text("CATEGORY", COL_CATEGORY, y, style);
  page.text("DESCRIPTION", COL_DESCRIPTION, y, style);
  page.text(`AMOUNT (${CURRENCY})`, RIGHT - 6, y, { ...style, align: "right" });
  page.line(MARGIN, y - 7, RIGHT, y - 7, RULE);
  return y - 7 - ROW_HEIGHT + 5;
}

function drawCoverHeader(page: PdfPage, { summary, options, generatedAt }: ExportContext): number {
  let y = PAGE_HEIGHT - MARGIN - 18;
  page.text(REPORT_TITLE, MARGIN, y, { font: "bold", size: 20, color: INK });
  y -= 20;
  page.text(`Generated ${generatedFormatter.format(generatedAt)}`, MARGIN, y, { size: 9, color: MUTED });

  // Summary panels.
  y -= 58;
  const panelWidth = (CONTENT_WIDTH - 12) / 2;
  const panels: [string, string][] = [
    ["RECORDS", String(summary.count)],
    [`TOTAL (${CURRENCY})`, formatCents(summary.totalCents)],
  ];
  panels.forEach(([label, value], i) => {
    const x = MARGIN + i * (panelWidth + 12);
    page.rect(x, y, panelWidth, 44, PANEL);
    page.text(label, x + 12, y + 28, { font: "bold", size: 7.5, color: MUTED });
    page.text(value, x + 12, y + 10, { font: "bold", size: 15, color: INK });
  });

  y -= 22;
  page.text(`Period: ${describePeriod(options)}`, MARGIN, y, { size: 9, color: INK });
  y -= 14;
  page.text(truncateToWidth(`Categories: ${describeCategories(options)}`, 9, CONTENT_WIDTH), MARGIN, y, {
    size: 9,
    color: INK,
  });
  return y - 30;
}

function drawFooters(pages: PdfPage[]) {
  pages.forEach((page, i) => {
    page.line(MARGIN, FOOTER_Y + 12, RIGHT, FOOTER_Y + 12, RULE);
    page.text(`Spendwise · ${REPORT_TITLE}`, MARGIN, FOOTER_Y, { size: 7.5, color: MUTED });
    page.text(`Page ${i + 1} of ${pages.length}`, RIGHT, FOOTER_Y, { size: 7.5, color: MUTED, align: "right" });
  });
}

/** Lay out the report across as many A4 pages as needed, repeating the table header on each. */
export function renderPdfReport(context: ExportContext): Uint8Array<ArrayBuffer> {
  const pages: PdfPage[] = [new PdfPage()];
  let page = pages[0];
  let y = drawTableHeader(page, drawCoverHeader(page, context));

  const ensureRoom = () => {
    if (y >= BOTTOM_LIMIT) return;
    page = new PdfPage();
    pages.push(page);
    y = drawTableHeader(page, PAGE_HEIGHT - MARGIN - 8);
  };

  if (context.records.length === 0) {
    page.text("No expenses match the selected filters.", MARGIN + 6, y, { size: BODY_SIZE, color: MUTED });
    y -= ROW_HEIGHT;
  }

  context.records.forEach((expense, i) => {
    ensureRoom();
    if (i % 2 === 1) page.rect(MARGIN, y - 6, CONTENT_WIDTH, ROW_HEIGHT, ZEBRA);
    const style = { size: BODY_SIZE, color: INK };
    page.text(formatDate(expense.date), MARGIN + 6, y, style);
    page.text(expense.category, COL_CATEGORY, y, style);
    page.text(truncateToWidth(expense.description, BODY_SIZE, DESCRIPTION_MAX_WIDTH - 12), COL_DESCRIPTION, y, style);
    page.text(formatCents(expense.amountCents), RIGHT - 6, y, { ...style, align: "right" });
    y -= ROW_HEIGHT;
  });

  ensureRoom();
  page.line(MARGIN, y + ROW_HEIGHT - 6, RIGHT, y + ROW_HEIGHT - 6, INK, 0.75);
  y -= 2;
  page.text("Total", MARGIN + 6, y, { font: "bold", size: 10, color: INK });
  page.text(formatCents(context.summary.totalCents), RIGHT - 6, y, {
    font: "bold",
    size: 10,
    color: INK,
    align: "right",
  });

  drawFooters(pages);
  return buildPdf(pages, { title: REPORT_TITLE, createdAt: context.generatedAt });
}

export const pdfFormat: ExportFormatSpec = {
  id: "pdf",
  label: "PDF",
  description: "Printable report with totals",
  extension: "pdf",
  mimeType: "application/pdf",
  encode: (context) => [renderPdfReport(context)],
};
