"use client";

import { useId, useState } from "react";
import { buttonStyles, card, iconButton, inputBase, labelBase } from "@/components/ui/styles";
import { DESTINATIONS, type DestinationId } from "../domain/destinations";
import { formatDateTime, formatRelative } from "../domain/format";
import { FREQUENCIES, isDue, nextRunAt, type Frequency } from "../domain/schedule";
import { TEMPLATE_IDS, TEMPLATES, type TemplateId } from "../domain/templates";
import { useExportHub } from "../state/ExportHubProvider";
import { DemoBadge, ServiceTile } from "./ServiceTile";

/** Destinations a schedule can use: ones that need no per-run input (recipient, share sheet). */
function schedulableDestinations(connections: object): DestinationId[] {
  return ["download", ...(["google-sheets", "dropbox", "onedrive"] as const).filter((d) => d in connections)];
}

export function SchedulesPanel() {
  const id = useId();
  const hub = useExportHub();
  const destinations = schedulableDestinations(hub.state.connections);
  const [templateId, setTemplateId] = useState<TemplateId>("full-data");
  const [destinationId, setDestinationId] = useState<DestinationId>("download");
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const chosenDestination = destinations.includes(destinationId) ? destinationId : "download";

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <form
        className={`${card} space-y-4 self-start p-5`}
        onSubmit={(e) => {
          e.preventDefault();
          hub.addSchedule({ templateId, destinationId: chosenDestination, frequency });
        }}
      >
        <h3 className="text-base font-semibold text-ink">New schedule</h3>
        <div>
          <label htmlFor={`${id}-t`} className={labelBase}>
            Template
          </label>
          <select
            id={`${id}-t`}
            className={inputBase}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value as TemplateId)}
          >
            {TEMPLATE_IDS.map((t) => (
              <option key={t} value={t}>
                {TEMPLATES[t].name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-d`} className={labelBase}>
            Destination
          </label>
          <select
            id={`${id}-d`}
            className={inputBase}
            value={chosenDestination}
            onChange={(e) => setDestinationId(e.target.value as DestinationId)}
          >
            {destinations.map((d) => (
              <option key={d} value={d}>
                {DESTINATIONS[d].name}
                {DESTINATIONS[d].mode === "simulated" ? " (demo)" : ""}
              </option>
            ))}
          </select>
          {destinations.length === 1 && (
            <p className="mt-1.5 text-xs text-ink-soft">Connect a cloud service in Destinations to schedule uploads.</p>
          )}
        </div>
        <div>
          <label htmlFor={`${id}-f`} className={labelBase}>
            Repeat
          </label>
          <select
            id={`${id}-f`}
            className={inputBase}
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Frequency)}
          >
            {(Object.keys(FREQUENCIES) as Frequency[]).map((f) => (
              <option key={f} value={f}>
                {FREQUENCIES[f]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={`${buttonStyles.primary} w-full`}>
          Add schedule
        </button>
        <p className="text-xs text-ink-soft">
          Spendwise runs in your browser, so schedules can&apos;t run while it&apos;s closed. When one is due,
          you&apos;ll see it here and in the header the next time you open the app.
        </p>
      </form>

      {hub.state.schedules.length === 0 ? (
        <div className={`${card} flex flex-col items-center justify-center gap-1 p-10 text-center`}>
          <p className="text-sm font-semibold text-ink">No schedules yet</p>
          <p className="text-sm text-ink-muted">A weekly full-data backup is a good start.</p>
        </div>
      ) : (
        <ul className={`${card} divide-y divide-line`} aria-label="Schedules">
          {hub.state.schedules.map((s) => {
            const d = DESTINATIONS[s.destinationId];
            const due = isDue(s, hub.now);
            const next = nextRunAt(s);
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 p-4">
                <ServiceTile destination={d} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                    {TEMPLATES[s.templateId].name} → {d.name}
                    {d.mode === "simulated" && <DemoBadge />}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {FREQUENCIES[s.frequency]} ·{" "}
                    {!s.enabled ? (
                      "Paused"
                    ) : due ? (
                      <span className="font-semibold text-ink">Due now</span>
                    ) : (
                      <span title={formatDateTime(next)}>Next {formatRelative(next, hub.now)}</span>
                    )}
                    {s.lastRunAt && ` · last ran ${formatRelative(new Date(s.lastRunAt), hub.now)}`}
                  </p>
                </div>
                {due && (
                  <button type="button" className={buttonStyles.primary} onClick={() => hub.runSchedule(s.id)}>
                    Run now
                  </button>
                )}
                <label className="flex items-center gap-2 text-xs text-ink-muted">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={s.enabled}
                    onChange={(e) => hub.setScheduleEnabled(s.id, e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  Active
                </label>
                <button
                  type="button"
                  className={iconButton}
                  aria-label={`Delete ${TEMPLATES[s.templateId].name} schedule`}
                  onClick={() => hub.removeSchedule(s.id)}
                >
                  <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path
                      fillRule="evenodd"
                      d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.44c-.8.08-1.58.18-2.37.3a.75.75 0 1 0 .23 1.49l.15-.02.84 10.52A2.75 2.75 0 0 0 7.59 19h4.82a2.75 2.75 0 0 0 2.74-2.52l.84-10.52.15.02a.75.75 0 0 0 .23-1.49A41 41 0 0 0 14 4.19v-.44A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.67.03 2.5.08v-.33c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.33C8.33 4.03 9.16 4 10 4Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
