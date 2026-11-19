"use client";

import { useId, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { buttonStyles, inputBase, labelBase } from "@/components/ui/styles";
import { useExpenses } from "@/features/expenses/state/ExpensesProvider";
import {
  DESTINATION_IDS,
  DESTINATIONS,
  SHARE_LINK_EXPIRY_DAYS,
  isEmailAddress,
  type DestinationId,
  type ShareLinkExpiryDays,
} from "../domain/destinations";
import { formatBytes } from "../domain/format";
import {
  DEFAULT_SUMMARY_MONTHS,
  TEMPLATES,
  currentFinancialYear,
  financialYearLabel,
  type TemplateId,
  type TemplateParams,
} from "../domain/templates";
import { canShareFiles } from "../lib/runJob";
import { useExportHub } from "../state/ExportHubProvider";
import { DemoBadge, ServiceTile } from "./ServiceTile";

interface RunExportDialogProps {
  templateId: TemplateId | null;
  onClose: () => void;
}

export function RunExportDialog({ templateId, onClose }: RunExportDialogProps) {
  return (
    <Modal
      open={templateId !== null}
      title={templateId ? `Export ${TEMPLATES[templateId].name}` : ""}
      onClose={onClose}
    >
      {templateId && <RunExportForm templateId={templateId} onClose={onClose} />}
    </Modal>
  );
}

const SUMMARY_MONTH_OPTIONS = [3, 6, 12, 24];
const FY_OPTIONS = 4;

function RunExportForm({ templateId, onClose }: { templateId: TemplateId; onClose: () => void }) {
  const id = useId();
  const { expenses } = useExpenses();
  const hub = useExportHub();
  const template = TEMPLATES[templateId];
  const currentFy = currentFinancialYear(hub.now);

  const [destinationId, setDestinationId] = useState<DestinationId>("download");
  const [params, setParams] = useState<TemplateParams>({
    financialYear: currentFy,
    months: DEFAULT_SUMMARY_MONTHS,
    redact: false,
  });
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [expiryDays, setExpiryDays] = useState<ShareLinkExpiryDays>(7);
  const [connecting, setConnecting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const deviceShareSupported = useMemo(canShareFiles, []);

  const destination = DESTINATIONS[destinationId];
  const artifact = useMemo(() => template.build(expenses, params, hub.now), [template, expenses, params, hub.now]);
  const bytes = useMemo(() => new TextEncoder().encode(artifact.content).length, [artifact]);
  const needsConnect = destination.needsConnection && !hub.state.connections[destinationId];
  const recipientError =
    destinationId === "email" && !isEmailAddress(recipient) ? "Enter a valid email address." : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (recipientError || needsConnect) return;
    hub.runExport({
      templateId,
      destinationId,
      params: { ...params, redact: template.includesDescriptions ? params.redact : undefined },
      ...(destinationId === "email" ? { recipient: recipient.trim(), message: message.trim() || undefined } : {}),
      ...(destinationId === "share-link" ? { expiryDays } : {}),
    });
    onClose();
  }

  async function connect() {
    setConnecting(true);
    try {
      await hub.connect(destinationId);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <p className="-mt-3 text-sm text-ink-muted">{template.tagline}.</p>

      {templateId === "tax-report" && (
        <div>
          <label htmlFor={`${id}-fy`} className={labelBase}>
            Financial year
          </label>
          <select
            id={`${id}-fy`}
            className={inputBase}
            value={params.financialYear}
            onChange={(e) => setParams((p) => ({ ...p, financialYear: Number(e.target.value) }))}
          >
            {Array.from({ length: FY_OPTIONS }, (_, i) => currentFy - i).map((fy) => (
              <option key={fy} value={fy}>
                {financialYearLabel(fy)} (1 Jul {fy - 1} – 30 Jun {fy}){fy === currentFy ? " · current" : ""}
              </option>
            ))}
          </select>
        </div>
      )}
      {templateId === "monthly-summary" && (
        <div>
          <label htmlFor={`${id}-months`} className={labelBase}>
            Period
          </label>
          <select
            id={`${id}-months`}
            className={inputBase}
            value={params.months}
            onChange={(e) => setParams((p) => ({ ...p, months: Number(e.target.value) }))}
          >
            {SUMMARY_MONTH_OPTIONS.map((m) => (
              <option key={m} value={m}>
                Last {m} months
              </option>
            ))}
          </select>
        </div>
      )}

      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className={labelBase}>Send to</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DESTINATION_IDS.filter((d) => d !== "device" || deviceShareSupported).map((d) => {
            const dest = DESTINATIONS[d];
            const selected = d === destinationId;
            return (
              <label
                key={d}
                className={`has-[:focus-visible]:ring-accent/40 relative flex cursor-pointer flex-col gap-2 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-2 ${
                  selected ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2"
                }`}
              >
                <input
                  type="radio"
                  name={`${id}-dest`}
                  value={d}
                  checked={selected}
                  onChange={() => setDestinationId(d)}
                  data-autofocus={selected ? "" : undefined}
                  className="sr-only"
                />
                <ServiceTile destination={dest} size="sm" />
                <span className="text-sm font-semibold text-ink">{dest.name}</span>
                {dest.mode === "simulated" && (
                  <span className="absolute right-2 top-2">
                    <DemoBadge />
                  </span>
                )}
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-muted">{destination.description}</p>
      </fieldset>

      {needsConnect && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-line p-3">
          <p className="text-sm text-ink-muted">Connect {destination.name} to send exports there.</p>
          <button type="button" className={buttonStyles.secondary} onClick={connect} disabled={connecting}>
            {connecting ? "Connecting…" : `Connect ${destination.name}`}
          </button>
        </div>
      )}
      {submitted && needsConnect && (
        <p role="alert" className="-mt-3 text-sm text-danger">
          Connect {destination.name} first.
        </p>
      )}

      {destinationId === "email" && (
        <div className="space-y-3">
          <div>
            <label htmlFor={`${id}-to`} className={labelBase}>
              Recipient
            </label>
            <input
              id={`${id}-to`}
              type="email"
              autoComplete="email"
              placeholder="accountant@example.com"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              aria-invalid={submitted && recipientError ? true : undefined}
              aria-describedby={submitted && recipientError ? `${id}-to-error` : undefined}
              className={inputBase}
            />
            {submitted && recipientError && (
              <p id={`${id}-to-error`} className="mt-1.5 text-sm text-danger">
                {recipientError}
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`${id}-msg`} className={labelBase}>
              Message <span className="font-normal text-ink-soft">(optional)</span>
            </label>
            <textarea
              id={`${id}-msg`}
              rows={2}
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={inputBase}
            />
          </div>
        </div>
      )}

      {destinationId === "share-link" && (
        <div>
          <label htmlFor={`${id}-expiry`} className={labelBase}>
            Link expires after
          </label>
          <select
            id={`${id}-expiry`}
            className={inputBase}
            value={expiryDays}
            onChange={(e) => setExpiryDays(Number(e.target.value) as ShareLinkExpiryDays)}
          >
            {SHARE_LINK_EXPIRY_DAYS.map((d) => (
              <option key={d} value={d}>
                {d === 1 ? "1 day" : `${d} days`}
              </option>
            ))}
          </select>
        </div>
      )}

      <PrivacyPanel
        destinationId={destinationId}
        fields={template.fields}
        canRedact={template.includesDescriptions}
        redact={Boolean(params.redact)}
        onRedactChange={(redact) => setParams((p) => ({ ...p, redact }))}
      />

      <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-col-reverse gap-3 border-t border-line bg-surface px-6 pb-6 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted" aria-live="polite">
          {artifact.recordCount} {artifact.recordCount === 1 ? "expense" : "expenses"} · {template.format} ·{" "}
          {formatBytes(bytes)}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className={buttonStyles.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={buttonStyles.primary}>
            {destination.mode === "simulated" ? `${destination.name} (demo)` : destination.name}
          </button>
        </div>
      </div>
    </form>
  );
}

interface PrivacyPanelProps {
  destinationId: DestinationId;
  fields: readonly string[];
  canRedact: boolean;
  redact: boolean;
  onRedactChange: (redact: boolean) => void;
}

function PrivacyPanel({ destinationId, fields, canRedact, redact, onRedactChange }: PrivacyPanelProps) {
  const id = useId();
  const destination = DESTINATIONS[destinationId];
  const headline =
    destinationId === "download"
      ? "Saved to this device only."
      : destinationId === "device"
        ? "Goes to the app you choose in the share sheet."
        : destinationId === "share-link"
          ? "Demo: nothing leaves this device. A live version would publish these fields to anyone with the link."
          : `Demo: nothing leaves this device. A live version would send these fields to ${destination.name}.`;

  return (
    <section aria-labelledby={`${id}-h`} className="rounded-lg bg-surface-2 p-4">
      <h3 id={`${id}-h`} className="flex items-center gap-2 text-sm font-semibold text-ink">
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-ink-soft">
          <path
            fillRule="evenodd"
            d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
            clipRule="evenodd"
          />
        </svg>
        What&apos;s in the file
      </h3>
      <p className="mt-1 text-xs text-ink-muted">{headline}</p>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Fields included">
        {fields.map((f) => {
          const removed = redact && f === "Description";
          return (
            <li
              key={f}
              className={`rounded-full border border-line px-2 py-0.5 text-xs ${
                removed ? "text-ink-soft line-through" : "bg-surface text-ink"
              }`}
            >
              {f}
              {removed && <span className="sr-only"> (redacted)</span>}
            </li>
          );
        })}
      </ul>
      {canRedact && (
        <label htmlFor={`${id}-redact`} className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-ink">
          <input
            id={`${id}-redact`}
            type="checkbox"
            checked={redact}
            onChange={(e) => onRedactChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
          />
          <span>
            Redact descriptions
            <span className="block text-xs text-ink-muted">
              Share amounts and categories without revealing what you bought.
            </span>
          </span>
        </label>
      )}
    </section>
  );
}
