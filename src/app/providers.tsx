"use client";

import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { ExpenseDialogProvider } from "@/features/expenses/components/ExpenseDialog";
import { ExpensesProvider } from "@/features/expenses/state/ExpensesProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ExpensesProvider>
        <ExpenseDialogProvider>
          <AppShell>{children}</AppShell>
        </ExpenseDialogProvider>
      </ExpensesProvider>
    </ToastProvider>
  );
}
