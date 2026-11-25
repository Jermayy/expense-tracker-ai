"use client";

import { useMemo } from "react";
import { buttonStyles, card } from "@/components/ui/styles";
import { formatMonthLong } from "../domain/dates";
import { formatCents } from "../domain/money";
import type { CategoryTotal } from "../lib/analytics";
import { TOP_CATEGORY_COUNT, monthlySpending } from "../lib/insights";
import { useExpenses } from "../state/ExpensesProvider";
import { BudgetStreakCard } from "./BudgetStreakCard";
import { categoryColor, categoryEmoji } from "./CategoryBadge";
import { useExpenseDialog } from "./ExpenseDialog";
import { SpendingDonut } from "./SpendingDonut";
import { EmptyState, LoadErrorView, LoadingSkeleton } from "./StatusViews";

/** This month at a glance: spending donut, top categories and the budget streak. */
export function MonthlyInsights({ now: nowProp }: { now?: Date }) {
  const { status, loadError, expenses } = useExpenses();
  const { openAdd } = useExpenseDialog();
  const now = useMemo(() => nowProp ?? new Date(), [nowProp]);
  const month = useMemo(() => monthlySpending(expenses, now), [expenses, now]);

  const header = (
    <div className="mb-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Monthly Insights</h1>
      <p className="mt-1 text-sm text-ink-muted">{formatMonthLong(month.month)}</p>
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

  const addButton = (
    <button type="button" className={buttonStyles.primary} onClick={openAdd}>
      Add expense
    </button>
  );

  if (expenses.length === 0) {
    return (
      <>
        {header}
        <div className={`${card} mx-auto max-w-xl`}>
          <EmptyState title="No expenses yet" message="Add an expense to see where your money goes this month.">
            {addButton}
          </EmptyState>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="mx-auto max-w-xl space-y-6">
        <section className={`${card} p-6`} aria-labelledby="insights-spending-heading">
          <h2 id="insights-spending-heading" className="sr-only">
            Spending by category
          </h2>
          {month.count === 0 ? (
            <EmptyState title="No spending yet this month" message="Expenses you add this month will show up here.">
              {addButton}
            </EmptyState>
          ) : (
            <>
              <SpendingDonut data={month.byCategory} totalCents={month.totalCents} />
              <h3 className="mb-3 mt-8 text-sm font-semibold text-ink">Top {TOP_CATEGORY_COUNT} categories</h3>
              <TopCategories data={month.top} />
            </>
          )}
        </section>

        <BudgetStreakCard expenses={expenses} monthTotalCents={month.totalCents} now={now} />
      </div>
    </>
  );
}

function TopCategories({ data }: { data: CategoryTotal[] }) {
  return (
    <ol className="space-y-3">
      {data.map((d) => (
        <li
          key={d.category}
          className="flex items-center gap-3 border-l-4 py-1.5 pl-3"
          style={{ borderColor: categoryColor(d.category) }}
        >
          <span aria-hidden className="text-xl leading-none">
            {categoryEmoji(d.category)}
          </span>
          <span className="font-medium text-ink">{d.category}</span>
          <span className="ml-auto font-semibold tabular-nums text-ink">{formatCents(d.totalCents)}</span>
        </li>
      ))}
    </ol>
  );
}
