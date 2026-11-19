"use client";

import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { ExpenseDialogProvider } from "@/features/expenses/components/ExpenseDialog";
import { ExportDialogProvider } from "@/features/expenses/export/ExportDialog";
import { ExpensesProvider } from "@/features/expenses/state/ExpensesProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ExpensesProvider>
        <ExpenseDialogProvider>
          <ExportDialogProvider>
            <AppShell>{children}</AppShell>
          </ExportDialogProvider>
        </ExpenseDialogProvider>
      </ExpensesProvider>
    </ToastProvider>
  );
}
