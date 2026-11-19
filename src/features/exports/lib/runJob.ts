import type { Expense } from "@/features/expenses/domain/types";
import { downloadFile } from "@/features/expenses/lib/download";
import { DESTINATIONS, simulatedShareUrl } from "../domain/destinations";
import { TEMPLATES, type ExportArtifact } from "../domain/templates";
import type { ExportRequest, HistoryEntry } from "./types";

export type StepState = "pending" | "active" | "done" | "failed";

export type StepKind = "generate" | "fingerprint" | "deliver";

export interface JobStep {
  kind: StepKind;
  label: string;
  state: StepState;
  simulated: boolean;
}

export interface JobDeps {
  now: () => Date;
  newId: () => string;
  /** Only used to pace simulated delivery so the flow is visible. */
  sleep: (ms: number) => Promise<void>;
  download: (parts: BlobPart[], type: string, filename: string) => void;
  shareFile: (file: File) => Promise<void>;
  digest: (text: string) => Promise<string>;
}

/** Time a simulated delivery "takes". */
export const SIMULATED_DELIVERY_MS = 1400;

export async function sha256Hex(text: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [new File([""], "probe.csv", { type: "text/csv" })] });
  } catch {
    return false;
  }
}

export const browserJobDeps: JobDeps = {
  now: () => new Date(),
  newId: () => crypto.randomUUID(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  download: downloadFile,
  shareFile: (file) => navigator.share({ files: [file], title: file.name }),
  digest: sha256Hex,
};

export function planSteps(request: ExportRequest): JobStep[] {
  const destination = DESTINATIONS[request.destinationId];
  const generate: JobStep = {
    kind: "generate",
    label: `Generating ${TEMPLATES[request.templateId].name.toLowerCase()}`,
    state: "pending",
    simulated: false,
  };
  const fingerprint: JobStep = {
    kind: "fingerprint",
    label: "Fingerprinting (SHA-256)",
    state: "pending",
    simulated: false,
  };
  const deliver: JobStep = {
    kind: "deliver",
    label: destination.deliveryStep,
    state: "pending",
    simulated: destination.mode === "simulated",
  };
  // Browsers only allow the share sheet shortly after a click, so share before the async hash.
  return request.destinationId === "device" ? [generate, deliver, fingerprint] : [generate, fingerprint, deliver];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function describeError(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") return "Sharing was cancelled.";
  if (err instanceof DOMException && err.name === "NotAllowedError") return "The browser blocked sharing.";
  return "Something went wrong while exporting.";
}

/**
 * Run one export end to end, reporting step progress. Never throws: failures come back as a
 * "failed" history entry so they're recorded and shown like any other run.
 */
export async function executeExport(
  expenses: readonly Expense[],
  request: ExportRequest,
  deps: JobDeps,
  onProgress: (steps: JobStep[]) => void,
): Promise<HistoryEntry> {
  const destination = DESTINATIONS[request.destinationId];
  const steps = planSteps(request);
  const update = (index: number, state: StepState) => {
    steps[index] = { ...steps[index], state };
    onProgress([...steps]);
  };

  const entry: HistoryEntry = {
    id: deps.newId(),
    request,
    status: "completed",
    simulated: destination.mode === "simulated",
    createdAt: deps.now().toISOString(),
    filename: "",
    recordCount: 0,
    bytes: 0,
    checksum: null,
    shareUrl: null,
    expiresAt: null,
    error: null,
  };

  let artifact: ExportArtifact | null = null;
  const run: Record<StepKind, () => Promise<void> | void> = {
    generate: () => {
      artifact = TEMPLATES[request.templateId].build(expenses, request.params, deps.now());
      entry.filename = artifact.filename;
      entry.recordCount = artifact.recordCount;
      entry.bytes = new TextEncoder().encode(artifact.content).length;
    },
    fingerprint: async () => {
      entry.checksum = await deps.digest(artifact!.content);
    },
    deliver: async () => {
      const file = artifact!;
      if (destination.id === "download") {
        deps.download([file.content], file.mimeType, file.filename);
      } else if (destination.id === "device") {
        await deps.shareFile(new File([file.content], file.filename, { type: file.mimeType }));
      } else {
        await deps.sleep(SIMULATED_DELIVERY_MS);
        if (destination.id === "share-link") {
          entry.shareUrl = simulatedShareUrl(deps.newId().replace(/-/g, "").slice(0, 12));
          entry.expiresAt = new Date(deps.now().getTime() + (request.expiryDays ?? 7) * DAY_MS).toISOString();
        }
      }
    },
  };

  for (let i = 0; i < steps.length; i++) {
    try {
      update(i, "active");
      await run[steps[i].kind]();
      update(i, "done");
    } catch (err) {
      console.error(
        "[exports] job failed",
        { template: request.templateId, destination: request.destinationId, step: steps[i].kind },
        err,
      );
      update(i, "failed");
      entry.status = "failed";
      entry.error = describeError(err);
      break;
    }
  }
  return entry;
}
