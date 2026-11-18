import { card } from "@/components/ui/styles";
import { formatMonthLong } from "../domain/dates";
import { LOCALE, formatCents } from "../domain/money";
import type { SpendingSummary } from "../lib/analytics";
import { CategoryDot } from "./CategoryBadge";

const percentFormatter = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 0 });

function StatCard({ label, value, detail }: { label: string; value: React.ReactNode; detail: React.ReactNode }) {
  return (
    <div className={`${card} p-5`}>
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold tabular-nums tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-sm text-ink-soft">{detail}</p>
    </div>
  );
}

function MonthChange({ change }: { change: number | null }) {
  if (change === null) return <>No spending last month</>;
  if (Math.abs(change) < 0.005) return <>Same as last month</>;
  const up = change > 0;
  return (
    <>
      <span aria-hidden className="mr-1">
        {up ? "↑" : "↓"}
      </span>
      {percentFormatter.format(Math.abs(change))} {up ? "more" : "less"} than last month
    </>
  );
}

export function SummaryCards({ summary, currentMonth }: { summary: SpendingSummary; currentMonth: string }) {
  const top = summary.byCategory[0];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Total spending"
        value={formatCents(summary.totalCents)}
        detail={`${summary.count} ${summary.count === 1 ? "expense" : "expenses"} recorded`}
      />
      <StatCard
        label={formatMonthLong(currentMonth)}
        value={formatCents(summary.thisMonthCents)}
        detail={<MonthChange change={summary.monthOverMonth} />}
      />
      <StatCard
        label="Daily average"
        value={formatCents(summary.dailyAverageThisMonthCents)}
        detail="Per day so far this month"
      />
      <StatCard
        label="Top category"
        value={
          top ? (
            <span className="flex items-center gap-2">
              <CategoryDot category={top.category} />
              {top.category}
            </span>
          ) : (
            "—"
          )
        }
        detail={
          top ? `${formatCents(top.totalCents)} · ${percentFormatter.format(top.share)} of total` : "No expenses yet"
        }
      />
    </div>
  );
}
