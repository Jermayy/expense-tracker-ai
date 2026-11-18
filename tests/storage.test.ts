import { describe, expect, it } from "vitest";
import { STORAGE_KEY, StorageError, loadExpenses, parseStored, saveExpenses } from "@/features/expenses/lib/storage";
import { buildExpense } from "./factories";

describe("parseStored", () => {
  it("treats missing data as empty", () => {
    expect(parseStored(null)).toEqual({ ok: true, expenses: [], skipped: 0 });
  });

  it("errors on corrupt JSON", () => {
    expect(parseStored("{nope").ok).toBe(false);
  });

  it("errors on unknown schema version", () => {
    expect(parseStored(JSON.stringify({ version: 99, expenses: [] })).ok).toBe(false);
  });

  it("skips invalid and duplicate records", () => {
    const good = buildExpense();
    const raw = JSON.stringify({
      version: 1,
      expenses: [good, good, { ...buildExpense(), amountCents: 1.5 }, { ...buildExpense(), category: "Rent" }, "junk"],
    });
    expect(parseStored(raw)).toEqual({ ok: true, expenses: [good], skipped: 4 });
  });
});

describe("save / load", () => {
  it("round-trips through localStorage", () => {
    const expenses = [buildExpense(), buildExpense()];
    saveExpenses(expenses);
    expect(loadExpenses()).toEqual({ ok: true, expenses, skipped: 0 });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).version).toBe(1);
  });

  it("throws a friendly StorageError when the quota is exceeded", () => {
    const full = {
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    } as unknown as Storage;
    expect(() => saveExpenses([buildExpense()], full)).toThrow(StorageError);
    expect(() => saveExpenses([buildExpense()], full)).toThrow(/storage is full/);
  });

  it("reports unavailable storage instead of throwing", () => {
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
    } as unknown as Storage;
    expect(loadExpenses(blocked)).toEqual({ ok: false, error: expect.stringMatching(/unavailable/) });
  });
});
