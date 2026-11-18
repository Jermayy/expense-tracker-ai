import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExpensesProvider, useExpenses } from "@/features/expenses/state/ExpensesProvider";
import { STORAGE_KEY } from "@/features/expenses/lib/storage";
import { NOW } from "./factories";

const input = { date: "2026-11-01", amountCents: 1500, category: "Food" as const, description: "Pizza" };

function renderStore(storage: Storage = window.localStorage) {
  let n = 0;
  return renderHook(() => useExpenses(), {
    wrapper: ({ children }) => (
      <ExpensesProvider storage={storage} now={() => NOW} newId={() => `id-${++n}`}>
        {children}
      </ExpensesProvider>
    ),
  });
}

function stored() {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
}

describe("ExpensesProvider", () => {
  it("loads, then adds, updates and removes with persistence", async () => {
    const { result } = renderStore();
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => {
      result.current.add(input);
    });
    expect(result.current.expenses).toHaveLength(1);
    expect(stored().expenses[0]).toMatchObject({ id: "id-1", ...input });

    act(() => result.current.update("id-1", { ...input, amountCents: 2000 }));
    expect(stored().expenses[0].amountCents).toBe(2000);

    act(() => {
      result.current.remove("id-1");
    });
    expect(result.current.expenses).toEqual([]);
    expect(stored().expenses).toEqual([]);
  });

  it("restores a deleted expense (undo)", async () => {
    const { result } = renderStore();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    let removed!: ReturnType<typeof result.current.remove>;
    act(() => {
      result.current.add(input);
    });
    act(() => {
      removed = result.current.remove("id-1");
    });
    act(() => result.current.restore(removed));
    expect(result.current.expenses).toEqual([removed]);
  });

  it("leaves state unchanged when saving fails", async () => {
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    } as unknown as Storage;
    const { result } = renderStore(failing);
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(() => act(() => void result.current.add(input))).toThrow(/storage is full/);
    expect(result.current.expenses).toEqual([]);
  });

  it("refuses to overwrite unreadable data", async () => {
    window.localStorage.setItem(STORAGE_KEY, "{corrupt");
    const { result } = renderStore();
    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(() => act(() => void result.current.add(input))).toThrow();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("{corrupt");

    act(() => result.current.discardUnreadable());
    expect(result.current.status).toBe("ready");
    expect(stored()).toEqual({ version: 1, expenses: [] });
  });
});
