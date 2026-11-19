"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { buttonStyles, card } from "@/components/ui/styles";
import { formatCents } from "../domain/money";
import { applyFilters, filtersFromSearchParams, filtersToSearchParams, hasActiveFilters } from "../lib/filters";
import { useExpenses } from "../state/ExpensesProvider";
import { useExpenseDialog } from "./ExpenseDialog";
import { ExpenseFiltersBar } from "./ExpenseFiltersBar";
import { ExpenseList } from "./ExpenseList";
import { EmptyState, LoadErrorView, LoadingSkeleton } from "./StatusViews";
import { useCsvExport } from "./useCsvExport";

export function ExpensesView() {
  const searchParams = useSearchParams();
  const { status, loadError, skippedOnLoad, expenses, clearAll } = useExpenses();
  const { openAdd } = useExpenseDialog();
  const toast = useToast();
  const [filters, setFilters] = useState(() => filtersFromSearchParams(new URLSearchParams(searchParams.toString())));
  const [confirmClear, setConfirmClear] = useState(false);
  const exportCsv = useCsvExport();

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
          <button
            type="button"
            className={buttonStyles.secondary}
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
          >
            <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
              <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
            </svg>
            Export CSV
          </button>
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
