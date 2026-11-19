import { describe, expect, it, vi } from "vitest";
import {
  HUB_STORAGE_KEY,
  MAX_HISTORY,
  loadHubState,
  parseHubState,
  saveHubState,
} from "@/features/exports/lib/hubStorage";
import { EMPTY_HUB_STATE, type HistoryEntry, type HubState } from "@/features/exports/lib/types";

function entry(id: string): HistoryEntry {
  return {
    id,
    request: { templateId: "full-data", destinationId: "download", params: {} },
    status: "completed",
    simulated: false,
    createdAt: "2026-11-18T01:00:00.000Z",
    filename: "x.json",
    recordCount: 1,
    bytes: 10,
    checksum: "ab",
    shareUrl: null,
    expiresAt: null,
    error: null,
  };
}

const state: HubState = {
  connections: { dropbox: { connectedAt: "2026-11-18T00:00:00.000Z" } },
  schedules: [
    {
      id: "s1",
      templateId: "tax-report",
      destinationId: "dropbox",
      frequency: "monthly",
      enabled: true,
      createdAt: "2026-11-18T00:00:00.000Z",
      lastRunAt: null,
    },
  ],
  history: [entry("h1")],
};

describe("hub storage", () => {
  it("round-trips through storage under its own key", () => {
    expect(saveHubState(state)).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(HUB_STORAGE_KEY)!).version).toBe(1);
    expect(loadHubState()).toEqual(state);
  });

  it("starts empty when nothing is stored, the JSON is corrupt or the version is unknown", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseHubState(null)).toEqual(EMPTY_HUB_STATE);
    expect(parseHubState("{nope")).toEqual(EMPTY_HUB_STATE);
    expect(parseHubState(JSON.stringify({ version: 99 }))).toEqual(EMPTY_HUB_STATE);
  });

  it("drops invalid records but keeps valid ones", () => {
    const raw = JSON.stringify({
      version: 1,
      connections: { dropbox: { connectedAt: "x" }, myspace: { connectedAt: "x" }, onedrive: "yes" },
      schedules: [state.schedules[0], { ...state.schedules[0], frequency: "hourly" }],
      history: [entry("ok"), { ...entry("bad"), request: { templateId: "nope" } }, "junk"],
    });
    const parsed = parseHubState(raw);
    expect(Object.keys(parsed.connections)).toEqual(["dropbox"]);
    expect(parsed.schedules).toHaveLength(1);
    expect(parsed.history.map((h) => h.id)).toEqual(["ok"]);
  });

  it("caps history length", () => {
    const history = Array.from({ length: MAX_HISTORY + 5 }, (_, i) => entry(`h${i}`));
    expect(parseHubState(JSON.stringify({ version: 1, history })).history).toHaveLength(MAX_HISTORY);
  });

  it("reports a failed write instead of throwing", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const full = {
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    } as unknown as Storage;
    expect(saveHubState(state, full)).toBe(false);
  });
});
