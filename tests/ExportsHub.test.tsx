import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { saveExpenses } from "@/features/expenses/lib/storage";
import { ExpensesProvider } from "@/features/expenses/state/ExpensesProvider";
import { ActivityTray } from "@/features/exports/components/ActivityTray";
import { ExportsHub } from "@/features/exports/components/ExportsHub";
import { HUB_STORAGE_KEY, saveHubState } from "@/features/exports/lib/hubStorage";
import { sha256Hex, type JobDeps } from "@/features/exports/lib/runJob";
import { EMPTY_HUB_STATE } from "@/features/exports/lib/types";
import { ExportHubProvider } from "@/features/exports/state/ExportHubProvider";
import { buildExpense, NOW } from "./factories";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

const download = vi.fn();
let n = 0;
const deps: Partial<JobDeps> = {
  now: () => NOW,
  newId: () => `id-${++n}`,
  sleep: async () => {},
  download,
  digest: sha256Hex,
};

beforeEach(() => {
  download.mockReset();
  saveExpenses([
    buildExpense({ date: "2026-08-01", category: "Bills", amountCents: 12000, description: "Insurance" }),
    buildExpense({ date: "2026-11-02", category: "Food", amountCents: 1250, description: "Lunch" }),
  ]);
});

async function setup() {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <ExpensesProvider now={() => NOW}>
        <ExportHubProvider deps={deps}>
          <ExportsHub />
          <ActivityTray />
        </ExportHubProvider>
      </ExpensesProvider>
    </ToastProvider>,
  );
  await screen.findByRole("tablist", { name: "Export sections" });
  return { user };
}

const storedHub = () => JSON.parse(window.localStorage.getItem(HUB_STORAGE_KEY) ?? "null");

describe("Exports hub", () => {
  it("is upfront that cloud features are simulated", async () => {
    await setup();
    expect(screen.getByText("Cloud features are a demo.")).toBeInTheDocument();
  });

  it("downloads a template, logs it with a fingerprint and shows it in history", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("button", { name: "Export Tax report" }));
    const dialog = within(screen.getByRole("dialog", { name: "Export Tax report" }));
    expect(dialog.getByText(/^2 expenses · CSV/)).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Download" }));

    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(download.mock.calls[0][2]).toBe("spendwise-tax-report-fy2027.csv");
    expect(await screen.findByText("Tax report · Downloaded")).toBeInTheDocument();
    await waitFor(() => expect(storedHub().history).toHaveLength(1));
    expect(storedHub().history[0].checksum).toBe(await sha256Hex(download.mock.calls[0][0][0]));

    await user.click(screen.getByRole("tab", { name: /History/ }));
    const row = screen.getAllByRole("row")[1];
    expect(within(row).getByText("Tax report")).toBeInTheDocument();
    expect(within(row).getByText(storedHub().history[0].checksum.slice(0, 8))).toBeInTheDocument();
  });

  it("validates the email recipient and marks the send as simulated", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("button", { name: "Export Category analysis" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByRole("radio", { name: /Email/ }));
    await user.click(dialog.getByRole("button", { name: "Email (demo)" }));
    expect(dialog.getByText("Enter a valid email address.")).toBeInTheDocument();

    await user.type(dialog.getByLabelText("Recipient"), "accountant@example.com");
    await user.click(dialog.getByRole("button", { name: "Email (demo)" }));

    expect(await screen.findByText("Category analysis · Emailed (simulated)")).toBeInTheDocument();
    expect(download).not.toHaveBeenCalled();
    await waitFor(() => expect(storedHub().history[0]).toMatchObject({ simulated: true }));
    expect(storedHub().history[0].request.recipient).toBe("accountant@example.com");
  });

  it("redacts descriptions when asked", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("button", { name: "Export Full data" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByLabelText(/Redact descriptions/));
    await user.click(dialog.getByRole("button", { name: "Download" }));

    await waitFor(() => expect(download).toHaveBeenCalled());
    const content = download.mock.calls[0][0][0] as string;
    expect(content).not.toContain("Insurance");
    expect(JSON.parse(content).redacted).toBe(true);
  });

  it("requires connecting a cloud service before sending to it", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("button", { name: "Export Monthly summary" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByRole("radio", { name: /Dropbox/ }));
    await user.click(dialog.getByRole("button", { name: "Dropbox (demo)" }));
    expect(dialog.getByRole("alert")).toHaveTextContent("Connect Dropbox first.");

    await user.click(dialog.getByRole("button", { name: "Connect Dropbox" }));
    await waitFor(() => expect(storedHub().connections.dropbox).toBeDefined());
    await user.click(dialog.getByRole("button", { name: "Dropbox (demo)" }));
    expect(await screen.findByText("Monthly summary · Uploaded to Dropbox (simulated)")).toBeInTheDocument();
  });

  it("surfaces a due schedule and clears it once run", async () => {
    saveHubState({
      ...EMPTY_HUB_STATE,
      schedules: [
        {
          id: "s1",
          templateId: "full-data",
          destinationId: "download",
          frequency: "weekly",
          enabled: true,
          createdAt: new Date(NOW.getTime() - 8 * 24 * 3600 * 1000).toISOString(),
          lastRunAt: null,
        },
      ],
    });
    const { user } = await setup();
    const banner = within(screen.getByRole("region", { name: "Due exports" }));
    await user.click(banner.getByRole("button", { name: "Run now" }));

    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Due exports" })).not.toBeInTheDocument());
    expect(storedHub().schedules[0].lastRunAt).toBe(NOW.toISOString());
  });

  it("supports arrow-key tab navigation and mirrors the tab in the URL", async () => {
    const { user } = await setup();
    screen.getByRole("tab", { name: "Templates" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Destinations" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Destinations" })).toHaveFocus();
    expect(window.location.search).toBe("?tab=destinations");
    expect(screen.getByRole("heading", { name: "Google Sheets" })).toBeInTheDocument();
  });
});
