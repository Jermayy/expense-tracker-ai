"use client";

import Link from "next/link";
import { useExportHub } from "../state/ExportHubProvider";

/** Header pill: what the export system is doing right now. */
export function SyncStatus() {
  const { status, jobs, dueSchedules, state } = useExportHub();
  if (status !== "ready") return null;

  const running = jobs.filter((j) => j.status === "running").length;
  const connected = Object.keys(state.connections).length;
  const [dot, label] =
    running > 0
      ? ["bg-accent animate-pulse motion-reduce:animate-none", `Exporting ${running}…`]
      : dueSchedules.length > 0
        ? ["bg-[var(--cat-4)]", `${dueSchedules.length} export${dueSchedules.length === 1 ? "" : "s"} due`]
        : connected > 0
          ? ["bg-positive", `${connected} connected · demo`]
          : ["bg-ink-soft", "Local only"];

  return (
    <Link
      href="/exports/"
      className="hidden items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink md:inline-flex"
      aria-label={`Export status: ${label}. Open exports.`}
    >
      <span aria-hidden className={`h-2 w-2 rounded-full ${dot}`} />
      <span>{label}</span>
    </Link>
  );
}
