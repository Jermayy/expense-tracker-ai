import type { Expense } from "../domain/types";

// Expenses live only in this browser, which can clear them (Safari does after 7 days without a
// visit). This nudges users to keep an off-browser copy. It replaces V3's export schedules:
// the app can't run in the background, so a reminder is the honest version of a schedule.

export const BACKUP_STORAGE_KEY = "expense-tracker:backup:v1";
const BACKUP_SCHEMA_VERSION = 1;
export const REMINDER_DAYS = 7;
export const SNOOZE_DAYS = 3;
/** Fired on `window` when a backup is recorded, so open reminders can hide. */
export const BACKUP_RECORDED_EVENT = "spendwise:backup-recorded";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BackupState {
  /** UTC ISO timestamps. */
  lastBackupAt: string | null;
  snoozedUntil: string | null;
}

const EMPTY: BackupState = { lastBackupAt: null, snoozedUntil: null };

const isTimestamp = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

export function parseBackupState(raw: string | null): BackupState {
  if (raw === null) return EMPTY;
  try {
    const data: unknown = JSON.parse(raw);
    if (
      typeof data !== "object" ||
      data === null ||
      (data as { version?: unknown }).version !== BACKUP_SCHEMA_VERSION
    ) {
      return EMPTY;
    }
    const { lastBackupAt, snoozedUntil } = data as Record<string, unknown>;
    return {
      lastBackupAt: isTimestamp(lastBackupAt) ? lastBackupAt : null,
      snoozedUntil: isTimestamp(snoozedUntil) ? snoozedUntil : null,
    };
  } catch {
    // Only reminder bookkeeping, not user data: starting fresh just means an earlier reminder.
    console.warn("[backup] stored reminder state was unreadable; starting fresh");
    return EMPTY;
  }
}

export function loadBackupState(storage: Storage = window.localStorage): BackupState {
  try {
    return parseBackupState(storage.getItem(BACKUP_STORAGE_KEY));
  } catch (err) {
    console.warn("[backup] could not read reminder state", err);
    return EMPTY;
  }
}

/** Returns false if the write failed; the export itself still succeeded, so callers carry on. */
function saveBackupState(state: BackupState, storage: Storage): boolean {
  try {
    storage.setItem(BACKUP_STORAGE_KEY, JSON.stringify({ version: BACKUP_SCHEMA_VERSION, ...state }));
    return true;
  } catch (err) {
    console.warn("[backup] could not save reminder state", err);
    return false;
  }
}

export function recordBackup(now: Date, storage: Storage = window.localStorage): boolean {
  const saved = saveBackupState({ lastBackupAt: now.toISOString(), snoozedUntil: null }, storage);
  window.dispatchEvent(new Event(BACKUP_RECORDED_EVENT));
  return saved;
}

export function snoozeReminder(now: Date, storage: Storage = window.localStorage): boolean {
  const state = loadBackupState(storage);
  return saveBackupState(
    { ...state, snoozedUntil: new Date(now.getTime() + SNOOZE_DAYS * DAY_MS).toISOString() },
    storage,
  );
}

/**
 * Due when there's data worth losing and no recent backup. Someone who has never backed up is
 * only reminded once their oldest expense is REMINDER_DAYS old, so new users aren't nagged.
 */
export function isReminderDue(state: BackupState, expenses: readonly Expense[], now: Date): boolean {
  if (expenses.length === 0) return false;
  if (state.snoozedUntil && Date.parse(state.snoozedUntil) > now.getTime()) return false;
  const since =
    state.lastBackupAt ?? expenses.reduce((min, e) => (e.createdAt < min ? e.createdAt : min), expenses[0].createdAt);
  return now.getTime() - Date.parse(since) >= REMINDER_DAYS * DAY_MS;
}
