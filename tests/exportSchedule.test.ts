import { describe, expect, it } from "vitest";
import { isDue, nextRunAt, type Schedule } from "@/features/exports/domain/schedule";

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: "s1",
    templateId: "full-data",
    destinationId: "download",
    frequency: "weekly",
    enabled: true,
    createdAt: new Date(2026, 0, 31, 9).toISOString(),
    lastRunAt: null,
    ...overrides,
  };
}

describe("nextRunAt", () => {
  it("is one period after creation when it has never run", () => {
    expect(nextRunAt(schedule({ frequency: "daily" }))).toEqual(new Date(2026, 1, 1, 9));
    expect(nextRunAt(schedule({ frequency: "weekly" }))).toEqual(new Date(2026, 1, 7, 9));
  });

  it("clamps monthly runs to the end of shorter months", () => {
    expect(nextRunAt(schedule({ frequency: "monthly" }))).toEqual(new Date(2026, 1, 28, 9));
  });

  it("counts from the last run", () => {
    const lastRunAt = new Date(2026, 2, 10, 18).toISOString();
    expect(nextRunAt(schedule({ lastRunAt }))).toEqual(new Date(2026, 2, 17, 18));
  });
});

describe("isDue", () => {
  const now = new Date(2026, 1, 7, 9);

  it("is due once the next run time has passed", () => {
    expect(isDue(schedule(), now)).toBe(true);
    expect(isDue(schedule(), new Date(2026, 1, 7, 8, 59))).toBe(false);
  });

  it("is never due while paused", () => {
    expect(isDue(schedule({ enabled: false }), now)).toBe(false);
  });
});
