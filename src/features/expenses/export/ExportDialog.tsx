"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { InitialOptions } from "./ExportPanel";

// The panel pulls in every format encoder, so it's only downloaded when the dialog first opens.
const ExportPanel = dynamic(() => import("./ExportPanel").then((m) => m.ExportPanel), {
  ssr: false,
  loading: () => (
    <p className="py-16 text-center text-sm text-ink-muted" role="status">
      Loading export options…
    </p>
  ),
});
interface ExportDialogApi {
  /** Open the export dialog, optionally pre-filled (e.g. with the current list filters). */
  openExport: (initial?: InitialOptions) => void;
}

const ExportDialogContext = createContext<ExportDialogApi | null>(null);

export function ExportDialogProvider({ children }: { children: React.ReactNode }) {
  const [initial, setInitial] = useState<InitialOptions | null>(null);
  // While a file is being built the dialog must stay open, so Esc/backdrop are ignored.
  const busy = useRef(false);
  const close = useCallback(() => {
    if (!busy.current) setInitial(null);
  }, []);
  const api = useMemo<ExportDialogApi>(() => ({ openExport: (init = {}) => setInitial(init) }), []);

  return (
    <ExportDialogContext.Provider value={api}>
      {children}
      <Modal open={initial !== null} title="Export expenses" onClose={close} size="xl">
        {initial !== null && (
          <ExportPanel
            initial={initial}
            onBusyChange={(b) => (busy.current = b)}
            onDone={() => {
              busy.current = false;
              close();
            }}
          />
        )}
      </Modal>
    </ExportDialogContext.Provider>
  );
}

export function useExportDialog(): ExportDialogApi {
  const ctx = useContext(ExportDialogContext);
  if (!ctx) throw new Error("useExportDialog must be used inside <ExportDialogProvider>");
  return ctx;
}
