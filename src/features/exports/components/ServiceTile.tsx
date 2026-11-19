import type { Destination, DestinationId } from "../domain/destinations";

/** Generic destinations get an icon; named services keep a letter monogram. */
const ICONS: Partial<Record<DestinationId, string>> = {
  download:
    "M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75ZM3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z",
  device:
    "M13 4.5a2.5 2.5 0 1 1 .7 1.74l-6.8 3.4a2.5 2.5 0 0 1 0 .72l6.8 3.4a2.5 2.5 0 1 1-.67 1.34l-6.8-3.4a2.5 2.5 0 1 1 0-3.4l6.8-3.4A2.5 2.5 0 0 1 13 4.5Z",
  email:
    "M3 4a2 2 0 0 0-2 2v1.16l8.55 4.28a1 1 0 0 0 .9 0L19 7.16V6a2 2 0 0 0-2-2H3Zm16 4.84-8.1 4.05a2 2 0 0 1-1.8 0L1 8.84V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.84Z",
  "share-link":
    "M12.23 3.2a3.5 3.5 0 0 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .75.75 0 0 1 1.06-1.06 2 2 0 0 0 2.83 0l2.5-2.5a2 2 0 1 0-2.83-2.83l-1 1a.75.75 0 0 1-1.06-1.06l1-1Zm-4.46 4.46a3.5 3.5 0 0 1 4.95 0 .75.75 0 0 1-1.06 1.06 2 2 0 0 0-2.83 0l-2.5 2.5a2 2 0 1 0 2.83 2.83l1-1a.75.75 0 0 1 1.06 1.06l-1 1a3.5 3.5 0 0 1-4.95-4.95l2.5-2.5Z",
};

/** Monogram tile in the app's own palette; deliberately not the services' logos. */
export function ServiceTile({ destination, size = "md" }: { destination: Destination; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-xs";
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-bold text-white ${box}`}
      style={{ backgroundColor: destination.tint }}
    >
      {ICONS[destination.id] ? (
        <svg viewBox="0 0 20 20" fill="currentColor" className={size === "sm" ? "h-4 w-4" : "h-5 w-5"}>
          <path fillRule="evenodd" clipRule="evenodd" d={ICONS[destination.id]} />
        </svg>
      ) : (
        destination.monogram
      )}
    </span>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-soft">
      Demo
    </span>
  );
}
