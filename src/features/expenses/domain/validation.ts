import { isIsoDate, toIsoDate } from "./dates";
import { MAX_AMOUNT_CENTS, formatCents, parseAmountToCents } from "./money";
import { isCategory, type ExpenseInput } from "./types";

export const MAX_DESCRIPTION_LENGTH = 200;
export const MIN_YEAR = 2000;

/** Raw form values, exactly as typed. */
export interface ExpenseFormValues {
  date: string;
  amount: string;
  category: string;
  description: string;
}

export type ExpenseFormErrors = Partial<Record<keyof ExpenseFormValues, string>>;

export type ValidationResult = { ok: true; value: ExpenseInput } | { ok: false; errors: ExpenseFormErrors };

/**
 * Validate and normalise form input. `today` is injected so "no future dates"
 * is deterministic in tests.
 */
export function validateExpense(values: ExpenseFormValues, today: Date): ValidationResult {
  const errors: ExpenseFormErrors = {};

  const date = values.date.trim();
  if (!date) {
    errors.date = "Date is required.";
  } else if (!isIsoDate(date)) {
    errors.date = "Enter a valid date.";
  } else if (date > toIsoDate(today)) {
    errors.date = "Date can't be in the future.";
  } else if (Number(date.slice(0, 4)) < MIN_YEAR) {
    errors.date = `Date must be in ${MIN_YEAR} or later.`;
  }

  const amountText = values.amount.trim();
  const amountCents = parseAmountToCents(amountText);
  if (!amountText) {
    errors.amount = "Amount is required.";
  } else if (amountCents === null) {
    errors.amount = "Enter a number with up to 2 decimal places.";
  } else if (amountCents <= 0) {
    errors.amount = "Amount must be greater than zero.";
  } else if (amountCents > MAX_AMOUNT_CENTS) {
    errors.amount = `Amount can't exceed ${formatCents(MAX_AMOUNT_CENTS)}.`;
  }

  if (!isCategory(values.category)) {
    errors.category = "Choose a category.";
  }

  const description = values.description.trim().replace(/\s+/g, " ");
  if (!description) {
    errors.description = "Description is required.";
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Keep it under ${MAX_DESCRIPTION_LENGTH} characters.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      date,
      amountCents: amountCents as number,
      category: values.category as ExpenseInput["category"],
      description,
    },
  };
}
