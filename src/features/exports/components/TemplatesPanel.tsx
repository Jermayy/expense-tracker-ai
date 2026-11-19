"use client";

import { useMemo } from "react";
import { buttonStyles, card } from "@/components/ui/styles";
import { useExpenses } from "@/features/expenses/state/ExpensesProvider";
import { formatRelative } from "../domain/format";
import { TEMPLATE_IDS, TEMPLATES, type TemplateId } from "../domain/templates";
import { useExportHub } from "../state/ExportHubProvider";

const ICONS: Record<TemplateId, string> = {
  "tax-report":
    "M4 2.75A.75.75 0 0 1 4.75 2h7.69a.75.75 0 0 1 .53.22l2.81 2.81c.14.14.22.33.22.53v11.69a.75.75 0 0 1-.75.75H4.75a.75.75 0 0 1-.75-.75V2.75ZM7 9.25a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5H7Zm0 3a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5H7Z",
  "monthly-summary":
    "M5.25 2a.75.75 0 0 1 .75.75V4h8V2.75a.75.75 0 0 1 1.5 0V4h.25A2.25 2.25 0 0 1 18 6.25v9.5A2.25 2.25 0 0 1 15.75 18H4.25A2.25 2.25 0 0 1 2 15.75v-9.5A2.25 2.25 0 0 1 4.25 4h.25V2.75A.75.75 0 0 1 5.25 2ZM3.5 8.5v7.25c0 .41.34.75.75.75h11.5a.75.75 0 0 0 .75-.75V8.5h-13Z",
  "category-analysis": "M10 2a8 8 0 1 0 8 8h-8V2Zm1.5.14V8.5h6.36A6.51 6.51 0 0 0 11.5 2.14Z",
  "full-data":
    "M10 2c-3.87 0-7 1.34-7 3v10c0 1.66 3.13 3 7 3s7-1.34 7-3V5c0-1.66-3.13-3-7-3Zm5.5 7.47C14.2 10.4 12.24 11 10 11s-4.2-.6-5.5-1.53V7.53C5.8 8.4 7.76 9 10 9s4.2-.6 5.5-1.47v1.94Z",
};

export function TemplatesPanel({ onRun }: { onRun: (id: TemplateId) => void }) {
  const { expenses } = useExpenses();
  const { state, now } = useExportHub();
  const counts = useMemo(
    () => Object.fromEntries(TEMPLATE_IDS.map((id) => [id, TEMPLATES[id].build(expenses, {}, now).recordCount])),
    [expenses, now],
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {TEMPLATE_IDS.map((id) => {
        const template = TEMPLATES[id];
        const last = state.history.find((h) => h.request.templateId === id && h.status === "completed");
        return (
          <article key={id} className={`${card} flex flex-col p-5`}>
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" clipRule="evenodd" d={ICONS[id]} />
                </svg>
              </span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-muted">
                {template.format}
              </span>
            </div>
            <h3 className="mt-4 text-base font-semibold text-ink">{template.name}</h3>
            <p className="mt-1 text-sm text-ink-muted">{template.tagline}</p>
            <p className="mt-3 text-xs text-ink-soft">
              <span className="font-medium text-ink-muted">Best for:</span> {template.useCase}
            </p>
            <div className="mt-auto flex items-center justify-between gap-3 pt-5">
              <p className="text-xs text-ink-soft">
                {counts[id]} expenses
                {last ? ` · last run ${formatRelative(new Date(last.createdAt), now)}` : ""}
              </p>
              <button
                type="button"
                className={buttonStyles.secondary}
                onClick={() => onRun(id)}
                aria-label={`Export ${template.name}`}
              >
                Export
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
