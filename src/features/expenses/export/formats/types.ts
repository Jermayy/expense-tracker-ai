import type { Expense } from "../../domain/types";
import type { ExportFormat, ExportOptions, ExportSummary } from "../options";

export interface ExportContext {
  /** Already filtered and sorted. */
  records: readonly Expense[];
  summary: ExportSummary;
  options: ExportOptions;
  generatedAt: Date;
}

export interface ExportFormatSpec {
  id: ExportFormat;
  label: string;
  description: string;
  extension: string;
  mimeType: string;
  encode: (context: ExportContext) => BlobPart[];
}
