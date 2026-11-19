import { DESTINATION_IDS, isDestinationId } from "../domain/destinations";
import { FREQUENCIES, type Schedule } from "../domain/schedule";
import { isTemplateId } from "../domain/templates";
import { EMPTY_HUB_STATE, type HistoryEntry, type HubState } from "./types";

export const HUB_STORAGE_KEY = "expense-tracker:exports:v1";
const HUB_SCHEMA_VERSION = 1;
/** Older entries are dropped so the history can't grow without bound. */
export const MAX_HISTORY = 50;

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";
const isNullableString = (v: unknown) => v === null || isString(v);

function isSchedule(v: unknown): v is Schedule {
  return (
    isObject(v) &&
    isString(v.id) &&
    isTemplateId(v.templateId) &&
    isDestinationId(v.destinationId) &&
    isString(v.frequency) &&
    v.frequency in FREQUENCIES &&
    typeof v.enabled === "boolean" &&
    isString(v.createdAt) &&
    isNullableString(v.lastRunAt)
  );
}

function isHistoryEntry(v: unknown): v is HistoryEntry {
  return (
    isObject(v) &&
    isString(v.id) &&
    isObject(v.request) &&
    isTemplateId(v.request.templateId) &&
    isDestinationId(v.request.destinationId) &&
    isObject(v.request.params) &&
    (v.status === "completed" || v.status === "failed") &&
    typeof v.simulated === "boolean" &&
    isString(v.createdAt) &&
    isString(v.filename) &&
    Number.isInteger(v.recordCount) &&
    Number.isInteger(v.bytes) &&
    isNullableString(v.checksum) &&
    isNullableString(v.shareUrl) &&
    isNullableString(v.expiresAt) &&
    isNullableString(v.error)
  );
}

/**
 * Parse stored hub state, keeping every valid record and dropping the rest.
 * This is export settings and history, not expenses, so unreadable data falls back to empty.
 */
export function parseHubState(raw: string | null): HubState {
  if (raw === null) return EMPTY_HUB_STATE;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    console.warn("[exports] stored export settings were unreadable; starting fresh");
    return EMPTY_HUB_STATE;
  }
  if (!isObject(data) || data.version !== HUB_SCHEMA_VERSION) return EMPTY_HUB_STATE;

  const connections: HubState["connections"] = {};
  if (isObject(data.connections)) {
    for (const id of DESTINATION_IDS) {
      const c = data.connections[id];
      if (isObject(c) && isString(c.connectedAt)) connections[id] = { connectedAt: c.connectedAt };
    }
  }
  return {
    connections,
    schedules: Array.isArray(data.schedules) ? data.schedules.filter(isSchedule) : [],
    history: Array.isArray(data.history) ? data.history.filter(isHistoryEntry).slice(0, MAX_HISTORY) : [],
  };
}

export function loadHubState(storage: Storage = window.localStorage): HubState {
  try {
    return parseHubState(storage.getItem(HUB_STORAGE_KEY));
  } catch (err) {
    console.warn("[exports] could not read export settings", err);
    return EMPTY_HUB_STATE;
  }
}

/**
 * Returns false when the write fails (e.g. storage full). Callers tell the user, but an export
 * that already succeeded isn't treated as failed just because its history entry couldn't be saved.
 */
export function saveHubState(state: HubState, storage: Storage = window.localStorage): boolean {
  try {
    storage.setItem(HUB_STORAGE_KEY, JSON.stringify({ version: HUB_SCHEMA_VERSION, ...state }));
    return true;
  } catch (err) {
    console.warn("[exports] could not save export settings", err);
    return false;
  }
}
