export const CATEGORIES = ["Food", "Transportation", "Entertainment", "Shopping", "Bills", "Other"] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

/** A calendar date in `YYYY-MM-DD` form, interpreted in the user's local time. */
export type IsoDate = string;

export interface Expense {
  id: string;
  /** Calendar date the money was spent. */
  date: IsoDate;
  /** Amount in integer minor units (cents). Always > 0. */
  amountCents: number;
  category: Category;
  description: string;
  /** UTC ISO timestamps. */
  createdAt: string;
  updatedAt: string;
}

/** User-editable fields of an expense. */
export type ExpenseInput = Pick<Expense, "date" | "amountCents" | "category" | "description">;
