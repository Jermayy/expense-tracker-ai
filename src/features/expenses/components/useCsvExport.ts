"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import type { Expense } from "../domain/types";
import { recordBackup } from "../lib/backupReminder";
import { csvFilename, downloadCsv, expensesToCsv } from "../lib/csv";
import { useExpenses } from "../state/ExpensesProvider";

/** Download the given expenses as CSV and toast the outcome. Exporting everything counts as a backup. */
export function useCsvExport(): (expenses: readonly Expense[]) => void {
  const toast = useToast();
  const { expenses: all } = useExpenses();
  return useCallback(
    (expenses) => {
      try {
        const now = new Date();
        downloadCsv(expensesToCsv(expenses), csvFilename(now));
        if (expenses.length > 0 && expenses.length === all.length) recordBackup(now);
        toast.show(`Exported ${expenses.length} ${expenses.length === 1 ? "expense" : "expenses"} to CSV`);
      } catch (err) {
        console.error("[export] csv failed", err);
        toast.show("Export failed. Please try again.", { tone: "error" });
      }
    },
    [toast, all.length],
  );
}
