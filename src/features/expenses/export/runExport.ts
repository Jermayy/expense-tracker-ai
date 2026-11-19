import type { Expense } from "../domain/types";
import { downloadFile } from "../lib/download";
import { FORMAT_SPECS } from "./formats";
import {
  includesDescriptions,
  redactRecords,
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
  const selected = selectExportRecords(expenses, options);
  // Redact here, once, so no format can leak a description by forgetting to.
  const records = options.redact && includesDescriptions(options) ? redactRecords(selected) : selected;
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

/** Whether this browser can share files through the device's share sheet (Web Share API). */
export function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [new File([""], "probe.csv", { type: "text/csv" })] });
  } catch {
    return false;
  }
}

/** The user closed the share sheet without choosing anything: not an error. */
export function isShareCancelled(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/**
 * Build the file and hand it to the device's share sheet. Browsers only allow sharing shortly
 * after a click, so the file is built synchronously and nothing is awaited before `share`.
 */
export async function shareExport(
  expenses: readonly Expense[],
  options: ExportOptions,
  {
    now = () => new Date(),
    share = (data: ShareData) => navigator.share(data),
  }: { now?: () => Date; share?: (data: ShareData) => Promise<void> } = {},
): Promise<ExportFile> {
  const file = buildExportFile(expenses, options, now());
  await share({ files: [new File(file.parts, file.filename, { type: file.mimeType })], title: file.filename });
  return file;
}
