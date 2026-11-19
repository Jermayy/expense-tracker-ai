"use client";

import { useMemo, useState } from "react";
import { buttonStyles, card } from "@/components/ui/styles";
import { DESTINATION_IDS, DESTINATIONS, type DestinationId } from "../domain/destinations";
import { formatRelative } from "../domain/format";
import { canShareFiles } from "../lib/runJob";
import { useExportHub } from "../state/ExportHubProvider";
import { DemoBadge, ServiceTile } from "./ServiceTile";

export function DestinationsPanel() {
  const hub = useExportHub();
  const [pending, setPending] = useState<DestinationId | null>(null);
  const deviceShareSupported = useMemo(canShareFiles, []);

  async function connect(id: DestinationId) {
    setPending(id);
    try {
      await hub.connect(id);
    } finally {
      setPending(null);
    }
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {DESTINATION_IDS.map((id) => {
        const d = DESTINATIONS[id];
        const connection = hub.state.connections[id];
        const lastSync = hub.state.history.find((h) => h.request.destinationId === id && h.status === "completed");
        const unsupported = id === "device" && !deviceShareSupported;

        let status: React.ReactNode;
        if (unsupported) status = <span className="text-ink-soft">Not supported in this browser</span>;
        else if (d.needsConnection && !connection) status = <span className="text-ink-soft">Not connected</span>;
        else
          status = (
            <span className="inline-flex items-center gap-1.5 text-positive">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-positive" />
              {d.needsConnection ? "Connected" : "Ready"}
              {lastSync && (
                <span className="text-ink-soft">
                  · last sync {formatRelative(new Date(lastSync.createdAt), hub.now)}
                </span>
              )}
            </span>
          );

        return (
          <li key={id} className={`${card} flex flex-col p-5`}>
            <div className="flex items-start justify-between gap-3">
              <ServiceTile destination={d} />
              {d.mode === "simulated" && <DemoBadge />}
            </div>
            <h3 className="mt-4 text-base font-semibold text-ink">{d.name}</h3>
            <p className="mt-1 text-sm text-ink-muted">{d.description}</p>
            <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-xs">
              {status}
              {d.needsConnection &&
                (connection ? (
                  <button type="button" className={buttonStyles.ghost} onClick={() => hub.disconnect(id)}>
                    Disconnect
                  </button>
                ) : (
                  <button
                    type="button"
                    className={buttonStyles.secondary}
                    onClick={() => connect(id)}
                    disabled={pending !== null}
                  >
                    {pending === id ? "Connecting…" : "Connect"}
                  </button>
                ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
