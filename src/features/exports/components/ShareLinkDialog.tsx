"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { buttonStyles, inputBase } from "@/components/ui/styles";
import { formatDateTime } from "../domain/format";
import { TEMPLATES } from "../domain/templates";
import type { HistoryEntry } from "../lib/types";
import { QrPreview } from "./QrPreview";

export function ShareLinkDialog({ entry, onClose }: { entry: HistoryEntry | null; onClose: () => void }) {
  return (
    <Modal open={entry !== null} title="Share link" onClose={onClose}>
      {entry?.shareUrl && <ShareLinkBody entry={entry} url={entry.shareUrl} onClose={onClose} />}
    </Modal>
  );
}

function ShareLinkBody({ entry, url, onClose }: { entry: HistoryEntry; url: string; onClose: () => void }) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopy("copied");
    } catch (err) {
      console.warn("[exports] clipboard write failed", err);
      setCopy("failed");
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-dashed border-line bg-surface-2 p-3 text-sm text-ink-muted">
        <strong className="font-semibold text-ink">Demo.</strong> Share links need a server, which this app doesn&apos;t
        have. This shows the flow; the link doesn&apos;t work and nothing was uploaded.
      </div>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <QrPreview value={url} />
        <dl className="min-w-0 flex-1 space-y-2 text-sm">
          <div>
            <dt className="text-xs text-ink-soft">File</dt>
            <dd className="truncate font-medium text-ink">
              {TEMPLATES[entry.request.templateId].name} · {entry.filename}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">Access</dt>
            <dd className="text-ink">
              Anyone with the link can view{entry.request.params.redact ? " (descriptions redacted)" : ""}
            </dd>
          </div>
          {entry.expiresAt && (
            <div>
              <dt className="text-xs text-ink-soft">Expires</dt>
              <dd className="text-ink">{formatDateTime(new Date(entry.expiresAt))}</dd>
            </div>
          )}
        </dl>
      </div>
      <div className="flex gap-2">
        <label htmlFor="share-url" className="sr-only">
          Share link
        </label>
        <input id="share-url" readOnly value={url} className={inputBase} onFocus={(e) => e.target.select()} />
        <button type="button" className={buttonStyles.secondary} onClick={copyLink} data-autofocus="">
          {copy === "copied" ? "Copied" : "Copy"}
        </button>
      </div>
      {copy === "failed" && (
        <p role="alert" className="-mt-3 text-sm text-danger">
          Couldn&apos;t copy. Select the link and copy it manually.
        </p>
      )}
      <div className="flex justify-end">
        <button type="button" className={buttonStyles.primary} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
