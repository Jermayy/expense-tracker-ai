"use client";

import { useId } from "react";
import { inputBase } from "@/components/ui/styles";
import { CATEGORIES, type Category } from "../domain/types";
import { DEFAULT_FILTERS, SORT_OPTIONS, hasActiveFilters, type ExpenseFilters, type SortOption } from "../lib/filters";
import { CategoryDot } from "./CategoryBadge";

interface ExpenseFiltersBarProps {
  filters: ExpenseFilters;
  onChange: (filters: ExpenseFilters) => void;
}

export function ExpenseFiltersBar({ filters, onChange }: ExpenseFiltersBarProps) {
  const id = useId();
  const set = (patch: Partial<ExpenseFilters>) => onChange({ ...filters, ...patch });

  const toggleCategory = (category: Category) => {
    const next = filters.categories.includes(category)
      ? filters.categories.filter((c) => c !== category)
      : CATEGORIES.filter((c) => c === category || filters.categories.includes(c));
    set({ categories: next });
  };

  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <label htmlFor={`${id}-q`} className="sr-only">
            Search expenses
          </label>
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="currentColor"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
              clipRule="evenodd"
            />
          </svg>
          <input
            id={`${id}-q`}
            type="search"
            placeholder="Search descriptions…"
            value={filters.query}
            maxLength={100}
            onChange={(e) => set({ query: e.target.value })}
            className={`${inputBase} pl-9`}
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-from`} className="text-sm text-ink-muted">
            From
          </label>
          <input
            id={`${id}-from`}
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => set({ from: e.target.value })}
            aria-invalid={invalidRange || undefined}
            className={inputBase}
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-to`} className="text-sm text-ink-muted">
            To
          </label>
          <input
            id={`${id}-to`}
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => set({ to: e.target.value })}
            aria-invalid={invalidRange || undefined}
            className={inputBase}
          />
        </div>
        <div>
          <label htmlFor={`${id}-sort`} className="sr-only">
            Sort by
          </label>
          <select
            id={`${id}-sort`}
            value={filters.sort}
            onChange={(e) => set({ sort: e.target.value as SortOption })}
            className={inputBase}
          >
            {Object.entries(SORT_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {invalidRange && (
        <p role="alert" className="text-sm text-danger">
          “From” date is after “To” date — no expenses can match.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
        {CATEGORIES.map((c) => {
          const active = filters.categories.includes(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={active}
              onClick={() => toggleCategory(c)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                active
                  ? "border-accent bg-accent-soft text-ink"
                  : "border-line bg-surface text-ink-muted hover:border-ink-soft hover:text-ink"
              }`}
            >
              <CategoryDot category={c} />
              {c}
            </button>
          );
        })}
        {hasActiveFilters(filters) && (
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_FILTERS, sort: filters.sort })}
            className="ml-1 text-sm font-medium text-accent hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
