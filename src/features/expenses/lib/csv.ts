import { centsToDecimalString, CURRENCY } from "../domain/money";
import type { Expense } from "../domain/types";

const HEADER = ["Date", "Description", "Category", `Amount (${CURRENCY})`];

/** Characters that make spreadsheet apps treat a cell as a formula (CSV injection). */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: string): string {
  const safe = FORMULA_TRIGGER.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function expensesToCsv(expenses: readonly Expense[]): string {
  const rows = expenses.map((e) => [e.date, e.description, e.category, centsToDecimalString(e.amountCents)]);
  // CRLF per RFC 4180; Excel and Numbers both handle it.
  return [HEADER, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}
