import type { DestinationId } from "./destinations";
import type { TemplateId } from "./templates";

export const FREQUENCIES = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" } as const;
export type Frequency = keyof typeof FREQUENCIES;

export interface Schedule {
  id: string;
  templateId: TemplateId;
  destinationId: DestinationId;
  frequency: Frequency;
  enabled: boolean;
  /** UTC ISO timestamps. */
  createdAt: string;
  lastRunAt: string | null;
}

function addPeriod(from: Date, frequency: Frequency): Date {
  const next = new Date(from);
  if (frequency === "daily") next.setDate(next.getDate() + 1);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  if (frequency === "monthly") {
    // Clamp so 31 Jan + 1 month is 28/29 Feb, not 2/3 Mar.
    const day = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    next.setDate(Math.min(day, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
  }
  return next;
}

/** When the schedule should next run: one period after its last run (or its creation). */
export function nextRunAt(schedule: Schedule): Date {
  return addPeriod(new Date(schedule.lastRunAt ?? schedule.createdAt), schedule.frequency);
}

export function isDue(schedule: Schedule, now: Date): boolean {
  return schedule.enabled && nextRunAt(schedule).getTime() <= now.getTime();
}
