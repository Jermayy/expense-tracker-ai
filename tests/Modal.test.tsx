import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Modal } from "@/components/ui/Modal";

it("focuses the [data-autofocus] element after opening, not the close button", () => {
  render(
    <Modal open title="Test" onClose={vi.fn()}>
      <input aria-label="Amount" data-autofocus />
    </Modal>,
  );
  expect(screen.getByLabelText("Amount")).toHaveFocus();
});
