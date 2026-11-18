"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { buttonStyles, iconButton } from "@/components/ui/styles";
import { formatDate } from "../domain/dates";
import { formatCents } from "../domain/money";
import type { Expense } from "../domain/types";
import { useExpenses } from "../state/ExpensesProvider";
import { CategoryBadge, CategoryDot } from "./CategoryBadge";
import { useExpenseDialog } from "./ExpenseDialog";

const PAGE_SIZE = 50;

function useDeleteWithUndo() {
  const { remove, restore } = useExpenses();
  const toast = useToast();
  return useCallback(
    (expense: Expense) => {
      try {
        const removed = remove(expense.id);
        toast.show(`Deleted “${removed.description}”`, {
          tone: "info",
          action: {
            label: "Undo",
            onClick: () => {
              try {
                restore(removed);
              } catch (err) {
                toast.show(err instanceof Error ? err.message : "Couldn't restore expense.", { tone: "error" });
              }
            },
          },
        });
      } catch (err) {
        toast.show(err instanceof Error ? err.message : "Couldn't delete expense.", { tone: "error" });
      }
    },
    [remove, restore, toast],
  );
}

function RowActions({ expense, onDelete }: { expense: Expense; onDelete: (e: Expense) => void }) {
  const { openEdit } = useExpenseDialog();
  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        className={iconButton}
        aria-label={`Edit ${expense.description}`}
        title="Edit"
        onClick={() => openEdit(expense)}
      >
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
          <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
        </svg>
      </button>
      <button
        type="button"
        className={`${iconButton} hover:!text-danger`}
        aria-label={`Delete ${expense.description}`}
        title="Delete"
        onClick={() => onDelete(expense)}
      >
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}

interface ExpenseListProps {
  expenses: Expense[];
  /** Hide pagination, e.g. for the dashboard's "recent" widget. */
  limit?: number;
}

export function ExpenseList({ expenses, limit }: ExpenseListProps) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const onDelete = useDeleteWithUndo();
  const shown = expenses.slice(0, limit ?? visible);
  const remaining = limit ? 0 : expenses.length - shown.length;

  return (
    <div>
      {/* Desktop: table */}
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-ink-soft">
            <th scope="col" className="px-5 py-3 font-medium">
              Date
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              Description
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              Category
            </th>
            <th scope="col" className="px-5 py-3 text-right font-medium">
              Amount
            </th>
            <th scope="col" className="px-5 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {shown.map((e) => (
            <tr key={e.id} className="hover:bg-surface-2/60 transition-colors">
              <td className="whitespace-nowrap px-5 py-3 text-ink-muted">{formatDate(e.date)}</td>
              <td className="max-w-xs truncate px-5 py-3 font-medium text-ink" title={e.description}>
                {e.description}
              </td>
              <td className="px-5 py-3">
                <CategoryBadge category={e.category} />
              </td>
              <td className="whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums text-ink">
                {formatCents(e.amountCents)}
              </td>
              <td className="w-24 px-3 py-1.5">
                <RowActions expense={e} onDelete={onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile: cards */}
      <ul className="divide-y divide-line md:hidden">
        {shown.map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-4 py-3">
            <CategoryDot category={e.category} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{e.description}</p>
              <p className="text-xs text-ink-soft">
                {formatDate(e.date)} · {e.category}
              </p>
            </div>
            <p className="font-semibold tabular-nums text-ink">{formatCents(e.amountCents)}</p>
            <RowActions expense={e} onDelete={onDelete} />
          </li>
        ))}
      </ul>

      {remaining > 0 && (
        <div className="border-t border-line p-4 text-center">
          <button type="button" className={buttonStyles.secondary} onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Show {Math.min(remaining, PAGE_SIZE)} more
          </button>
        </div>
      )}
    </div>
  );
}
