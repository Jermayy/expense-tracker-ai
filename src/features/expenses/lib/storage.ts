import { isIsoDate } from "../domain/dates";
import { MAX_AMOUNT_CENTS } from "../domain/money";
import { isCategory, type Expense } from "../domain/types";
import { MAX_DESCRIPTION_LENGTH } from "../domain/validation";
import { downloadFile } from "./download";

export const STORAGE_KEY = "expense-tracker:v1";
export const SCHEMA_VERSION = 1;

interface StoredEnvelope {
  version: typeof SCHEMA_VERSION;
  expenses: Expense[];
}

export type LoadResult = { ok: true; expenses: Expense[]; skipped: number } | { ok: false; error: string };

export class StorageError extends Error {}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

/** Storage is untrusted (users, extensions and older versions can write to it), so check every field. */
export function isExpense(value: unknown): value is Expense {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    e.id.length > 0 &&
    isIsoDate(e.date) &&
    Number.isSafeInteger(e.amountCents) &&
    (e.amountCents as number) > 0 &&
    (e.amountCents as number) <= MAX_AMOUNT_CENTS &&
    isCategory(e.category) &&
    typeof e.description === "string" &&
    e.description.length <= MAX_DESCRIPTION_LENGTH &&
    isValidTimestamp(e.createdAt) &&
    isValidTimestamp(e.updatedAt)
  );
}

/**
 * Parse the stored payload. Individual malformed records are skipped and counted
 * (so the caller can tell the user); a structurally broken payload is an error,
 * and the raw data is left untouched so nothing is lost.
 */
export function parseStored(raw: string | null): LoadResult {
  if (raw === null) return { ok: true, expenses: [], skipped: 0 };

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Saved data is corrupted and couldn't be read." };
  }

  if (typeof data !== "object" || data === null || !Array.isArray((data as StoredEnvelope).expenses)) {
    return { ok: false, error: "Saved data is in an unrecognised format." };
  }
  const { version, expenses } = data as { version: unknown; expenses: unknown[] };
  if (version !== SCHEMA_VERSION) {
    return { ok: false, error: `Saved data is from an unsupported version (${String(version)}).` };
  }

  const seen = new Set<string>();
  const valid: Expense[] = [];
  for (const item of expenses) {
    if (isExpense(item) && !seen.has(item.id)) {
      seen.add(item.id);
      valid.push(item);
    }
  }
  return { ok: true, expenses: valid, skipped: expenses.length - valid.length };
}

export function loadExpenses(storage: Storage = window.localStorage): LoadResult {
  try {
    return parseStored(storage.getItem(STORAGE_KEY));
  } catch (err) {
    console.error("[storage] read failed", err);
    return { ok: false, error: "Browser storage is unavailable (private mode or blocked)." };
  }
}

/** Writes synchronously, so the data is on disk before the page can unload. */
export function saveExpenses(expenses: readonly Expense[], storage: Storage = window.localStorage): void {
  const envelope: StoredEnvelope = { version: SCHEMA_VERSION, expenses: [...expenses] };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch (err) {
    console.error("[storage] write failed", err);
    const quota = err instanceof DOMException && err.name === "QuotaExceededError";
    throw new StorageError(
      quota ? "Browser storage is full. Export and remove old expenses." : "Couldn't save to browser storage.",
    );
  }
}

/** Download whatever is stored, verbatim, so unreadable data can be recovered by hand. */
export function downloadRawBackup(storage: Storage = window.localStorage): void {
  const raw = storage.getItem(STORAGE_KEY) ?? "";
  downloadFile([raw], "application/json", `expense-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`);
}
