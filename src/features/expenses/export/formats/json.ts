import { CATEGORIES } from "../../domain/types";
import { CURRENCY, centsToDecimalString } from "../../domain/money";
import type { ExportFormatSpec } from "./types";

/** Bump when the shape changes so importers can tell versions apart. */
export const JSON_EXPORT_VERSION = 1;

export const jsonFormat: ExportFormatSpec = {
  id: "json",
  label: "JSON",
  description: "Structured data for scripts and other apps",
  extension: "json",
  mimeType: "application/json",
  encode: ({ records, summary, options, generatedAt }) => {
    const document = {
      version: JSON_EXPORT_VERSION,
      generatedAt: generatedAt.toISOString(),
      currency: CURRENCY,
      filters: {
        from: options.from || null,
        to: options.to || null,
        categories: options.categories.length === CATEGORIES.length ? null : options.categories,
      },
      summary: {
        count: summary.count,
        totalCents: summary.totalCents,
        total: centsToDecimalString(summary.totalCents),
      },
      expenses: records.map((e) => ({
        id: e.id,
        date: e.date,
        category: e.category,
        description: e.description,
        // Integer cents is the exact value; the decimal string is for humans.
        amountCents: e.amountCents,
        amount: centsToDecimalString(e.amountCents),
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      })),
    };
    return [JSON.stringify(document, null, 2)];
  },
};
