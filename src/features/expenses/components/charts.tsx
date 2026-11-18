"use client";

import { useState } from "react";
import { formatMonthLong, formatMonthShort } from "../domain/dates";
import { LOCALE, formatCents, formatCentsCompact } from "../domain/money";
import type { CategoryTotal, MonthTotal } from "../lib/analytics";
import { CategoryDot, categoryColor } from "./CategoryBadge";

const percentFormatter = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 0 });

/** Horizontal bars, largest first, each direct-labelled so colour is never the only cue. */
export function CategoryBreakdown({ data }: { data: CategoryTotal[] }) {
  const max = Math.max(...data.map((d) => d.totalCents), 1);
  return (
    <ul className="space-y-4">
      {data.map((d) => (
        <li key={d.category}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 font-medium text-ink">
              <CategoryDot category={d.category} />
              {d.category}
              <span className="text-xs font-normal text-ink-soft">
                {d.count} {d.count === 1 ? "expense" : "expenses"}
              </span>
            </span>
            <span className="tabular-nums text-ink">
              <span className="font-semibold">{formatCents(d.totalCents)}</span>
              <span className="ml-2 inline-block w-10 text-right text-ink-soft">
                {percentFormatter.format(d.share)}
              </span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div
              className="h-2 rounded-full"
              style={{ width: `${(d.totalCents / max) * 100}%`, backgroundColor: categoryColor(d.category) }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Round the axis maximum up to 1, 2 or 5 × a power of ten so tick labels are readable. */
export function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((s) => s * magnitude >= value)!;
  return step * magnitude;
}

const TICKS = 4;

/** Single-series column chart of monthly totals with a per-bar hover/focus tooltip. */
export function MonthlyTrend({ data }: { data: MonthTotal[] }) {
  const [active, setActive] = useState<number | null>(null);
  const axisMax = niceCeiling(Math.max(...data.map((d) => d.totalCents)));
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => (axisMax / TICKS) * i);
  const current = data.length - 1;

  return (
    <div>
      <div className="flex gap-3">
        {/* Y axis */}
        <div className="relative h-52 w-12 shrink-0 text-right text-xs tabular-nums text-ink-soft" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / axisMax) * 100}%` }}>
              {formatCentsCompact(t)}
            </span>
          ))}
        </div>

        {/* Plot */}
        <div className="relative h-52 flex-1" onMouseLeave={() => setActive(null)}>
          {ticks.map((t) => (
            <div
              key={t}
              aria-hidden
              className={`absolute inset-x-0 border-t ${t === 0 ? "border-ink-soft/50" : "border-dashed border-line"}`}
              style={{ bottom: `${(t / axisMax) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end">
            {data.map((d, i) => (
              <button
                key={d.month}
                type="button"
                aria-label={`${formatMonthLong(d.month)}: ${formatCents(d.totalCents)}, ${d.count} expenses`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="group relative flex h-full flex-1 cursor-default items-end justify-center px-[6%] focus:outline-none"
              >
                <span
                  className={`block w-full max-w-12 rounded-t transition-opacity ${
                    active !== null && active !== i ? "opacity-50" : ""
                  } group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-2`}
                  style={{
                    height: `${(d.totalCents / axisMax) * 100}%`,
                    minHeight: d.totalCents > 0 ? 2 : 0,
                    backgroundColor: "var(--accent)",
                  }}
                />
                {i === current && active === null && d.totalCents > 0 && (
                  <span
                    className="absolute whitespace-nowrap text-xs font-semibold tabular-nums text-ink"
                    style={{ bottom: `calc(${(d.totalCents / axisMax) * 100}% + 4px)` }}
                  >
                    {formatCentsCompact(d.totalCents)}
                  </span>
                )}
                {active === i && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs shadow-lg"
                    style={{ bottom: `calc(${Math.min((d.totalCents / axisMax) * 100, 75)}% + 8px)` }}
                  >
                    <span className="block font-medium text-ink-muted">{formatMonthLong(d.month)}</span>
                    <span className="block text-sm font-semibold tabular-nums text-ink">
                      {formatCents(d.totalCents)}
                    </span>
                    <span className="block text-ink-soft">
                      {d.count} {d.count === 1 ? "expense" : "expenses"}
                    </span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* X axis */}
      <div className="ml-[3.75rem] mt-2 flex text-xs text-ink-soft" aria-hidden>
        {data.map((d, i) => (
          <span key={d.month} className={`flex-1 text-center ${i === current ? "font-semibold text-ink" : ""}`}>
            {formatMonthShort(d.month)}
          </span>
        ))}
      </div>
    </div>
  );
}
