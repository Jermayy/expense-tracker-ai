"use client";

import { useId, useRef, useState } from "react";
import { buttonStyles, inputBase, labelBase } from "@/components/ui/styles";
import { toIsoDate } from "../domain/dates";
import { centsToDecimalString } from "../domain/money";
import { CATEGORIES, type ExpenseInput } from "../domain/types";
import {
  MAX_DESCRIPTION_LENGTH,
  MIN_YEAR,
  validateExpense,
  type ExpenseFormErrors,
  type ExpenseFormValues,
} from "../domain/validation";

interface ExpenseFormProps {
  initial?: ExpenseInput;
  submitLabel: string;
  /** May throw (e.g. storage full); the message is shown and the user's input is kept. */
  onSubmit: (input: ExpenseInput) => void;
  onCancel: () => void;
  now?: () => Date;
}

const FIELD_ORDER: (keyof ExpenseFormValues)[] = ["date", "amount", "category", "description"];

function toFormValues(initial: ExpenseInput | undefined, today: Date): ExpenseFormValues {
  if (!initial) return { date: toIsoDate(today), amount: "", category: "", description: "" };
  return {
    date: initial.date,
    amount: centsToDecimalString(initial.amountCents),
    category: initial.category,
    description: initial.description,
  };
}

export function ExpenseForm({ initial, submitLabel, onSubmit, onCancel, now = () => new Date() }: ExpenseFormProps) {
  const [values, setValues] = useState(() => toFormValues(initial, now()));
  const [errors, setErrors] = useState<ExpenseFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();
  const today = toIsoDate(now());

  function set<K extends keyof ExpenseFormValues>(field: K, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    // Clear a field's error as soon as the user starts fixing it.
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitError(null);

    const result = validateExpense(values, now());
    if (!result.ok) {
      setErrors(result.errors);
      const first = FIELD_ORDER.find((f) => result.errors[f]);
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      onSubmit(result.value);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const fieldProps = (field: keyof ExpenseFormValues) => ({
    id: `${id}-${field}`,
    name: field,
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `${id}-${field}-error` : undefined,
  });

  const fieldError = (field: keyof ExpenseFormValues) =>
    errors[field] && (
      <p id={`${id}-${field}-error`} className="mt-1.5 text-sm text-danger">
        {errors[field]}
      </p>
    );

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-amount`} className={labelBase}>
            Amount
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-soft">
              $
            </span>
            <input
              {...fieldProps("amount")}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              data-autofocus
              value={values.amount}
              onChange={(e) => set("amount", e.target.value)}
              className={`${inputBase} pl-7 tabular-nums`}
            />
          </div>
          {fieldError("amount")}
        </div>

        <div>
          <label htmlFor={`${id}-date`} className={labelBase}>
            Date
          </label>
          <input
            {...fieldProps("date")}
            type="date"
            min={`${MIN_YEAR}-01-01`}
            max={today}
            value={values.date}
            onChange={(e) => set("date", e.target.value)}
            className={inputBase}
          />
          {fieldError("date")}
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-category`} className={labelBase}>
          Category
        </label>
        <select
          {...fieldProps("category")}
          value={values.category}
          onChange={(e) => set("category", e.target.value)}
          className={inputBase}
        >
          <option value="" disabled>
            Select a category
          </option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {fieldError("category")}
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor={`${id}-description`} className={labelBase}>
            Description
          </label>
          <span className="text-xs tabular-nums text-ink-soft">
            {values.description.length}/{MAX_DESCRIPTION_LENGTH}
          </span>
        </div>
        <input
          {...fieldProps("description")}
          type="text"
          maxLength={MAX_DESCRIPTION_LENGTH}
          placeholder="e.g. Weekly groceries"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          className={inputBase}
        />
        {fieldError("description")}
      </div>

      {submitError && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {submitError}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className={buttonStyles.secondary} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={buttonStyles.primary} disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
