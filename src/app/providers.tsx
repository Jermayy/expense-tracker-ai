"use client";

import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { ExpenseDialogProvider } from "@/features/expenses/components/ExpenseDialog";
import { ExpensesProvider } from "@/features/expenses/state/ExpensesProvider";
import { ExportHubProvider } from "@/features/exports/state/ExportHubProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ExpensesProvider>
        <ExportHubProvider>
          <ExpenseDialogProvider>
            <AppShell>{children}</AppShell>
          </ExpenseDialogProvider>
        </ExportHubProvider>
      </ExpensesProvider>
    </ToastProvider>
  );
}
