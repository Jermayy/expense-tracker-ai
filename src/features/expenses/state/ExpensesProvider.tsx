"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Expense, ExpenseInput } from "../domain/types";
import { sampleExpenses } from "../lib/sampleData";
import { STORAGE_KEY, loadExpenses, saveExpenses } from "../lib/storage";

export type ExpensesStatus = "loading" | "ready" | "error";

interface ExpensesApi {
  status: ExpensesStatus;
  /** Set when stored data couldn't be read. Data is left in place untouched. */
  loadError: string | null;
  /** Number of stored records that failed validation on load. */
  skippedOnLoad: number;
  expenses: Expense[];
  add: (input: ExpenseInput) => Expense;
  update: (id: string, input: ExpenseInput) => void;
  remove: (id: string) => Expense;
  restore: (expense: Expense) => void;
  loadSampleData: () => void;
  clearAll: () => void;
  /** Overwrite unreadable stored data with an empty list. Only offered from the load-error view. */
  discardUnreadable: () => void;
}

const ExpensesContext = createContext<ExpensesApi | null>(null);

export interface ExpensesProviderProps {
  children: React.ReactNode;
  /** Injected for tests. */
  storage?: Storage;
  now?: () => Date;
  newId?: () => string;
}

export function ExpensesProvider({
  children,
  storage,
  now = () => new Date(),
  newId = () => crypto.randomUUID(),
}: ExpensesProviderProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [status, setStatus] = useState<ExpensesStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [skippedOnLoad, setSkippedOnLoad] = useState(0);
  // Mirrors state synchronously so back-to-back mutations never read stale data.
  const current = useRef<Expense[]>([]);
  const deps = useRef({ storage, now, newId });
  deps.current = { storage, now, newId };

  const hydrate = useCallback(() => {
    const result = loadExpenses(deps.current.storage);
    if (result.ok) {
      current.current = result.expenses;
      setExpenses(result.expenses);
      setSkippedOnLoad(result.skipped);
      setLoadError(null);
      setStatus("ready");
    } else {
      setLoadError(result.error);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    hydrate();
    // Keep multiple open tabs in sync.
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) hydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [hydrate]);

  /** Persist first, then commit to state, so the UI never shows data that wasn't saved. Throws StorageError. */
  const commit = useCallback(
    (next: Expense[]) => {
      if (status === "error") throw new Error("Can't save while stored data is unreadable.");
      saveExpenses(next, deps.current.storage);
      current.current = next;
      setExpenses(next);
    },
    [status],
  );

  const add = useCallback<ExpensesApi["add"]>(
    (input) => {
      const stamp = deps.current.now().toISOString();
      const expense: Expense = { ...input, id: deps.current.newId(), createdAt: stamp, updatedAt: stamp };
      commit([...current.current, expense]);
      return expense;
    },
    [commit],
  );

  const update = useCallback<ExpensesApi["update"]>(
    (id, input) => {
      if (!current.current.some((e) => e.id === id)) throw new Error("That expense no longer exists.");
      const stamp = deps.current.now().toISOString();
      commit(current.current.map((e) => (e.id === id ? { ...e, ...input, updatedAt: stamp } : e)));
    },
    [commit],
  );

  const remove = useCallback<ExpensesApi["remove"]>(
    (id) => {
      const target = current.current.find((e) => e.id === id);
      if (!target) throw new Error("That expense no longer exists.");
      commit(current.current.filter((e) => e.id !== id));
      return target;
    },
    [commit],
  );

  const restore = useCallback<ExpensesApi["restore"]>(
    (expense) => {
      if (current.current.some((e) => e.id === expense.id)) return;
      commit([...current.current, expense]);
    },
    [commit],
  );

  const loadSampleData = useCallback(() => {
    commit([...current.current, ...sampleExpenses(deps.current.now(), deps.current.newId)]);
  }, [commit]);

  const clearAll = useCallback(() => commit([]), [commit]);

  const discardUnreadable = useCallback(() => {
    saveExpenses([], deps.current.storage);
    hydrate();
  }, [hydrate]);

  const api = useMemo<ExpensesApi>(
    () => ({
      status,
      loadError,
      skippedOnLoad,
      expenses,
      add,
      update,
      remove,
      restore,
      loadSampleData,
      clearAll,
      discardUnreadable,
    }),
    [
      status,
      loadError,
      skippedOnLoad,
      expenses,
      add,
      update,
      remove,
      restore,
      loadSampleData,
      clearAll,
      discardUnreadable,
    ],
  );

  return <ExpensesContext.Provider value={api}>{children}</ExpensesContext.Provider>;
}

export function useExpenses(): ExpensesApi {
  const ctx = useContext(ExpensesContext);
  if (!ctx) throw new Error("useExpenses must be used inside <ExpensesProvider>");
  return ctx;
}
