import type { Expense } from "../domain/types";
import { downloadFile } from "../lib/download";
import { FORMAT_SPECS } from "./formats";
import {
  sanitizeFilename,
  selectExportRecords,
  summarizeExport,
  validateExportOptions,
  type ExportOptions,
  type ExportSummary,
} from "./options";

export interface ExportFile {
  filename: string;
  mimeType: string;
  parts: BlobPart[];
  summary: ExportSummary;
}

export class ExportValidationError extends Error {}

/** Build the export file in memory. Pure apart from reading `generatedAt`. */
export function buildExportFile(expenses: readonly Expense[], options: ExportOptions, generatedAt: Date): ExportFile {
  const errors = Object.values(validateExportOptions(options));
  if (errors.length) throw new ExportValidationError(errors[0]);

  const spec = FORMAT_SPECS[options.format];
  const records = selectExportRecords(expenses, options);
  const summary = summarizeExport(records);
  return {
    filename: `${sanitizeFilename(options.filename, options.format)}.${spec.extension}`,
    mimeType: spec.mimeType,
    parts: spec.encode({ records, summary, options, generatedAt }),
    summary,
  };
}

/** Let the browser paint the busy state before synchronous encoding blocks the main thread. */
const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function runExport(
  expenses: readonly Expense[],
  options: ExportOptions,
  { now = () => new Date(), download = downloadFile } = {},
): Promise<ExportFile> {
  await nextFrame();
  const file = buildExportFile(expenses, options, now());
  download(file.parts, file.mimeType, file.filename);
  return file;
}
