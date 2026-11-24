"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { buttonStyles } from "@/components/ui/styles";
import { formatDate, toIsoDate } from "../domain/dates";
import {
  BACKUP_RECORDED_EVENT,
  SNOOZE_DAYS,
  isReminderDue,
  loadBackupState,
  recordBackup,
  snoozeReminder,
  type BackupState,
} from "../lib/backupReminder";
import { useExpenses } from "../state/ExpensesProvider";

/** Dashboard nudge to download a full backup when the last one is getting old. */
export function BackupReminder({ now = () => new Date() }: { now?: () => Date }) {
  const { status, expenses } = useExpenses();
  const toast = useToast();
  // Read after mount: storage isn't available while the static page is prerendered.
  const [state, setState] = useState<BackupState | null>(null);

  useEffect(() => {
    const refresh = () => setState(loadBackupState());
    refresh();
    window.addEventListener(BACKUP_RECORDED_EVENT, refresh);
    return () => window.removeEventListener(BACKUP_RECORDED_EVENT, refresh);
  }, []);

  if (status !== "ready" || !state || !isReminderDue(state, expenses, now())) return null;

  async function downloadBackup() {
    try {
      const at = now();
      // Loaded on click so the dashboard doesn't carry the export code until it's needed.
      const { downloadFullBackup } = await import("../export/fullBackup");
      const count = downloadFullBackup(expenses, at);
      recordBackup(at);
      toast.show(`Backed up ${count} ${count === 1 ? "expense" : "expenses"}`);
    } catch (err) {
      console.error("[backup] download failed", err);
      toast.show("Backup failed. Please try again.", { tone: "error" });
    }
  }

  function snooze() {
    if (!snoozeReminder(now())) toast.show("Couldn't save that. The reminder may show again.", { tone: "error" });
    setState(loadBackupState());
  }

  return (
    <section
      aria-labelledby="backup-reminder-heading"
      className="border-accent/40 mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-accent-soft p-4"
    >
      <div className="min-w-0">
        <h2 id="backup-reminder-heading" className="text-sm font-semibold text-ink">
          Time to back up your expenses
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          They&apos;re only stored in this browser, which can clear them.{" "}
          {state.lastBackupAt
            ? `Last backup: ${formatDate(toIsoDate(new Date(state.lastBackupAt)))}.`
            : "You haven't backed up yet."}
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" className={buttonStyles.ghost} onClick={snooze}>
          Remind me in {SNOOZE_DAYS} days
        </button>
        <button type="button" className={buttonStyles.primary} onClick={downloadBackup}>
          Download backup
        </button>
      </div>
    </section>
  );
}
