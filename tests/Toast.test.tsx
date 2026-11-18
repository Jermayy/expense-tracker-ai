import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTION_TOAST_DURATION_MS, TOAST_DURATION_MS, ToastProvider, useToast } from "@/components/ui/Toast";

function Trigger({ withAction }: { withAction?: boolean }) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => toast.show("Deleted item", withAction ? { action: { label: "Undo", onClick: () => {} } } : {})}
    >
      show
    </button>
  );
}

function setup(withAction = false) {
  render(
    <ToastProvider>
      <Trigger withAction={withAction} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "show" }));
}

describe("Toast auto-dismiss", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("dismisses plain toasts after the default duration", () => {
    setup();
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS));
    expect(screen.queryByText("Deleted item")).not.toBeInTheDocument();
  });

  it("keeps action toasts longer than plain ones", () => {
    setup(true);
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS));
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(ACTION_TOAST_DURATION_MS - TOAST_DURATION_MS));
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("pauses while hovered and resumes on leave", () => {
    setup(true);
    const toast = screen.getByRole("status");
    fireEvent.mouseEnter(toast);
    act(() => vi.advanceTimersByTime(ACTION_TOAST_DURATION_MS * 3));
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();

    fireEvent.mouseLeave(toast);
    act(() => vi.advanceTimersByTime(ACTION_TOAST_DURATION_MS));
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("pauses while a toast button has keyboard focus", () => {
    setup(true);
    act(() => screen.getByRole("button", { name: "Undo" }).focus());
    act(() => vi.advanceTimersByTime(ACTION_TOAST_DURATION_MS * 3));
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });
});
