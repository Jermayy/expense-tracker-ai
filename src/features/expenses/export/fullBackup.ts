import { toIsoDate } from "../domain/dates";
import type { Expense } from "../domain/types";
import { downloadFile } from "../lib/download";
import { jsonFormat } from "./formats/json";
import { defaultExportOptions, selectExportRecords, summarizeExport } from "./options";

/** Download every expense as JSON. Returns how many were saved. */
export function downloadFullBackup(expenses: readonly Expense[], now: Date): number {
  const options = defaultExportOptions(now, { format: "json" });
  const records = selectExportRecords(expenses, options);
  const parts = jsonFormat.encode({ records, summary: summarizeExport(records), options, generatedAt: now });
  downloadFile(parts, jsonFormat.mimeType, `spendwise-backup-${toIsoDate(now)}.json`);
  return records.length;
}
