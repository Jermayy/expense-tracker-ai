import { describe, expect, it, vi } from "vitest";
import {
  executeExport,
  sha256Hex,
  SIMULATED_DELIVERY_MS,
  type JobDeps,
  type JobStep,
} from "@/features/exports/lib/runJob";
import { buildExpense, NOW } from "./factories";

const expenses = [buildExpense({ date: "2026-11-01", amountCents: 1500 }), buildExpense({ date: "2026-11-02" })];

function makeDeps(overrides: Partial<JobDeps> = {}): JobDeps {
  let n = 0;
  return {
    now: () => NOW,
    newId: () => `id-${++n}`,
    sleep: vi.fn(async () => {}),
    download: vi.fn(),
    shareFile: vi.fn(async () => {}),
    digest: sha256Hex,
    ...overrides,
  };
}

describe("sha256Hex", () => {
  it("matches the standard test vector", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("executeExport", () => {
  it("downloads the file and records a fingerprinted history entry", async () => {
    const deps = makeDeps();
    const progress: JobStep[][] = [];
    const entry = await executeExport(
      expenses,
      { templateId: "full-data", destinationId: "download", params: {} },
      deps,
      (s) => progress.push(s),
    );

    expect(deps.download).toHaveBeenCalledWith(
      [expect.any(String)],
      "application/json",
      "spendwise-data-2026-11-18.json",
    );
    const content = vi.mocked(deps.download).mock.calls[0][0][0] as string;
    expect(entry).toMatchObject({
      status: "completed",
      simulated: false,
      recordCount: 2,
      bytes: new TextEncoder().encode(content).length,
      checksum: await sha256Hex(content),
      createdAt: NOW.toISOString(),
    });
    expect(deps.sleep).not.toHaveBeenCalled();
    expect(progress.at(-1)!.map((s) => [s.kind, s.state])).toEqual([
      ["generate", "done"],
      ["fingerprint", "done"],
      ["deliver", "done"],
    ]);
  });

  it("only simulates email delivery, and says so", async () => {
    const deps = makeDeps();
    const progress: JobStep[][] = [];
    const entry = await executeExport(
      expenses,
      { templateId: "category-analysis", destinationId: "email", params: {}, recipient: "a@b.co" },
      deps,
      (s) => progress.push(s),
    );
    expect(entry).toMatchObject({ status: "completed", simulated: true });
    expect(deps.sleep).toHaveBeenCalledWith(SIMULATED_DELIVERY_MS);
    expect(deps.download).not.toHaveBeenCalled();
    expect(progress.at(-1)!.find((s) => s.kind === "deliver")?.simulated).toBe(true);
  });

  it("creates a placeholder share link that expires", async () => {
    const entry = await executeExport(
      expenses,
      { templateId: "tax-report", destinationId: "share-link", params: {}, expiryDays: 1 },
      makeDeps(),
      () => {},
    );
    expect(entry.shareUrl).toMatch(/^https:\/\/share\.spendwise\.example\/s\/[\w-]{1,12}$/);
    expect(entry.expiresAt).toBe(new Date(NOW.getTime() + 24 * 3600 * 1000).toISOString());
  });

  it("opens the share sheet before hashing, so the click still counts", async () => {
    const order: string[] = [];
    const deps = makeDeps({
      shareFile: vi.fn(async (file: File) => void order.push(`share:${file.name}`)),
      digest: vi.fn(async () => {
        order.push("digest");
        return "hash";
      }),
    });
    await executeExport(expenses, { templateId: "full-data", destinationId: "device", params: {} }, deps, () => {});
    expect(order).toEqual(["share:spendwise-data-2026-11-18.json", "digest"]);
  });

  it("records a cancelled share as a failed run instead of throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const progress: JobStep[][] = [];
    const deps = makeDeps({ shareFile: vi.fn(async () => Promise.reject(new DOMException("x", "AbortError"))) });
    const entry = await executeExport(
      expenses,
      { templateId: "full-data", destinationId: "device", params: {} },
      deps,
      (s) => progress.push(s),
    );
    expect(entry).toMatchObject({ status: "failed", error: "Sharing was cancelled.", checksum: null });
    expect(progress.at(-1)!.map((s) => s.state)).toEqual(["done", "failed", "pending"]);
  });
});
