import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { ExpenseDialogProvider } from "@/features/expenses/components/ExpenseDialog";
import { MonthlyInsights } from "@/features/expenses/components/MonthlyInsights";
import { BUDGET_STORAGE_KEY, loadBudget, saveBudget } from "@/features/expenses/lib/budget";
import { STORAGE_KEY, saveExpenses } from "@/features/expenses/lib/storage";
import { ExpensesProvider } from "@/features/expenses/state/ExpensesProvider";
import { buildExpense, NOW } from "./factories";

function renderInsights() {
  render(
    <ToastProvider>
      <ExpensesProvider>
        <ExpenseDialogProvider>
          <MonthlyInsights now={NOW} />
        </ExpenseDialogProvider>
      </ExpensesProvider>
    </ToastProvider>,
  );
}

const streakCard = () => within(screen.getByRole("region", { name: "Budget streak" }));

afterEach(() => {
  vi.restoreAllMocks();
});

const NOVEMBER = [
  buildExpense({ date: "2026-11-07", category: "Food", amountCents: 42_000 }),
  buildExpense({ date: "2026-11-10", category: "Transportation", amountCents: 18_000 }),
  buildExpense({ date: "2026-11-12", category: "Entertainment", amountCents: 9_500 }),
  buildExpense({ date: "2026-11-14", category: "Bills", amountCents: 3_000 }),
  buildExpense({ date: "2026-10-20", category: "Shopping", amountCents: 1_000 }),
];

describe("MonthlyInsights", () => {
  it("shows this month's donut and the top three categories in order", async () => {
    saveExpenses(NOVEMBER);
    renderInsights();

    expect(await screen.findByRole("heading", { name: "Monthly Insights" })).toBeInTheDocument();
    expect(screen.getByText("November 2026")).toBeInTheDocument();

    const donut = screen.getByRole("img", { name: /Spending by category/ });
    expect(donut).toHaveAccessibleName(
      "Spending by category: Food $420.00 (58%), Transportation $180.00 (25%), Entertainment $95.00 (13%), Bills $30.00 (4%).",
    );
    expect(within(donut).getByText("$725.00")).toBeInTheDocument();

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent(/Food.*\$420\.00/);
    expect(items[1]).toHaveTextContent(/Transportation.*\$180\.00/);
    expect(items[2]).toHaveTextContent(/Entertainment.*\$95\.00/);
  });

  it("shows an empty state when there are no expenses", async () => {
    renderInsights();
    expect(await screen.findByText("No expenses yet")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows a no-spending state when nothing was spent this month", async () => {
    saveExpenses([buildExpense({ date: "2026-10-01" })]);
    renderInsights();
    expect(await screen.findByText("No spending yet this month")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Budget streak" })).toBeInTheDocument();
  });

  it("asks for a budget, validates it, then shows the streak", async () => {
    saveExpenses(NOVEMBER);
    renderInsights();
    const user = userEvent.setup();

    const input = await screen.findByLabelText("Monthly budget (AUD)");
    await user.type(input, "0");
    await user.click(screen.getByRole("button", { name: "Save budget" }));
    expect(screen.getByRole("alert")).toHaveTextContent("greater than $0");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(loadBudget()).toBeNull();

    // $30,000/month = $1,000/day, so every day from the earliest expense (20 Oct) to today is under.
    await user.clear(input);
    await user.type(input, "30,000");
    await user.click(screen.getByRole("button", { name: "Save budget" }));

    expect(loadBudget()).toBe(3_000_000);
    expect(await streakCard().findByText("30")).toBeInTheDocument();
    expect(screen.getByText("days!")).toBeInTheDocument();
    expect(screen.getByText("In a row at or under $1,000.00 a day.")).toBeInTheDocument();
    expect(screen.getByText("$725.00 of $30,000.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit budget" })).toHaveFocus();
  });

  it("restarts the streak after a day over the allowance and lets the budget be edited", async () => {
    saveExpenses(NOVEMBER);
    saveBudget(300_000); // $100/day: the 12th ($95) and 14th ($30) are under, the 10th ($180) isn't.
    renderInsights();
    const user = userEvent.setup();

    expect(await streakCard().findByText("8")).toBeInTheDocument(); // 11th..18th
    expect(screen.getByText("In a row at or under $100.00 a day.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit budget" }));
    const input = screen.getByLabelText("Monthly budget (AUD)");
    expect(input).toHaveFocus();
    expect(input).toHaveValue("3000.00");

    await user.clear(input);
    await user.type(input, "50");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Edit budget" })).toHaveFocus();
    expect(loadBudget()).toBe(300_000);
    expect(screen.getByText("In a row at or under $100.00 a day.")).toBeInTheDocument();
  });

  it.each([
    ["abc", "greater than $0"],
    ["12.345", "greater than $0"],
    ["10000001", "up to $10,000,000.00"],
  ])("rejects a budget of %s", async (typed, message) => {
    saveExpenses(NOVEMBER);
    renderInsights();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Monthly budget (AUD)"), typed);
    await user.click(screen.getByRole("button", { name: "Save budget" }));
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(loadBudget()).toBeNull();
  });

  it("keeps the form open with an error when the budget can't be saved", async () => {
    saveExpenses(NOVEMBER);
    renderInsights();
    const user = userEvent.setup();
    const input = await screen.findByLabelText("Monthly budget (AUD)");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    await user.type(input, "2000");
    await user.click(screen.getByRole("button", { name: "Save budget" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save your budget");
    expect(input).toHaveValue("2000");
    expect(screen.queryByText("Budget saved")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(BUDGET_STORAGE_KEY)).toBeNull();
  });

  it("flags a month that's over budget", async () => {
    saveExpenses(NOVEMBER);
    saveBudget(50_000);
    renderInsights();
    expect(await screen.findByText("Over this month's budget.")).toBeInTheDocument();
  });

  it("shows the load error view without touching unreadable data", async () => {
    window.localStorage.setItem(STORAGE_KEY, "{broken");
    renderInsights();
    expect(await screen.findByText("We couldn't load your expenses")).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("{broken");
  });
});
