"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type ToastTone = "success" | "error" | "info";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  action?: ToastAction;
}

interface ToastApi {
  show: (message: string, options?: { tone?: ToastTone; action?: ToastAction }) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export const TOAST_DURATION_MS = 5000;
/** Toasts with an action (e.g. Undo) stay longer, so slower users can reach the button. */
export const ACTION_TOAST_DURATION_MS = 10000;

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-l-positive",
  error: "border-l-danger",
  info: "border-l-accent",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastApi["show"]>((message, options = {}) => {
    const id = nextId.current++;
    setToasts((current) => [
      ...current.slice(-2),
      { id, message, tone: options.tone ?? "success", action: options.action },
    ]);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  // Pause auto-dismiss while hovered or focused (WCAG 2.2.1 Timing Adjustable); restart on leave.
  const [paused, setPaused] = useState(false);
  const duration = toast.action ? ACTION_TOAST_DURATION_MS : TOAST_DURATION_MS;

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss, paused, duration]);

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
      className={`pointer-events-auto flex w-full max-w-sm animate-toast-in items-center gap-3 rounded-lg border border-l-4 border-line bg-surface px-4 py-3 text-sm shadow-lg ${TONE_STYLES[toast.tone]}`}
    >
      <p className="flex-1 text-ink">{toast.message}</p>
      {toast.action && (
        <button
          type="button"
          className="rounded font-semibold text-accent hover:underline"
          onClick={() => {
            toast.action?.onClick();
            onDismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss notification"
        className="rounded p-1 text-ink-muted hover:text-ink"
        onClick={() => onDismiss(toast.id)}
      >
        <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
