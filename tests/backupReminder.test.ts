import { describe, expect, it, vi } from "vitest";
import {
  BACKUP_RECORDED_EVENT,
  BACKUP_STORAGE_KEY,
  isReminderDue,
  loadBackupState,
  parseBackupState,
  recordBackup,
  snoozeReminder,
} from "@/features/expenses/lib/backupReminder";
import { defaultExportOptions, isFullBackup } from "@/features/expenses/export/options";
import { buildExpense, NOW } from "./factories";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY).toISOString();
const empty = { lastBackupAt: null, snoozedUntil: null };

describe("isReminderDue", () => {
  it("never nags when there's nothing to lose", () => {
    expect(isReminderDue(empty, [], NOW)).toBe(false);
  });

  it("waits until a new user's oldest expense is a week old", () => {
    expect(isReminderDue(empty, [buildExpense({ createdAt: daysAgo(6) })], NOW)).toBe(false);
    expect(
      isReminderDue(empty, [buildExpense({ createdAt: daysAgo(1) }), buildExpense({ createdAt: daysAgo(7) })], NOW),
    ).toBe(true);
  });

  it("is due a week after the last backup", () => {
    const expenses = [buildExpense({ createdAt: daysAgo(100) })];
    expect(isReminderDue({ ...empty, lastBackupAt: daysAgo(6) }, expenses, NOW)).toBe(false);
    expect(isReminderDue({ ...empty, lastBackupAt: daysAgo(7) }, expenses, NOW)).toBe(true);
  });

  it("stays quiet while snoozed", () => {
    const expenses = [buildExpense({ createdAt: daysAgo(100) })];
    const snoozedUntil = new Date(NOW.getTime() + DAY).toISOString();
    expect(isReminderDue({ lastBackupAt: null, snoozedUntil }, expenses, NOW)).toBe(false);
    expect(isReminderDue({ lastBackupAt: null, snoozedUntil: daysAgo(1) }, expenses, NOW)).toBe(true);
  });
});

describe("backup state storage", () => {
  it("records a backup, clears any snooze and tells listeners", () => {
    const listener = vi.fn();
    window.addEventListener(BACKUP_RECORDED_EVENT, listener);
    snoozeReminder(NOW);
    recordBackup(NOW);
    window.removeEventListener(BACKUP_RECORDED_EVENT, listener);

    expect(loadBackupState()).toEqual({ lastBackupAt: NOW.toISOString(), snoozedUntil: null });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("snoozes for three days", () => {
    snoozeReminder(NOW);
    expect(loadBackupState().snoozedUntil).toBe(new Date(NOW.getTime() + 3 * DAY).toISOString());
  });

  it("starts fresh on missing, corrupt or unknown data", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseBackupState(null)).toEqual(empty);
    expect(parseBackupState("{nope")).toEqual(empty);
    expect(parseBackupState(JSON.stringify({ version: 9, lastBackupAt: NOW.toISOString() }))).toEqual(empty);
    expect(parseBackupState(JSON.stringify({ version: 1, lastBackupAt: "yesterday" }))).toEqual(empty);
    vi.restoreAllMocks();
  });

  it("reports a failed write", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    } as unknown as Storage;
    expect(recordBackup(NOW, full)).toBe(false);
    expect(window.localStorage.getItem(BACKUP_STORAGE_KEY)).toBeNull();
    vi.restoreAllMocks();
  });
});

describe("isFullBackup", () => {
  const base = defaultExportOptions(NOW);

  it("counts complete, unredacted, record-keeping exports", () => {
    expect(isFullBackup(base, 5, 5)).toBe(true);
    expect(isFullBackup({ ...base, format: "json" }, 5, 5)).toBe(true);
    expect(isFullBackup({ ...base, layout: "tax-report" }, 5, 5)).toBe(true);
  });

  it("doesn't count partial, redacted, summary or PDF exports", () => {
    expect(isFullBackup(base, 4, 5)).toBe(false);
    expect(isFullBackup({ ...base, redact: true }, 5, 5)).toBe(false);
    expect(isFullBackup({ ...base, layout: "monthly-summary" }, 5, 5)).toBe(false);
    expect(isFullBackup({ ...base, format: "pdf" }, 5, 5)).toBe(false);
    expect(isFullBackup(base, 0, 0)).toBe(false);
  });
});
