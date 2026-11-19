import { toIsoDate } from "./dates";
import type { IsoDate } from "./types";

// Australian financial years run 1 July – 30 June and are named by the year they end:
// FY2026 = 1 Jul 2025 – 30 Jun 2026.

/** The financial year containing `now` (July starts a new one). */
export function currentFinancialYear(now: Date): number {
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

export function financialYearRange(fy: number): { from: IsoDate; to: IsoDate } {
  return { from: `${fy - 1}-07-01`, to: `${fy}-06-30` };
}

/** "FY2025–26". */
export function financialYearLabel(fy: number): string {
  return `FY${fy - 1}–${String(fy).slice(2)}`;
}

/** The financial year so far, or a past one in full. */
export function financialYearToDate(fy: number, now: Date): { from: IsoDate; to: IsoDate } {
  const range = financialYearRange(fy);
  const today = toIsoDate(now);
  return { from: range.from, to: today < range.to ? today : range.to };
}

/** The financial year a range covers exactly (in full, or to date for the current one). */
export function financialYearOf(range: { from: string; to: string }, now: Date): number | null {
  const fy = Number(range.from.slice(0, 4)) + 1;
  if (range.from !== `${fy - 1}-07-01`) return null;
  const full = financialYearRange(fy);
  const toDate = financialYearToDate(fy, now);
  return range.to === full.to || range.to === toDate.to ? fy : null;
}
