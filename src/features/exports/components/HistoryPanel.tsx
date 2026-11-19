"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { buttonStyles, card } from "@/components/ui/styles";
import { DESTINATIONS } from "../domain/destinations";
import { formatBytes, formatDateTime, formatRelative } from "../domain/format";
import { TEMPLATES } from "../domain/templates";
import type { HistoryEntry } from "../lib/types";
import { useExportHub } from "../state/ExportHubProvider";
import { DemoBadge, ServiceTile } from "./ServiceTile";
import { ShareLinkDialog } from "./ShareLinkDialog";

function Fingerprint({ checksum }: { checksum: string | null }) {
  if (!checksum) return <span className="text-ink-soft">—</span>;
  return (
    <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-ink-muted" title={`SHA-256 ${checksum}`}>
      {checksum.slice(0, 8)}
      <span className="sr-only"> (SHA-256 fingerprint, first 8 characters)</span>
    </code>
  );
}

export function HistoryPanel() {
  const hub = useExportHub();
  const [confirmClear, setConfirmClear] = useState(false);
  const [shareEntry, setShareEntry] = useState<HistoryEntry | null>(null);
  const history = hub.state.history;

  if (history.length === 0) {
    return (
      <div className={`${card} flex flex-col items-center justify-center gap-1 p-10 text-center`}>
        <p className="text-sm font-semibold text-ink">No exports yet</p>
        <p className="text-sm text-ink-muted">Every export you run is logged here with a fingerprint you can verify.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">
          The fingerprint is a SHA-256 hash of the file. Anyone you send it to can check theirs matches (for example
          with <code className="font-mono text-xs">shasum -a 256</code>).
        </p>
        <button type="button" className={buttonStyles.ghost} onClick={() => setConfirmClear(true)}>
          Clear history
        </button>
      </div>
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[44rem] text-left text-sm">
          <caption className="sr-only">Export history, newest first</caption>
          <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Export
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Destination
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                When
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Size
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Fingerprint
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {history.map((h) => {
              const d = DESTINATIONS[h.request.destinationId];
              return (
                <tr key={h.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{TEMPLATES[h.request.templateId].name}</p>
                    <p className="max-w-[14rem] truncate text-xs text-ink-soft" title={h.filename}>
                      {h.filename || "—"}
                      {h.request.params.redact ? " · redacted" : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <ServiceTile destination={d} size="sm" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-ink">
                          {d.name} {h.simulated && <DemoBadge />}
                        </span>
                        {h.status === "failed" ? (
                          <span className="block text-xs text-danger">{h.error}</span>
                        ) : (
                          h.request.recipient && (
                            <span className="block text-xs text-ink-soft">to {h.request.recipient}</span>
                          )
                        )}
                      </span>
                    </span>
                  </td>
                  <td
                    className="whitespace-nowrap px-4 py-3 text-ink-muted"
                    title={formatDateTime(new Date(h.createdAt))}
                  >
                    {formatRelative(new Date(h.createdAt), hub.now)}
                    {h.request.scheduleId && <span className="block text-xs text-ink-soft">Scheduled</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-ink-muted">
                    {formatBytes(h.bytes)}
                    <span className="block text-xs text-ink-soft">{h.recordCount} expenses</span>
                  </td>
                  <td className="px-4 py-3">
                    <Fingerprint checksum={h.checksum} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {h.shareUrl && (
                      <button
                        type="button"
                        className="mr-3 text-xs font-semibold text-accent hover:underline"
                        onClick={() => setShareEntry(h)}
                      >
                        Link
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-xs font-semibold text-accent hover:underline"
                      onClick={() => hub.runExport({ ...h.request, scheduleId: undefined })}
                    >
                      {h.status === "failed" ? "Retry" : "Run again"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={confirmClear}
        title="Clear export history?"
        message="This removes the log of past exports from this browser. Files you've already saved are not affected."
        confirmLabel="Clear history"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          hub.clearHistory();
          setConfirmClear(false);
        }}
      />
      <ShareLinkDialog entry={shareEntry} onClose={() => setShareEntry(null)} />
    </div>
  );
}
