import { expensesToCsv } from "../../lib/csv";
import type { ExportFormatSpec } from "./types";

export const csvFormat: ExportFormatSpec = {
  id: "csv",
  label: "CSV",
  description: "Spreadsheets: Excel, Numbers, Google Sheets",
  extension: "csv",
  mimeType: "text/csv;charset=utf-8",
  // The BOM makes Excel read the file as UTF-8.
  encode: ({ records }) => ["﻿", expensesToCsv(records)],
};
