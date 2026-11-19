"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useToast } from "@/components/ui/Toast";
import { buttonStyles, card } from "@/components/ui/styles";
import { monthKey, toIsoDate } from "../domain/dates";
import { TREND_MONTHS, summarize } from "../lib/analytics";
import { applyFilters, DEFAULT_FILTERS } from "../lib/filters";
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
        <Link href="/exports/" className={buttonStyles.secondary}>
          Export &amp; share
        </Link>
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
