"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useExpenses } from "@/features/expenses/state/ExpensesProvider";
import { DESTINATIONS, type DestinationId } from "../domain/destinations";
import { isDue, type Frequency, type Schedule } from "../domain/schedule";
import { TEMPLATES, type TemplateId } from "../domain/templates";
import { loadHubState, MAX_HISTORY, saveHubState } from "../lib/hubStorage";
import { browserJobDeps, executeExport, planSteps, type JobDeps, type JobStep } from "../lib/runJob";
import { EMPTY_HUB_STATE, type ExportRequest, type HistoryEntry, type HubState } from "../lib/types";

export interface Job {
  id: string;
  request: ExportRequest;
  steps: JobStep[];
  status: "running" | "completed" | "failed";
  entry: HistoryEntry | null;
}

/** Time a simulated account connection "takes". */
export const SIMULATED_CONNECT_MS = 900;
/** How often due schedules are re-checked while the app is open. */
const DUE_CHECK_INTERVAL_MS = 60_000;

interface ExportHubApi {
  status: "loading" | "ready";
  state: HubState;
  jobs: Job[];
  now: Date;
  dueSchedules: Schedule[];
  runExport: (request: ExportRequest) => void;
  dismissJob: (id: string) => void;
  connect: (id: DestinationId) => Promise<void>;
  disconnect: (id: DestinationId) => void;
  addSchedule: (input: { templateId: TemplateId; destinationId: DestinationId; frequency: Frequency }) => void;
  setScheduleEnabled: (id: string, enabled: boolean) => void;
  removeSchedule: (id: string) => void;
  runSchedule: (id: string) => void;
  clearHistory: () => void;
}

const ExportHubContext = createContext<ExportHubApi | null>(null);

interface ExportHubProviderProps {
  children: React.ReactNode;
  /** Injected for tests. */
  storage?: Storage;
  deps?: Partial<JobDeps>;
}

export function ExportHubProvider({ children, storage, deps: depsOverride }: ExportHubProviderProps) {
  const { expenses } = useExpenses();
  const toast = useToast();
  const deps = useMemo<JobDeps>(() => ({ ...browserJobDeps, ...depsOverride }), [depsOverride]);
  const [status, setStatus] = useState<ExportHubApi["status"]>("loading");
  const [state, setState] = useState<HubState>(EMPTY_HUB_STATE);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [now, setNow] = useState(() => deps.now());

  // Refs give async jobs the latest data without re-creating callbacks.
  const current = useRef<HubState>(EMPTY_HUB_STATE);
  const latestExpenses = useRef(expenses);
  latestExpenses.current = expenses;
  const saveFailureShown = useRef(false);

  useEffect(() => {
    current.current = loadHubState(storage);
    setState(current.current);
    setStatus("ready");
  }, [storage]);

  useEffect(() => {
    const timer = setInterval(() => setNow(deps.now()), DUE_CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [deps]);

  const commit = useCallback(
    (updater: (s: HubState) => HubState) => {
      current.current = updater(current.current);
      setState(current.current);
      if (!saveHubState(current.current, storage) && !saveFailureShown.current) {
        saveFailureShown.current = true;
        toast.show("Couldn't save export settings in this browser. Changes will be lost on reload.", { tone: "error" });
      }
    },
    [storage, toast],
  );

  const runExport = useCallback(
    (request: ExportRequest) => {
      const id = deps.newId();
      setJobs((js) => [{ id, request, steps: planSteps(request), status: "running", entry: null }, ...js]);
      const patchJob = (patch: Partial<Job>) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...patch } : j)));

      void executeExport(latestExpenses.current, request, deps, (steps) => patchJob({ steps })).then((entry) => {
        patchJob({ status: entry.status, entry });
        commit((s) => ({
          ...s,
          history: [entry, ...s.history].slice(0, MAX_HISTORY),
          schedules: request.scheduleId
            ? s.schedules.map((sc) => (sc.id === request.scheduleId ? { ...sc, lastRunAt: entry.createdAt } : sc))
            : s.schedules,
        }));
        setNow(deps.now());
        const label = `${TEMPLATES[request.templateId].name}`;
        if (entry.status === "failed") toast.show(`${label} failed: ${entry.error}`, { tone: "error" });
        else
          toast.show(
            `${label} · ${DESTINATIONS[request.destinationId].deliveredLabel}${entry.simulated ? " (simulated)" : ""}`,
          );
      });
    },
    [commit, deps, toast],
  );

  const connect = useCallback(
    async (id: DestinationId) => {
      await deps.sleep(SIMULATED_CONNECT_MS);
      commit((s) => ({ ...s, connections: { ...s.connections, [id]: { connectedAt: deps.now().toISOString() } } }));
      toast.show(`${DESTINATIONS[id].name} connected (simulated)`);
    },
    [commit, deps, toast],
  );

  const api = useMemo<ExportHubApi>(
    () => ({
      status,
      state,
      jobs,
      now,
      dueSchedules: state.schedules.filter((s) => isDue(s, now)),
      runExport,
      connect,
      dismissJob: (id) => setJobs((js) => js.filter((j) => j.id !== id)),
      disconnect: (id) =>
        commit((s) => {
          const connections = { ...s.connections };
          delete connections[id];
          // Schedules can't deliver to a service that's no longer connected.
          return { ...s, connections, schedules: s.schedules.filter((sc) => sc.destinationId !== id) };
        }),
      addSchedule: (input) =>
        commit((s) => ({
          ...s,
          schedules: [
            ...s.schedules,
            { id: deps.newId(), ...input, enabled: true, createdAt: deps.now().toISOString(), lastRunAt: null },
          ],
        })),
      setScheduleEnabled: (id, enabled) =>
        commit((s) => ({ ...s, schedules: s.schedules.map((sc) => (sc.id === id ? { ...sc, enabled } : sc)) })),
      removeSchedule: (id) => commit((s) => ({ ...s, schedules: s.schedules.filter((sc) => sc.id !== id) })),
      runSchedule: (id) => {
        const schedule = current.current.schedules.find((s) => s.id === id);
        if (!schedule) return;
        runExport({
          templateId: schedule.templateId,
          destinationId: schedule.destinationId,
          params: {},
          scheduleId: schedule.id,
        });
      },
      clearHistory: () => commit((s) => ({ ...s, history: [] })),
    }),
    [status, state, jobs, now, runExport, connect, commit, deps],
  );

  return <ExportHubContext.Provider value={api}>{children}</ExportHubContext.Provider>;
}

export function useExportHub(): ExportHubApi {
  const ctx = useContext(ExportHubContext);
  if (!ctx) throw new Error("useExportHub must be used inside <ExportHubProvider>");
  return ctx;
}
