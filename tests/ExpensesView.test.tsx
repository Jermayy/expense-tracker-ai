import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { ExpenseDialogProvider } from "@/features/expenses/components/ExpenseDialog";
import { ExpensesView } from "@/features/expenses/components/ExpensesView";
import { ExportDialogProvider } from "@/features/expenses/export/ExportDialog";
import { saveExpenses } from "@/features/expenses/lib/storage";
import { ExpensesProvider } from "@/features/expenses/state/ExpensesProvider";
import { buildExpense } from "./factories";

// Stand-in for the router's view of the URL, which can differ from window.location while it catches up.
let routerParams = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => routerParams }));

/** Point both the router and the address bar at a URL, as a client-side navigation does. */
function navigate(url: string) {
  window.history.pushState(null, "", url);
  routerParams = new URLSearchParams(window.location.search);
}

// A new element each time, so rerender() really re-renders the view.
const tree = () => (
  <ToastProvider>
    <ExpensesProvider>
      <ExportDialogProvider>
        <ExpenseDialogProvider>
          <ExpensesView />
        </ExpenseDialogProvider>
      </ExportDialogProvider>
    </ExpensesProvider>
  </ToastProvider>
);

beforeEach(() => {
  saveExpenses([
    buildExpense({ date: "2026-11-02", category: "Transportation", description: "Fuel" }),
    buildExpense({ date: "2026-11-01", category: "Food", description: "Groceries" }),
  ]);
});

afterEach(() => {
  navigate("/");
});

describe("ExpensesView URL sync", () => {
  it("reads filters from the URL", async () => {
    navigate("/expenses/?q=fuel");
    render(tree());
    expect(await screen.findByText(/^1 of 2 expenses/)).toBeInTheDocument();
    expect(screen.getByLabelText("Search expenses")).toHaveValue("fuel");
  });

  it("resets the filters when navigating to the unfiltered page while filtered", async () => {
    navigate("/expenses/?q=fuel");
    const { rerender } = render(tree());
    expect(await screen.findByText(/^1 of 2 expenses/)).toBeInTheDocument();

    navigate("/expenses/");
    rerender(tree());

    expect(await screen.findByText(/^2 expenses/)).toBeInTheDocument();
    expect(screen.getByLabelText("Search expenses")).toHaveValue("");
  });

  it("ignores a stale URL update while the user is typing", async () => {
    navigate("/expenses/");
    const { rerender } = render(tree());
    await userEvent.setup().type(await screen.findByLabelText("Search expenses"), "fu");
    expect(window.location.search).toBe("?q=fu");

    routerParams = new URLSearchParams("q=f"); // the router reporting an earlier keystroke late
    rerender(tree());

    expect(screen.getByLabelText("Search expenses")).toHaveValue("fu");
    expect(window.location.search).toBe("?q=fu");
  });
});
