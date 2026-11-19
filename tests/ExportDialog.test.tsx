import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { ExportDialogProvider, useExportDialog } from "@/features/expenses/export/ExportDialog";
import { loadBackupState } from "@/features/expenses/lib/backupReminder";
import { saveExpenses } from "@/features/expenses/lib/storage";
import { ExpensesProvider, useExpenses } from "@/features/expenses/state/ExpensesProvider";
import { buildExpense } from "./factories";

type Initial = Parameters<ReturnType<typeof useExportDialog>["openExport"]>[0];

function Opener({ initial }: { initial?: Initial }) {
  const { openExport } = useExportDialog();
  const { status } = useExpenses();
  return (
    <button type="button" disabled={status !== "ready"} onClick={() => openExport(initial)}>
      Open export
    </button>
  );
}

async function setup(initial?: Initial) {
  saveExpenses([
    buildExpense({ date: "2026-10-01", category: "Food", amountCents: 1000, description: "Groceries" }),
    buildExpense({ date: "2026-11-02", category: "Food", amountCents: 1250, description: "Lunch" }),
    buildExpense({ date: "2026-11-05", category: "Bills", amountCents: 8000, description: "Power" }),
  ]);
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <ExpensesProvider>
        <ExportDialogProvider>
          <Opener initial={initial} />
        </ExportDialogProvider>
      </ExpensesProvider>
    </ToastProvider>,
  );
  const opener = await screen.findByRole("button", { name: "Open export" });
  await waitFor(() => expect(opener).toBeEnabled());
  await user.click(opener);
  const dialog = screen.getByRole("dialog", { name: "Export expenses" });
  // The panel is code-split, so wait for it to load.
  await within(dialog).findByLabelText("Export summary");
  return { user, dialog: within(dialog) };
}

/** jsdom has no object URLs; record what would be downloaded instead. */
function captureDownloads() {
  const downloads: { blob: Blob; filename: string }[] = [];
  let pending: Blob | null = null;
  URL.createObjectURL = vi.fn((blob: Blob) => {
    pending = blob;
    return "blob:test";
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push({ blob: pending!, filename: this.download });
  });
  return downloads;
}

const recordCount = (dialog: ReturnType<typeof within>) =>
  within(dialog.getByLabelText("Export summary")).getByText("Records").nextSibling?.textContent;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Export dialog", () => {
  it("focuses the selected format once the panel has loaded", async () => {
    await setup();
    expect(screen.getByRole("radio", { name: /CSV/ })).toHaveFocus();
  });

  it("previews every record by default, with a summary", async () => {
    const { dialog } = await setup();
    expect(recordCount(dialog)).toBe("3");
    expect(dialog.getByText("$102.50")).toBeInTheDocument();
    const rows = within(dialog.getByRole("table")).getAllByRole("row");
    expect(rows.slice(1).map((r) => (r as HTMLTableRowElement).cells[2].textContent)).toEqual([
      "Groceries",
      "Lunch",
      "Power",
    ]);
    expect(dialog.getByRole("button", { name: "Export 3 records" })).toBeEnabled();
  });

  it("narrows by category and date range as the options change", async () => {
    const { user, dialog } = await setup();
    await user.click(dialog.getByRole("checkbox", { name: /Bills/ }));
    expect(recordCount(dialog)).toBe("2");

    await user.type(dialog.getByLabelText("Start date"), "2026-11-01");
    expect(recordCount(dialog)).toBe("1");
    expect(dialog.getByRole("button", { name: "Export 1 record" })).toBeEnabled();
  });

  it("applies date presets", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 10, 18, 12) });
    try {
      const { user, dialog } = await setup();
      await user.click(dialog.getByRole("button", { name: "This month" }));
      expect(dialog.getByLabelText("Start date")).toHaveValue("2026-11-01");
      expect(dialog.getByRole("button", { name: "This month" })).toHaveAttribute("aria-pressed", "true");
      expect(recordCount(dialog)).toBe("2");
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts from the caller's filters", async () => {
    const { dialog } = await setup({ categories: ["Bills"] });
    expect(dialog.getByRole("checkbox", { name: /Bills/ })).toBeChecked();
    expect(dialog.getByRole("checkbox", { name: /Food/ })).not.toBeChecked();
    expect(recordCount(dialog)).toBe("1");
  });

  it("blocks export with inline errors for invalid options", async () => {
    const { user, dialog } = await setup();
    await user.click(dialog.getByRole("button", { name: "None" }));
    expect(dialog.getByText("Select at least one category.")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Nothing to export" })).toBeDisabled();

    await user.click(dialog.getByRole("button", { name: "All" }));
    await user.clear(dialog.getByLabelText("File name"));
    expect(dialog.getByText("Enter a file name.")).toBeInTheDocument();
    expect(dialog.getByLabelText("File name")).toHaveAttribute("aria-invalid", "true");
    expect(dialog.getByRole("button", { name: "Export 3 records" })).toBeDisabled();
  });

  it("exports the chosen format and name, then closes with a confirmation", async () => {
    const downloads = captureDownloads();
    const { user, dialog } = await setup();
    await user.click(dialog.getByRole("radio", { name: /JSON/ }));
    await user.click(dialog.getByRole("checkbox", { name: /Food/ }));
    await user.clear(dialog.getByLabelText("File name"));
    await user.type(dialog.getByLabelText("File name"), "power bills");
    expect(dialog.getByText("power bills.json")).toBeInTheDocument();

    await user.click(dialog.getByRole("button", { name: "Export 1 record" }));

    expect(await screen.findByText("Exported 1 record to power bills.json")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(downloads).toHaveLength(1);
    expect(downloads[0].filename).toBe("power bills.json");
    const doc = JSON.parse(await downloads[0].blob.text());
    expect(doc.expenses.map((e: { description: string }) => e.description)).toEqual(["Power"]);
  });

  it("shows a busy state while exporting and ignores a second click", async () => {
    const downloads = captureDownloads();
    const { dialog } = await setup();
    const exportButton = dialog.getByRole("button", { name: "Export 3 records" });
    // fireEvent is synchronous, so the export is still waiting for its next tick here.
    fireEvent.click(exportButton);
    expect(exportButton).toHaveTextContent("Exporting…");
    expect(exportButton).toBeDisabled();
    expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.click(exportButton);

    expect(await screen.findByText(/^Exported 3 records to expenses-\d{4}-\d{2}-\d{2}\.csv$/)).toBeInTheDocument();
    expect(downloads).toHaveLength(1);
  });

  it("offers CSV layouts and names the file after the chosen one", async () => {
    // "Last FY" depends on today's date, so pin it.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 10, 18, 12) });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const downloads = captureDownloads();
    const { user, dialog } = await setup();
    await user.click(dialog.getByRole("radio", { name: /Tax report/ }));
    await user.click(dialog.getByRole("button", { name: "Last FY" }));
    expect(dialog.getByLabelText("File name")).toHaveValue("tax-report-fy2026");

    await user.click(dialog.getByRole("radio", { name: /PDF/ }));
    expect(dialog.queryByRole("radio", { name: /Tax report/ })).not.toBeInTheDocument();
    await user.click(dialog.getByRole("radio", { name: /CSV/ }));
    await user.click(dialog.getByRole("button", { name: "All time" }));
    await user.click(dialog.getByRole("button", { name: "Export 3 records" }));

    await screen.findByText(/^Exported 3 records to tax-report-/);
    expect(await downloads[0].blob.text()).toContain("Category subtotals");
  });

  it("keeps a name the user typed when the layout changes", async () => {
    const { user, dialog } = await setup();
    await user.clear(dialog.getByLabelText("File name"));
    await user.type(dialog.getByLabelText("File name"), "my export");
    await user.click(dialog.getByRole("radio", { name: /Monthly summary/ }));
    expect(dialog.getByLabelText("File name")).toHaveValue("my export");
  });

  it("records a backup only when every expense is exported", async () => {
    captureDownloads();
    const { user, dialog } = await setup();
    await user.click(dialog.getByRole("checkbox", { name: /Bills/ }));
    await user.click(dialog.getByRole("button", { name: "Export 2 records" }));
    await screen.findByText(/^Exported 2 records/);
    expect(loadBackupState().lastBackupAt).toBeNull();

    await user.click(screen.getByRole("button", { name: "Open export" }));
    await screen.findByLabelText("Export summary");
    await user.click(screen.getByRole("button", { name: "Export 3 records" }));
    await screen.findByText(/^Exported 3 records/);
    expect(loadBackupState().lastBackupAt).not.toBeNull();
  });

  it("redacts descriptions in the preview and the file", async () => {
    const downloads = captureDownloads();
    const { user, dialog } = await setup();
    await user.click(dialog.getByLabelText(/Redact descriptions/));
    const fields = within(dialog.getByRole("list", { name: "Fields included" }));
    expect(fields.getByText("Description").closest("li")).toHaveClass("line-through");
    expect(dialog.queryByText("Lunch")).not.toBeInTheDocument();
    expect(dialog.getAllByText("[redacted]")).toHaveLength(3);

    await user.click(dialog.getByRole("button", { name: "Export 3 records" }));
    await screen.findByText(/^Exported 3 records/);
    expect(await downloads[0].blob.text()).not.toContain("Lunch");
  });

  it("hides the redaction option when the layout has no descriptions", async () => {
    const { user, dialog } = await setup();
    await user.click(dialog.getByRole("radio", { name: /Category analysis/ }));
    expect(dialog.queryByLabelText(/Redact descriptions/)).not.toBeInTheDocument();
  });

  it("keeps the dialog open and explains when the download fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => {
      throw new Error("blocked");
    });
    const { user, dialog } = await setup();
    await user.click(dialog.getByRole("button", { name: "Export 3 records" }));

    expect(await dialog.findByRole("alert")).toHaveTextContent("Export failed. Please try again.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Export 3 records" })).toBeEnabled();
  });
});

describe("Share via device", () => {
  function stubShare(share: (data: ShareData) => Promise<void>) {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", { configurable: true, value: vi.fn(share) });
    onTestFinished(() => {
      delete (navigator as { canShare?: unknown }).canShare;
      delete (navigator as { share?: unknown }).share;
    });
    return navigator.share as ReturnType<typeof vi.fn>;
  }

  it("is hidden when the browser can't share files", async () => {
    const { dialog } = await setup();
    expect(dialog.queryByRole("button", { name: "Share…" })).not.toBeInTheDocument();
  });

  it("shares the file and closes", async () => {
    const share = stubShare(async () => {});
    const { user, dialog } = await setup();
    await user.click(dialog.getByRole("button", { name: "Share…" }));

    expect(await screen.findByText(/^Shared expenses-\d{4}-\d{2}-\d{2}\.csv$/)).toBeInTheDocument();
    expect(share).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays open without an error when the share sheet is dismissed", async () => {
    stubShare(async () => Promise.reject(new DOMException("closed", "AbortError")));
    const { user, dialog } = await setup();
    await user.click(dialog.getByRole("button", { name: "Share…" }));

    await waitFor(() => expect(dialog.getByRole("button", { name: "Share…" })).toBeEnabled());
    expect(dialog.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
