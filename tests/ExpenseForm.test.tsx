import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExpenseForm } from "@/features/expenses/components/ExpenseForm";
import { NOW } from "./factories";

function setup(onSubmit = vi.fn()) {
  const user = userEvent.setup();
  render(<ExpenseForm submitLabel="Add expense" onSubmit={onSubmit} onCancel={vi.fn()} now={() => NOW} />);
  return { user, onSubmit };
}

describe("ExpenseForm", () => {
  it("defaults the date to today", () => {
    setup();
    expect(screen.getByLabelText("Date")).toHaveValue("2026-11-18");
  });

  it("shows inline errors and does not submit invalid input", async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole("button", { name: "Add expense" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Amount is required.")).toBeInTheDocument();
    expect(screen.getByText("Choose a category.")).toBeInTheDocument();
    expect(screen.getByText("Description is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Amount")).toHaveFocus();
  });

  it("submits normalised values", async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText("Amount"), "42.5");
    await user.selectOptions(screen.getByLabelText("Category"), "Shopping");
    await user.type(screen.getByLabelText("Description"), "New book");
    await user.click(screen.getByRole("button", { name: "Add expense" }));

    expect(onSubmit).toHaveBeenCalledWith({
      date: "2026-11-18",
      amountCents: 4250,
      category: "Shopping",
      description: "New book",
    });
  });

  it("keeps the user's input and shows the message when saving fails", async () => {
    const onSubmit = vi.fn(() => {
      throw new Error("Browser storage is full.");
    });
    const { user } = setup(onSubmit);
    await user.type(screen.getByLabelText("Amount"), "10");
    await user.selectOptions(screen.getByLabelText("Category"), "Food");
    await user.type(screen.getByLabelText("Description"), "Snacks");
    await user.click(screen.getByRole("button", { name: "Add expense" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Browser storage is full.");
    expect(screen.getByLabelText("Description")).toHaveValue("Snacks");
    expect(screen.getByRole("button", { name: "Add expense" })).toBeEnabled();
  });

  it("pre-fills values when editing", () => {
    render(
      <ExpenseForm
        initial={{ date: "2026-10-01", amountCents: 1999, category: "Bills", description: "Phone" }}
        submitLabel="Save changes"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        now={() => NOW}
      />,
    );
    expect(screen.getByLabelText("Amount")).toHaveValue("19.99");
    expect(screen.getByLabelText("Category")).toHaveValue("Bills");
  });
});
