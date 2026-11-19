export const DESTINATION_IDS = [
  "download",
  "device",
  "email",
  "share-link",
  "google-sheets",
  "dropbox",
  "onedrive",
] as const;
export type DestinationId = (typeof DESTINATION_IDS)[number];

export interface Destination {
  id: DestinationId;
  name: string;
  description: string;
  /** "real" destinations produce an actual file; "simulated" ones only demonstrate the flow. */
  mode: "real" | "simulated";
  /** Simulated cloud services must be "connected" before use. */
  needsConnection: boolean;
  /** Present-tense verb for the delivery step, e.g. "Uploading to Dropbox". */
  deliveryStep: string;
  /** Past tense for history, e.g. "Uploaded to Dropbox". */
  deliveredLabel: string;
  monogram: string;
  /** Category colour slot used for the tile, so it follows the app's own palette. */
  tint: string;
}

export const DESTINATIONS: Record<DestinationId, Destination> = {
  download: {
    id: "download",
    name: "Download",
    description: "Save the file to this device",
    mode: "real",
    needsConnection: false,
    deliveryStep: "Saving to this device",
    deliveredLabel: "Downloaded",
    monogram: "↓",
    tint: "var(--accent)",
  },
  device: {
    id: "device",
    name: "Share via device",
    description: "Your device's share sheet: Mail, Messages, AirDrop, Drive apps",
    mode: "real",
    needsConnection: false,
    deliveryStep: "Opening the share sheet",
    deliveredLabel: "Shared via device",
    monogram: "⇪",
    tint: "var(--cat-3)",
  },
  email: {
    id: "email",
    name: "Email",
    description: "Send the file as an attachment",
    mode: "simulated",
    needsConnection: false,
    deliveryStep: "Sending email",
    deliveredLabel: "Emailed",
    monogram: "@",
    tint: "var(--cat-2)",
  },
  "share-link": {
    id: "share-link",
    name: "Share link",
    description: "A view-only link and QR code that expires",
    mode: "simulated",
    needsConnection: false,
    deliveryStep: "Publishing link",
    deliveredLabel: "Link created",
    monogram: "⌁",
    tint: "var(--cat-5)",
  },
  "google-sheets": {
    id: "google-sheets",
    name: "Google Sheets",
    description: "Create or update a spreadsheet",
    mode: "simulated",
    needsConnection: true,
    deliveryStep: "Writing to Google Sheets",
    deliveredLabel: "Sent to Google Sheets",
    monogram: "GS",
    tint: "var(--cat-6)",
  },
  dropbox: {
    id: "dropbox",
    name: "Dropbox",
    description: "Save to /Apps/Spendwise",
    mode: "simulated",
    needsConnection: true,
    deliveryStep: "Uploading to Dropbox",
    deliveredLabel: "Uploaded to Dropbox",
    monogram: "DB",
    tint: "var(--cat-1)",
  },
  onedrive: {
    id: "onedrive",
    name: "OneDrive",
    description: "Save to Documents/Spendwise",
    mode: "simulated",
    needsConnection: true,
    deliveryStep: "Uploading to OneDrive",
    deliveredLabel: "Uploaded to OneDrive",
    monogram: "OD",
    tint: "var(--cat-4)",
  },
};

export function isDestinationId(value: unknown): value is DestinationId {
  return typeof value === "string" && (DESTINATION_IDS as readonly string[]).includes(value);
}

export const SHARE_LINK_EXPIRY_DAYS = [1, 7, 30] as const;
export type ShareLinkExpiryDays = (typeof SHARE_LINK_EXPIRY_DAYS)[number];

/** Pragmatic check: one @, something on both sides, a dot in the domain. */
export function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.trim().length <= 254;
}

/**
 * Placeholder share URL. `.example` is reserved (RFC 2606) so a copied link can never
 * resolve to someone's real site.
 */
export function simulatedShareUrl(token: string): string {
  return `https://share.spendwise.example/s/${token}`;
}
