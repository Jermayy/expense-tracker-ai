import { isIsoDate } from "../domain/dates";
import { CATEGORIES, isCategory, type Category, type Expense } from "../domain/types";

export const SORT_OPTIONS = {
  "date-desc": "Newest first",
  "date-asc": "Oldest first",
  "amount-desc": "Highest amount",
  "amount-asc": "Lowest amount",
} as const;

export type SortOption = keyof typeof SORT_OPTIONS;

export interface ExpenseFilters {
  query: string;
  from: string;
  to: string;
  categories: Category[];
  sort: SortOption;
}

export const DEFAULT_FILTERS: ExpenseFilters = {
  query: "",
  from: "",
  to: "",
  categories: [],
  sort: "date-desc",
};

const MAX_QUERY_LENGTH = 100;

function isSortOption(value: string | null): value is SortOption {
  return value !== null && value in SORT_OPTIONS;
}

/** Read filters from the URL, dropping anything malformed (the URL is untrusted input). */
export function filtersFromSearchParams(params: URLSearchParams): ExpenseFilters {
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const sort = params.get("sort");
  const categories = (params.get("cat") ?? "").split(",").filter(isCategory);
  return {
    query: (params.get("q") ?? "").slice(0, MAX_QUERY_LENGTH),
    from: isIsoDate(from) ? from : "",
    to: isIsoDate(to) ? to : "",
    // Keep canonical order and drop duplicates so the URL stays stable.
    categories: CATEGORIES.filter((c) => categories.includes(c)),
    sort: isSortOption(sort) ? sort : DEFAULT_FILTERS.sort,
  };
}

export function filtersToSearchParams(filters: ExpenseFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.categories.length) params.set("cat", filters.categories.join(","));
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set("sort", filters.sort);
  return params;
}

export function hasActiveFilters(filters: ExpenseFilters): boolean {
  return Boolean(filters.query || filters.from || filters.to || filters.categories.length);
}

const COMPARATORS: Record<SortOption, (a: Expense, b: Expense) => number> = {
  "date-desc": (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  "date-asc": (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  "amount-desc": (a, b) => b.amountCents - a.amountCents || b.date.localeCompare(a.date),
  "amount-asc": (a, b) => a.amountCents - b.amountCents || b.date.localeCompare(a.date),
};

export function applyFilters(expenses: readonly Expense[], filters: ExpenseFilters): Expense[] {
  const needle = filters.query.trim().toLowerCase();
  return expenses
    .filter((e) => {
      if (filters.from && e.date < filters.from) return false;
      if (filters.to && e.date > filters.to) return false;
      if (filters.categories.length && !filters.categories.includes(e.category)) return false;
      if (needle && !`${e.description} ${e.category}`.toLowerCase().includes(needle)) return false;
      return true;
    })
    .sort(COMPARATORS[filters.sort]);
}
