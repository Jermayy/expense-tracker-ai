import type { ExportFormat } from "../options";
import { csvFormat } from "./csv";
import { jsonFormat } from "./json";
import type { ExportFormatSpec } from "./types";

export type { ExportContext, ExportFormatSpec } from "./types";

export const FORMAT_SPECS: Record<ExportFormat, ExportFormatSpec> = {
  csv: csvFormat,
  json: jsonFormat,
};
