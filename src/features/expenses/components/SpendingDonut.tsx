import { LOCALE, formatCents } from "../domain/money";
import type { CategoryTotal } from "../lib/analytics";
import { CategoryDot, categoryColor } from "./CategoryBadge";

const percentFormatter = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 0 });

const SIZE = 200;
const STROKE = 34;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Gap between segments, in px along the ring, so neighbouring colours don't blur together. */
const GAP = 2;

/**
 * Donut of spending by category, drawn with one stroked circle per segment.
 * The whole chart is a single labelled image; colours follow the category's fixed slot.
 */
export function SpendingDonut({ data, totalCents }: { data: CategoryTotal[]; totalCents: number }) {
  const label = `Spending by category: ${data
    .map((d) => `${d.category} ${formatCents(d.totalCents)} (${percentFormatter.format(d.share)})`)
    .join(", ")}.`;
  const gap = data.length > 1 ? GAP : 0;
  let offset = 0;

  return (
    <div>
      <div className="relative mx-auto aspect-square w-full max-w-60" role="img" aria-label={label}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full -rotate-90" aria-hidden>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--surface-2)" strokeWidth={STROKE} />
          {data.map((d) => {
            const length = d.share * CIRCUMFERENCE;
            const segment = (
              <circle
                key={d.category}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={categoryColor(d.category)}
                strokeWidth={STROKE}
                strokeDasharray={`${Math.max(length - gap, 0)} ${CIRCUMFERENCE}`}
                strokeDashoffset={-offset}
              />
            );
            offset += length;
            return segment;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
          <span className="text-sm font-medium text-ink-muted">Spending</span>
          <span className="text-xl font-semibold tabular-nums text-ink">{formatCents(totalCents)}</span>
        </div>
      </div>
      {/* Names every segment so colour is never the only cue. Hidden from assistive tech because
          the chart's accessible name already lists the same breakdown. */}
      <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-muted" aria-hidden>
        {data.map((d) => (
          <li key={d.category} className="flex items-center gap-1.5">
            <CategoryDot category={d.category} />
            {d.category}
            <span className="tabular-nums text-ink-soft">{percentFormatter.format(d.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
