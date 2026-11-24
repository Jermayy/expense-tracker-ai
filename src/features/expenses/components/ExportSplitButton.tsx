"use client";

const segment =
  "inline-flex items-center gap-2 border border-line bg-surface py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-2 focus-visible:z-10 disabled:cursor-not-allowed disabled:opacity-60";

interface ExportSplitButtonProps {
  /** Download a CSV of what's on screen right away. */
  onQuickExport: () => void;
  /** Open the export dialog with formats, filters and preview. */
  onMoreOptions: () => void;
  quickDisabled?: boolean;
}

/** One click for the common case; the full dialog one click further. */
export function ExportSplitButton({ onQuickExport, onMoreOptions, quickDisabled }: ExportSplitButtonProps) {
  return (
    <div role="group" aria-label="Export" className="inline-flex">
      <button type="button" className={`${segment} rounded-l-lg px-4`} onClick={onQuickExport} disabled={quickDisabled}>
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
          <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
        </svg>
        Export CSV
      </button>
      <button
        type="button"
        className={`${segment} -ml-px rounded-r-lg px-3`}
        onClick={onMoreOptions}
        aria-label="More export options"
        title="More export options"
      >
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M10 3.75a2 2 0 1 0-4 0 2 2 0 0 0 4 0ZM17.25 4.5a.75.75 0 0 0 0-1.5h-5.5a.75.75 0 0 0 0 1.5h5.5ZM5 3.75a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 .75.75ZM4.25 17a.75.75 0 0 0 0-1.5h-1.5a.75.75 0 0 0 0 1.5h1.5ZM17.25 17a.75.75 0 0 0 0-1.5h-5.5a.75.75 0 0 0 0 1.5h5.5ZM9 10a.75.75 0 0 1-.75.75h-5.5a.75.75 0 0 1 0-1.5h5.5A.75.75 0 0 1 9 10ZM17.25 10.75a.75.75 0 0 0 0-1.5h-1.5a.75.75 0 0 0 0 1.5h1.5ZM14 10a2 2 0 1 0-4 0 2 2 0 0 0 4 0ZM10 16.25a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z" />
        </svg>
        <span className="hidden sm:inline">Options</span>
      </button>
    </div>
  );
}
