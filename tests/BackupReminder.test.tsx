import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { BackupReminder } from "@/features/expenses/components/BackupReminder";
import { loadBackupState, recordBackup } from "@/features/expenses/lib/backupReminder";
import { saveExpenses } from "@/features/expenses/lib/storage";
import { ExpensesProvider, useExpenses } from "@/features/expenses/state/ExpensesProvider";
import { buildExpense, NOW } from "./factories";

const DAY = 24 * 60 * 60 * 1000;

/** Shows when expenses have loaded, so tests can assert the reminder's absence reliably. */
function LoadedProbe() {
  return useExpenses().status === "ready" ? <span>loaded</span> : null;
}

async function renderReminder() {
  render(
    <ToastProvider>
      <ExpensesProvider>
        <BackupReminder now={() => NOW} />
        <LoadedProbe />
      </ExpensesProvider>
    </ToastProvider>,
  );
  await screen.findByText("loaded");
}

function captureDownloads() {
  const blobs: Blob[] = [];
  URL.createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return "blob:test";
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  return blobs;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BackupReminder", () => {
  it("offers a full JSON backup when one is overdue, then hides", async () => {
    saveExpenses([
      buildExpense({ description: "Old", createdAt: new Date(NOW.getTime() - 30 * DAY).toISOString() }),
      buildExpense({ description: "New" }),
    ]);
    const blobs = captureDownloads();
    await renderReminder();

    expect(await screen.findByText("Time to back up your expenses")).toBeInTheDocument();
    expect(screen.getByText(/You haven't backed up yet/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Download backup" }));

    // The backup code is loaded on click, so the download lands a tick later.
    await waitFor(() => expect(blobs).toHaveLength(1));
    const doc = JSON.parse(await blobs[0].text());
    expect(doc.expenses.map((e: { description: string }) => e.description).sort()).toEqual(["New", "Old"]);
    expect(doc.redacted).toBe(false);
    expect(loadBackupState().lastBackupAt).toBe(NOW.toISOString());
    expect(screen.queryByText("Time to back up your expenses")).not.toBeInTheDocument();
    expect(await screen.findByText("Backed up 2 expenses")).toBeInTheDocument();
  });

  it("can be snoozed", async () => {
    saveExpenses([buildExpense({ createdAt: new Date(NOW.getTime() - 30 * DAY).toISOString() })]);
    await renderReminder();
    await userEvent.setup().click(await screen.findByRole("button", { name: "Remind me in 3 days" }));
    expect(screen.queryByText("Time to back up your expenses")).not.toBeInTheDocument();
  });

  it("stays hidden after a recent backup", async () => {
    saveExpenses([buildExpense({ createdAt: new Date(NOW.getTime() - 30 * DAY).toISOString() })]);
    recordBackup(new Date(NOW.getTime() - DAY));
    await renderReminder();
    expect(screen.queryByText("Time to back up your expenses")).not.toBeInTheDocument();
  });
});
