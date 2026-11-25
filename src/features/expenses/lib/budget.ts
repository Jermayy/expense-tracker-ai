import { MAX_AMOUNT_CENTS } from "../domain/money";
import { StorageError } from "./storage";

// The monthly budget is a single user setting, kept under its own key so the expenses
// envelope (expense-tracker:v1) is unchanged.

export const BUDGET_STORAGE_KEY = "expense-tracker:budget:v1";
const BUDGET_SCHEMA_VERSION = 1;

export function isValidBudgetCents(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= MAX_AMOUNT_CENTS;
}

/** Returns the stored monthly budget in cents, or null when none is set or it can't be read. */
export function parseBudget(raw: string | null): number | null {
  if (raw === null) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    data = undefined;
  }
  if (typeof data === "object" && data !== null) {
    const { version, monthlyBudgetCents } = data as Record<string, unknown>;
    if (version === BUDGET_SCHEMA_VERSION && isValidBudgetCents(monthlyBudgetCents)) return monthlyBudgetCents;
  }
  // A single setting the user can re-enter, not expense data: treat as "not set".
  console.warn("[budget] stored budget was unreadable; treating it as not set");
  return null;
}

export function loadBudget(storage: Storage = window.localStorage): number | null {
  try {
    return parseBudget(storage.getItem(BUDGET_STORAGE_KEY));
  } catch (err) {
    console.warn("[budget] could not read budget", err);
    return null;
  }
}

/** Persists the budget; throws StorageError so the caller can tell the user. */
export function saveBudget(monthlyBudgetCents: number, storage: Storage = window.localStorage): void {
  if (!isValidBudgetCents(monthlyBudgetCents)) throw new StorageError("Budget must be a positive amount.");
  try {
    storage.setItem(BUDGET_STORAGE_KEY, JSON.stringify({ version: BUDGET_SCHEMA_VERSION, monthlyBudgetCents }));
  } catch (err) {
    console.error("[budget] write failed", err);
    throw new StorageError("Couldn't save your budget. Browser storage may be full or disabled.");
  }
}
