import type { DestinationId, ShareLinkExpiryDays } from "../domain/destinations";
import type { Schedule } from "../domain/schedule";
import type { TemplateId, TemplateParams } from "../domain/templates";

/** Everything needed to run (or re-run) an export. */
export interface ExportRequest {
  templateId: TemplateId;
  destinationId: DestinationId;
  params: TemplateParams;
  recipient?: string;
  message?: string;
  expiryDays?: ShareLinkExpiryDays;
  scheduleId?: string;
}

export interface HistoryEntry {
  id: string;
  request: ExportRequest;
  status: "completed" | "failed";
  /** True when delivery was only simulated; the file itself was still generated. */
  simulated: boolean;
  /** UTC ISO timestamp. */
  createdAt: string;
  filename: string;
  recordCount: number;
  bytes: number;
  /** SHA-256 of the file, hex. Lets a recipient check they got exactly this file. */
  checksum: string | null;
  shareUrl: string | null;
  expiresAt: string | null;
  error: string | null;
}

export interface Connection {
  connectedAt: string;
}

export interface HubState {
  connections: Partial<Record<DestinationId, Connection>>;
  schedules: Schedule[];
  history: HistoryEntry[];
}

export const EMPTY_HUB_STATE: HubState = { connections: {}, schedules: [], history: [] };
