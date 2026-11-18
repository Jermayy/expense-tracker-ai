import type { Expense } from "@/features/expenses/domain/types";

let seq = 0;

export function buildExpense(overrides: Partial<Expense> = {}): Expense {
  seq += 1;
  return {
    id: `exp-${seq}`,
    date: "2026-11-10",
    amountCents: 1000,
    category: "Food",
    description: `Expense ${seq}`,
    createdAt: "2026-11-10T00:00:00.000Z",
    updatedAt: "2026-11-10T00:00:00.000Z",
    ...overrides,
  };
}

/** Local-time date, matching how the app interprets "today". */
export const NOW = new Date(2026, 10, 18, 12, 0, 0);
