import { describe, expect, it } from "vitest";
import { validateExpense, type ExpenseFormValues } from "@/features/expenses/domain/validation";
import { NOW } from "./factories";

const valid: ExpenseFormValues = {
  date: "2026-11-18",
  amount: "12.50",
  category: "Food",
  description: "  Lunch   with  team ",
};

describe("validateExpense", () => {
  it("normalises valid input", () => {
    expect(validateExpense(valid, NOW)).toEqual({
      ok: true,
      value: { date: "2026-11-18", amountCents: 1250, category: "Food", description: "Lunch with team" },
    });
  });

  it("reports every missing field", () => {
    const result = validateExpense({ date: "", amount: "", category: "", description: "" }, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["amount", "category", "date", "description"]);
  });

  it.each<[Partial<ExpenseFormValues>, keyof ExpenseFormValues, RegExp]>([
    [{ date: "2026-11-19" }, "date", /future/],
    [{ date: "1999-12-31" }, "date", /2000/],
    [{ date: "2026-02-30" }, "date", /valid date/],
    [{ amount: "0" }, "amount", /greater than zero/],
    [{ amount: "12.345" }, "amount", /2 decimal/],
    [{ amount: "10000000.01" }, "amount", /exceed/],
    [{ category: "Rent" }, "category", /category/],
    [{ description: "x".repeat(201) }, "description", /200/],
  ])("rejects %o", (patch, field, message) => {
    const result = validateExpense({ ...valid, ...patch }, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[field]).toMatch(message);
  });
});
