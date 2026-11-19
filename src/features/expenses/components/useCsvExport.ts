"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import type { Expense } from "../domain/types";
import { csvFilename, downloadCsv, expensesToCsv } from "../lib/csv";

/** Download the given expenses as CSV and toast the outcome. */
export function useCsvExport(): (expenses: readonly Expense[]) => void {
  const toast = useToast();
  return useCallback(
    (expenses) => {
      try {
        downloadCsv(expensesToCsv(expenses), csvFilename(new Date()));
        toast.show(`Exported ${expenses.length} ${expenses.length === 1 ? "expense" : "expenses"} to CSV`);
      } catch (err) {
        console.error("[export] csv failed", err);
        toast.show("Export failed. Please try again.", { tone: "error" });
      }
    },
    [toast],
  );
}
