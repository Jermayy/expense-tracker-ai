"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatCents } from "../domain/money";
import type { Expense } from "../domain/types";
import { useExpenses } from "../state/ExpensesProvider";
import { ExpenseForm } from "./ExpenseForm";

type DialogState = { mode: "closed" } | { mode: "add" } | { mode: "edit"; expense: Expense };

interface ExpenseDialogApi {
  openAdd: () => void;
  openEdit: (expense: Expense) => void;
}

const ExpenseDialogContext = createContext<ExpenseDialogApi | null>(null);

/** One shared add/edit dialog so any page or row can open it. */
export function ExpenseDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>({ mode: "closed" });
  const { add, update } = useExpenses();
  const toast = useToast();

  const close = useCallback(() => setState({ mode: "closed" }), []);
  const api = useMemo<ExpenseDialogApi>(
    () => ({
      openAdd: () => setState({ mode: "add" }),
      openEdit: (expense) => setState({ mode: "edit", expense }),
    }),
    [],
  );

  return (
    <ExpenseDialogContext.Provider value={api}>
      {children}
      <Modal
        open={state.mode !== "closed"}
        title={state.mode === "edit" ? "Edit expense" : "Add expense"}
        onClose={close}
      >
        {state.mode === "add" && (
          <ExpenseForm
            submitLabel="Add expense"
            onCancel={close}
            onSubmit={(input) => {
              add(input);
              toast.show(`Added ${formatCents(input.amountCents)} · ${input.description}`);
              close();
            }}
          />
        )}
        {state.mode === "edit" && (
          <ExpenseForm
            initial={state.expense}
            submitLabel="Save changes"
            onCancel={close}
            onSubmit={(input) => {
              update(state.expense.id, input);
              toast.show("Expense updated");
              close();
            }}
          />
        )}
      </Modal>
    </ExpenseDialogContext.Provider>
  );
}

export function useExpenseDialog(): ExpenseDialogApi {
  const ctx = useContext(ExpenseDialogContext);
  if (!ctx) throw new Error("useExpenseDialog must be used inside <ExpenseDialogProvider>");
  return ctx;
}
