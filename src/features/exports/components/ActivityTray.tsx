"use client";

import { useState } from "react";
import { iconButton } from "@/components/ui/styles";
import { DESTINATIONS } from "../domain/destinations";
import { TEMPLATES } from "../domain/templates";
import type { HistoryEntry } from "../lib/types";
import { useExportHub, type Job } from "../state/ExportHubProvider";
import { ServiceTile } from "./ServiceTile";
import { ShareLinkDialog } from "./ShareLinkDialog";

/** Floating list of running and recent jobs, so exports feel like background work. */
export function ActivityTray() {
  const { jobs, dismissJob } = useExportHub();
  const [shareEntry, setShareEntry] = useState<HistoryEntry | null>(null);
  if (jobs.length === 0 && !shareEntry) return null;

  return (
    <>
      <section
        aria-label="Export activity"
        className="fixed bottom-24 left-4 z-40 w-[min(22rem,calc(100vw-2rem))] space-y-2 sm:bottom-4"
      >
        {jobs.slice(0, 3).map((job) => (
          <JobCard key={job.id} job={job} onDismiss={() => dismissJob(job.id)} onViewLink={setShareEntry} />
        ))}
      </section>
      <ShareLinkDialog entry={shareEntry} onClose={() => setShareEntry(null)} />
    </>
  );
}

function StepIcon({ state }: { state: Job["steps"][number]["state"] }) {
  if (state === "done")
    return (
      <svg aria-hidden viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-positive">
        <path d="M12.7 4.3a1 1 0 0 1 0 1.4l-5.5 5.5a1 1 0 0 1-1.4 0L3.3 8.7a1 1 0 1 1 1.4-1.4l1.8 1.8 4.8-4.8a1 1 0 0 1 1.4 0Z" />
      </svg>
    );
  if (state === "active")
    return (
      <span
        aria-hidden
        className="border-accent/30 h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-accent motion-reduce:animate-none"
      />
    );
  if (state === "failed")
    return (
      <span aria-hidden className="text-xs font-bold leading-none text-danger">
        ✕
      </span>
    );
  return <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-line" />;
}

const STEP_STATE_LABEL = { pending: "waiting", active: "in progress", done: "done", failed: "failed" } as const;

function JobCard({
  job,
  onDismiss,
  onViewLink,
}: {
  job: Job;
  onDismiss: () => void;
  onViewLink: (entry: HistoryEntry) => void;
}) {
  const destination = DESTINATIONS[job.request.destinationId];
  const title = TEMPLATES[job.request.templateId].name;
  const summary =
    job.status === "running"
      ? "Working…"
      : job.status === "failed"
        ? (job.entry?.error ?? "Failed")
        : `${destination.deliveredLabel}${job.entry?.simulated ? " (simulated)" : ""} · ${job.entry?.recordCount ?? 0} expenses`;

  return (
    <article
      className="animate-toast-in rounded-xl border border-line bg-surface p-3 shadow-lg"
      aria-busy={job.status === "running"}
    >
      <div className="flex items-start gap-3">
        <ServiceTile destination={destination} size="sm" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-ink">{title}</h3>
          <p className={`truncate text-xs ${job.status === "failed" ? "text-danger" : "text-ink-muted"}`}>{summary}</p>
        </div>
        {job.status !== "running" && (
          <button
            type="button"
            aria-label={`Dismiss ${title}`}
            className={`${iconButton} -m-1 h-7 w-7`}
            onClick={onDismiss}
          >
            <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        )}
      </div>
      <ol className="mt-2.5 space-y-1 border-t border-line pt-2.5">
        {job.steps.map((step) => (
          <li key={step.label} className="flex items-center gap-2 text-xs text-ink-muted">
            <span className="flex h-3.5 w-3.5 items-center justify-center">
              <StepIcon state={step.state} />
            </span>
            <span className={step.state === "active" ? "text-ink" : undefined}>{step.label}</span>
            {step.simulated && <span className="text-ink-soft">(simulated)</span>}
            <span className="sr-only">: {STEP_STATE_LABEL[step.state]}</span>
          </li>
        ))}
      </ol>
      {job.entry?.shareUrl && (
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-accent hover:underline"
          onClick={() => onViewLink(job.entry!)}
        >
          View link &amp; QR code
        </button>
      )}
    </article>
  );
}
