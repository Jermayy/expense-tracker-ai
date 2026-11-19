"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { buttonStyles, card } from "@/components/ui/styles";
import { formatCents } from "../domain/money";
import { applyFilters, filtersFromSearchParams, filtersToSearchParams, hasActiveFilters } from "../lib/filters";
import { useExportDialog } from "../export/ExportDialog";
import { useExpenses } from "../state/ExpensesProvider";
import { useExpenseDialog } from "./ExpenseDialog";
import { ExpenseFiltersBar } from "./ExpenseFiltersBar";
import { ExpenseList } from "./ExpenseList";
import { ExportSplitButton } from "./ExportSplitButton";
import { EmptyState, LoadErrorView, LoadingSkeleton } from "./StatusViews";
import { useCsvExport } from "./useCsvExport";

export function ExpensesView() {
  const searchParams = useSearchParams();
  const { status, loadError, skippedOnLoad, expenses, clearAll } = useExpenses();
  const { openAdd } = useExpenseDialog();
  const toast = useToast();
  const exportCsv = useCsvExport();
  const { openExport } = useExportDialog();
  const [filters, setFilters] = useState(() => filtersFromSearchParams(new URLSearchParams(searchParams.toString())));
  const [confirmClear, setConfirmClear] = useState(false);

  // The URL mirrors the filters so a filtered view can be bookmarked or refreshed.
  useEffect(() => {
    const query = filtersToSearchParams(filters).toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }, [filters]);

  useEffect(() => {
    if (skippedOnLoad > 0) {
      toast.show(`${skippedOnLoad} saved ${skippedOnLoad === 1 ? "entry was" : "entries were"} invalid and skipped.`, {
        tone: "error",
      });
    }
  }, [skippedOnLoad, toast]);

  const filtered = useMemo(() => applyFilters(expenses, filters), [expenses, filters]);
  const filteredTotal = useMemo(() => filtered.reduce((sum, e) => sum + e.amountCents, 0), [filtered]);
  const filtering = hasActiveFilters(filters);

  const header = (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Expenses</h1>
        {status === "ready" && (
          <p className="mt-1 text-sm text-ink-muted" aria-live="polite">
            {filtering ? `${filtered.length} of ${expenses.length} expenses` : `${expenses.length} expenses`} ·{" "}
            <span className="font-semibold tabular-nums text-ink">{formatCents(filteredTotal)}</span>
          </p>
        )}
      </div>
      {status === "ready" && expenses.length > 0 && (
        <div className="flex gap-2">
          <button type="button" className={buttonStyles.ghost} onClick={() => setConfirmClear(true)}>
            Clear all
          </button>
          <ExportSplitButton
            onQuickExport={() => exportCsv(filtered)}
            quickDisabled={filtered.length === 0}
            // The dialog starts from what's on screen; it has no text search, so the query isn't carried over.
            onMoreOptions={() => openExport({ from: filters.from, to: filters.to, categories: filters.categories })}
          />
        </div>
      )}
    </div>
  );

  if (status === "loading")
    return (
      <>
        {header}
        <LoadingSkeleton />
      </>
    );
  if (status === "error")
    return (
      <>
        {header}
        <LoadErrorView message={loadError ?? "Unknown error."} />
      </>
    );

  return (
    <>
      {header}
      <div className="space-y-4">
        {expenses.length > 0 && (
          <div className={`${card} p-4`}>
            <ExpenseFiltersBar filters={filters} onChange={setFilters} />
          </div>
        )}
        <div className={`${card} overflow-hidden`}>
          {expenses.length === 0 ? (
            <EmptyState title="No expenses yet" message="Expenses you add will appear here.">
              <button type="button" className={buttonStyles.primary} onClick={openAdd}>
                Add expense
              </button>
            </EmptyState>
          ) : filtered.length === 0 ? (
            <EmptyState title="No matching expenses" message="Try a different search term, date range or category." />
          ) : (
            <ExpenseList expenses={filtered} />
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmClear}
        title="Delete all expenses?"
        message={`This permanently deletes all ${expenses.length} expenses from this browser. Export to CSV first if you want a copy.`}
        confirmLabel="Delete all"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          try {
            clearAll();
            toast.show("All expenses deleted", { tone: "info" });
          } catch (err) {
            toast.show(err instanceof Error ? err.message : "Couldn't delete expenses.", { tone: "error" });
          }
        }}
      />
    </>
  );
}
