import { card } from "@/components/ui/styles";
import { formatDate } from "../domain/dates";
import { formatCents } from "../domain/money";
import type { Expense } from "../domain/types";
import { CategoryBadge } from "../components/CategoryBadge";
import { REDACTED, type ExportSummary } from "./options";

/** Rows rendered in the preview; the file always contains every matching record. */
export const PREVIEW_LIMIT = 50;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className="mt-1 truncate text-lg font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

export function ExportSummaryStats({ summary }: { summary: ExportSummary }) {
  const span =
    summary.firstDate && summary.lastDate
      ? summary.firstDate === summary.lastDate
        ? formatDate(summary.firstDate)
        : `${formatDate(summary.firstDate)} – ${formatDate(summary.lastDate)}`
      : "—";
  return (
    <dl className="grid gap-3 sm:grid-cols-[auto_auto_1fr]" aria-live="polite" aria-label="Export summary">
      <Stat label="Records" value={String(summary.count)} />
      <Stat label="Total" value={formatCents(summary.totalCents)} />
      <Stat label="Date span" value={span} />
    </dl>
  );
}

export function ExportPreviewTable({ records, redacted = false }: { records: readonly Expense[]; redacted?: boolean }) {
  if (records.length === 0) {
    return (
      <div className={`${card} flex h-64 flex-col items-center justify-center gap-1 px-6 text-center`}>
        <p className="text-sm font-semibold text-ink">No expenses match these options</p>
        <p className="text-sm text-ink-muted">Widen the date range or select more categories.</p>
      </div>
    );
  }

  const shown = records.slice(0, PREVIEW_LIMIT);
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="max-h-[26rem] overflow-auto" tabIndex={0} role="region" aria-label="Export preview">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Preview of the records that will be exported</caption>
          <thead className="sticky top-0 bg-surface-2 text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">
                Date
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Category
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Description
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap px-4 py-2 text-ink-muted">{formatDate(e.date)}</td>
                <td className="px-4 py-2">
                  <CategoryBadge category={e.category} />
                </td>
                <td
                  className={`max-w-[16rem] truncate px-4 py-2 ${redacted ? "italic text-ink-soft" : "text-ink"}`}
                  title={redacted ? undefined : e.description}
                >
                  {redacted ? REDACTED : e.description}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right font-medium tabular-nums text-ink">
                  {formatCents(e.amountCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {records.length > PREVIEW_LIMIT && (
        <p className="border-t border-line bg-surface-2 px-4 py-2 text-xs text-ink-muted">
          Showing the first {PREVIEW_LIMIT} of {records.length} records. The file includes all of them.
        </p>
      )}
    </div>
  );
}
