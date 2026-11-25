"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { buttonStyles, inputBase, labelBase } from "@/components/ui/styles";
import { MAX_AMOUNT_CENTS, centsToDecimalString, formatCents, parseAmountToCents } from "../domain/money";
import type { Expense } from "../domain/types";
import { loadBudget, saveBudget } from "../lib/budget";
import { budgetStreak, dailyAllowanceCents } from "../lib/insights";

interface BudgetStreakCardProps {
  expenses: readonly Expense[];
  /** Spent so far this calendar month, for the progress bar. */
  monthTotalCents: number;
  now: Date;
}

const dashedCard = "rounded-xl border-2 border-dashed border-line bg-surface p-6";

/** "Budget streak": consecutive days at or under the daily allowance from a user-set monthly budget. */
export function BudgetStreakCard({ expenses, monthTotalCents, now }: BudgetStreakCardProps) {
  // undefined = not read yet. Storage isn't available while the static page is prerendered.
  const [budget, setBudget] = useState<number | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => setBudget(loadBudget()), []);

  const streak = useMemo(() => (budget ? budgetStreak(expenses, budget, now) : 0), [expenses, budget, now]);

  // After saving or cancelling, the form unmounts: send focus to "Edit budget" rather than <body>.
  // Depends on budget too, because a first save changes budget while editing stays false.
  useEffect(() => {
    if (!editing && returnFocus.current && editButtonRef.current) {
      returnFocus.current = false;
      editButtonRef.current.focus();
    }
  }, [editing, budget]);

  const heading = (
    <h2 id="streak-heading" className="text-base font-semibold text-ink">
      Budget streak
    </h2>
  );

  if (budget === undefined) {
    return <section className={`${dashedCard} h-48 animate-pulse`} aria-busy="true" aria-label="Budget streak" />;
  }

  if (budget === null || editing) {
    return (
      <section className={dashedCard} aria-labelledby="streak-heading">
        {heading}
        <p className="mt-1 text-sm text-ink-muted">
          {budget === null
            ? "Set a monthly budget to start a streak. Each day you spend at or under your daily share of it adds a day."
            : "Change your monthly budget. Your streak is recalculated from your expenses."}
        </p>
        <BudgetForm
          initialCents={budget}
          onSaved={(cents) => {
            setBudget(cents);
            returnFocus.current = true;
            setEditing(false);
          }}
          onCancel={
            budget === null
              ? undefined
              : () => {
                  returnFocus.current = true;
                  setEditing(false);
                }
          }
        />
      </section>
    );
  }

  const allowance = dailyAllowanceCents(budget, now);
  const usedShare = Math.min(monthTotalCents / budget, 1);
  const over = monthTotalCents > budget;

  return (
    <section className={`${dashedCard} text-center`} aria-labelledby="streak-heading">
      {heading}
      <p className="mt-2 text-5xl font-bold tabular-nums text-positive">{streak}</p>
      <p className="text-lg font-medium text-ink">
        {streak === 1 ? "day" : "days"}
        {streak > 0 ? "!" : ""}
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        {streak > 0
          ? `In a row at or under ${formatCents(allowance)} a day.`
          : `Today is over your ${formatCents(allowance)} daily allowance. Tomorrow is a fresh start.`}
      </p>

      <div className="mx-auto mt-5 max-w-xs text-left">
        <div className="flex justify-between text-xs text-ink-soft">
          <span>This month</span>
          <span className="tabular-nums">
            {formatCents(monthTotalCents)} of {formatCents(budget)}
          </span>
        </div>
        <div className="mt-1 h-3 rounded-full bg-surface-2" aria-hidden>
          <div
            className={`h-3 rounded-full ${over ? "bg-danger" : "bg-positive"}`}
            style={{ width: `${usedShare * 100}%` }}
          />
        </div>
        {over && <p className="mt-1 text-xs font-medium text-danger">Over this month&apos;s budget.</p>}
      </div>

      <button
        ref={editButtonRef}
        type="button"
        className={`${buttonStyles.ghost} mt-4`}
        onClick={() => setEditing(true)}
      >
        Edit budget
      </button>
    </section>
  );
}

function BudgetForm({
  initialCents,
  onSaved,
  onCancel,
}: {
  initialCents: number | null;
  onSaved: (cents: number) => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initialCents === null ? "" : centsToDecimalString(initialCents));
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const id = useId();

  // Only move focus when the user asked to edit; a first-time "set a budget" form shouldn't grab it.
  useEffect(() => {
    if (initialCents !== null) inputRef.current?.focus();
  }, [initialCents]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const cents = parseAmountToCents(value);
    if (cents === null || cents <= 0) {
      setError("Enter an amount greater than $0, like 2000 or 2,000.00.");
      inputRef.current?.focus();
      return;
    }
    if (cents > MAX_AMOUNT_CENTS) {
      setError(`Enter an amount up to ${formatCents(MAX_AMOUNT_CENTS)}.`);
      inputRef.current?.focus();
      return;
    }
    try {
      saveBudget(cents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your budget.");
      return;
    }
    toast.show("Budget saved");
    onSaved(cents);
  }

  return (
    <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={handleSubmit} noValidate>
      <div className="min-w-40 flex-1">
        <label htmlFor={`${id}-budget`} className={labelBase}>
          Monthly budget (AUD)
        </label>
        <input
          ref={inputRef}
          id={`${id}-budget`}
          className={inputBase}
          inputMode="decimal"
          autoComplete="off"
          placeholder="2000"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
        />
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <button type="button" className={buttonStyles.secondary} onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className={buttonStyles.primary}>
          Save budget
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
