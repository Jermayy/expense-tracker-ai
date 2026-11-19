import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { DashboardView } from "@/features/expenses/components/DashboardView";
import { ExpenseDialogProvider } from "@/features/expenses/components/ExpenseDialog";
import { saveExpenses } from "@/features/expenses/lib/storage";
import { ExpensesProvider } from "@/features/expenses/state/ExpensesProvider";
import { buildExpense } from "./factories";

function renderDashboard() {
  render(
    <ToastProvider>
      <ExpensesProvider>
        <ExpenseDialogProvider>
          <DashboardView />
        </ExpenseDialogProvider>
      </ExpensesProvider>
    </ToastProvider>,
  );
}

/** jsdom has no object URLs; capture the Blob handed to the download link instead. */
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

describe("DashboardView export", () => {
  it("downloads every expense as CSV", async () => {
    saveExpenses([
      buildExpense({ date: "2026-11-02", category: "Food", amountCents: 1250, description: "Lunch" }),
      buildExpense({ date: "2026-10-15", category: "Transportation", amountCents: 300, description: "Bus" }),
    ]);
    const blobs = captureDownloads();
    renderDashboard();

    await userEvent.setup().click(await screen.findByRole("button", { name: "Export Data" }));

    expect(blobs).toHaveLength(1);
    const bytes = new Uint8Array(await blobs[0].arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM for Excel
    expect(new TextDecoder().decode(bytes)).toBe(
      "Date,Category,Amount (AUD),Description\r\n2026-11-02,Food,12.50,Lunch\r\n2026-10-15,Transportation,3.00,Bus",
    );
    expect(await screen.findByText("Exported 2 expenses to CSV")).toBeInTheDocument();
  });

  it("hides the button when there is nothing to export", async () => {
    renderDashboard();
    await screen.findByText("No expenses yet");
    expect(screen.queryByRole("button", { name: "Export Data" })).not.toBeInTheDocument();
  });
});
