"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { buttonStyles } from "@/components/ui/styles";
import { useExpenses } from "@/features/expenses/state/ExpensesProvider";
import { LoadErrorView, LoadingSkeleton } from "@/features/expenses/components/StatusViews";
import { DESTINATIONS } from "../domain/destinations";
import { TEMPLATES, type TemplateId } from "../domain/templates";
import { useExportHub } from "../state/ExportHubProvider";
import { DestinationsPanel } from "./DestinationsPanel";
import { HistoryPanel } from "./HistoryPanel";
import { RunExportDialog } from "./RunExportDialog";
import { SchedulesPanel } from "./SchedulesPanel";
import { TemplatesPanel } from "./TemplatesPanel";

const TABS = {
  templates: "Templates",
  destinations: "Destinations",
  schedules: "Schedules",
  history: "History",
} as const;
type Tab = keyof typeof TABS;
const TAB_KEYS = Object.keys(TABS) as Tab[];
const isTab = (v: string | null): v is Tab => v !== null && v in TABS;

export function ExportsHub() {
  const id = useId();
  const searchParams = useSearchParams();
  const { status: expensesStatus, loadError } = useExpenses();
  const hub = useExportHub();
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get("tab");
    return isTab(t) ? t : "templates";
  });
  const [runTemplate, setRunTemplate] = useState<TemplateId | null>(null);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    templates: null,
    destinations: null,
    schedules: null,
    history: null,
  });

  // The URL mirrors the tab so it survives refresh and can be linked to.
  useEffect(() => {
    window.history.replaceState(null, "", tab === "templates" ? window.location.pathname : `?tab=${tab}`);
  }, [tab]);

  function onTabKey(e: React.KeyboardEvent) {
    const i = TAB_KEYS.indexOf(tab);
    const next =
      e.key === "ArrowRight"
        ? TAB_KEYS[(i + 1) % TAB_KEYS.length]
        : e.key === "ArrowLeft"
          ? TAB_KEYS[(i - 1 + TAB_KEYS.length) % TAB_KEYS.length]
          : e.key === "Home"
            ? TAB_KEYS[0]
            : e.key === "End"
              ? TAB_KEYS[TAB_KEYS.length - 1]
              : null;
    if (!next) return;
    e.preventDefault();
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  const header = (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Exports</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Templates, destinations, schedules and a log of everything you&apos;ve exported.
      </p>
    </div>
  );

  if (expensesStatus === "loading" || hub.status === "loading")
    return (
      <>
        {header}
        <LoadingSkeleton />
      </>
    );
  if (expensesStatus === "error")
    return (
      <>
        {header}
        <LoadErrorView message={loadError ?? "Unknown error."} />
      </>
    );

  return (
    <>
      {header}

      <div className="mb-6 flex gap-3 rounded-xl border border-dashed border-line bg-surface p-4 text-sm text-ink-muted">
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-accent">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.25v3.25a.75.75 0 0 0 1.5 0V9.75A.75.75 0 0 0 10 9H9Z"
            clipRule="evenodd"
          />
        </svg>
        <p>
          <strong className="font-semibold text-ink">Cloud features are a demo.</strong> Download and Share via device
          make real files. Email, share links and cloud services marked <em>Demo</em> only show the flow: nothing leaves
          this device.
        </p>
      </div>

      {hub.dueSchedules.length > 0 && (
        <section aria-label="Due exports" className="mb-6 space-y-2">
          {hub.dueSchedules.map((s) => (
            <div
              key={s.id}
              className="border-accent/40 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-accent-soft p-4"
            >
              <p className="text-sm text-ink">
                <span className="font-semibold">Scheduled export due:</span> {TEMPLATES[s.templateId].name} to{" "}
                {DESTINATIONS[s.destinationId].name}
              </p>
              <button type="button" className={buttonStyles.primary} onClick={() => hub.runSchedule(s.id)}>
                Run now
              </button>
            </div>
          ))}
        </section>
      )}

      <div
        role="tablist"
        aria-label="Export sections"
        className="mb-6 flex gap-1 overflow-x-auto border-b border-line"
        onKeyDown={onTabKey}
      >
        {TAB_KEYS.map((t) => {
          const count = t === "history" ? hub.state.history.length : t === "schedules" ? hub.state.schedules.length : 0;
          return (
            <button
              key={t}
              ref={(el) => {
                tabRefs.current[t] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${t}`}
              aria-selected={tab === t}
              aria-controls={`${id}-panel`}
              tabIndex={tab === t ? 0 : -1}
              onClick={() => setTab(t)}
              className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === t ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {TABS[t]}
              {count > 0 && (
                <span className="rounded-full bg-surface-2 px-1.5 text-xs tabular-nums text-ink-soft">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`}>
        {tab === "templates" && <TemplatesPanel onRun={setRunTemplate} />}
        {tab === "destinations" && <DestinationsPanel />}
        {tab === "schedules" && <SchedulesPanel />}
        {tab === "history" && <HistoryPanel />}
      </div>

      <RunExportDialog templateId={runTemplate} onClose={() => setRunTemplate(null)} />
    </>
  );
}
