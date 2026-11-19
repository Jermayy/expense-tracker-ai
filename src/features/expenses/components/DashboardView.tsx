"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useToast } from "@/components/ui/Toast";
import { buttonStyles, card } from "@/components/ui/styles";
import { monthKey, toIsoDate } from "../domain/dates";
import { TREND_MONTHS, summarize } from "../lib/analytics";
import { applyFilters, DEFAULT_FILTERS } from "../lib/filters";
import { useExportDialog } from "../export/ExportDialog";
import { useExpenses } from "../state/ExpensesProvider";
import { CategoryBreakdown, MonthlyTrend } from "./charts";
import { useExpenseDialog } from "./ExpenseDialog";
import { ExpenseList } from "./ExpenseList";
import { EmptyState, LoadErrorView, LoadingSkeleton } from "./StatusViews";
import { SummaryCards } from "./SummaryCards";

const RECENT_COUNT = 5;

export function DashboardView() {
  const { status, loadError, expenses, loadSampleData } = useExpenses();
  const { openAdd } = useExpenseDialog();
  const toast = useToast();
  const { openExport } = useExportDialog();
  const now = useMemo(() => new Date(), []);
  const summary = useMemo(() => summarize(expenses, now), [expenses, now]);
  const recent = useMemo(() => applyFilters(expenses, DEFAULT_FILTERS).slice(0, RECENT_COUNT), [expenses]);

  const header = (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted">An overview of where your money goes.</p>
      </div>
      {status === "ready" && expenses.length > 0 && (
        <button type="button" className={buttonStyles.secondary} onClick={() => openExport()}>
          <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
            <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
          </svg>
          Export
        </button>
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

  if (expenses.length === 0) {
    return (
      <>
        {header}
        <div className={card}>
          <EmptyState
            title="No expenses yet"
            message="Add your first expense to start seeing spending insights, or load some sample data to explore."
          >
            <button type="button" className={buttonStyles.primary} onClick={openAdd}>
              Add expense
            </button>
            <button
              type="button"
              className={buttonStyles.secondary}
              onClick={() => {
                try {
                  loadSampleData();
                  toast.show("Sample data loaded");
                } catch (err) {
                  toast.show(err instanceof Error ? err.message : "Couldn't load sample data.", { tone: "error" });
                }
              }}
            >
              Load sample data
            </button>
          </EmptyState>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="space-y-6">
        <SummaryCards summary={summary} currentMonth={monthKey(toIsoDate(now))} />

        <div className="grid gap-6 lg:grid-cols-5">
          <section className={`${card} p-5 lg:col-span-3`} aria-labelledby="trend-heading">
            <h2 id="trend-heading" className="text-base font-semibold text-ink">
              Monthly spending
            </h2>
            <p className="mb-6 text-sm text-ink-soft">Last {TREND_MONTHS} months</p>
            <MonthlyTrend data={summary.byMonth} />
          </section>
          <section className={`${card} p-5 lg:col-span-2`} aria-labelledby="cat-heading">
            <h2 id="cat-heading" className="text-base font-semibold text-ink">
              Spending by category
            </h2>
            <p className="mb-6 text-sm text-ink-soft">All time</p>
            <CategoryBreakdown data={summary.byCategory} />
          </section>
        </div>

        <section className={card} aria-labelledby="recent-heading">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 id="recent-heading" className="text-base font-semibold text-ink">
              Recent expenses
            </h2>
            <Link href="/expenses/" className="text-sm font-medium text-accent hover:underline">
              View all →
            </Link>
          </div>
          <div className="border-t border-line">
            <ExpenseList expenses={recent} limit={RECENT_COUNT} />
          </div>
        </section>
      </div>
    </>
  );
}
