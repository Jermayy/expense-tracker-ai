import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  applyFilters,
  filtersFromSearchParams,
  filtersToSearchParams,
} from "@/features/expenses/lib/filters";
import { buildExpense } from "./factories";

const groceries = buildExpense({ date: "2026-11-01", amountCents: 8000, category: "Food", description: "Groceries" });
const fuel = buildExpense({ date: "2026-10-15", amountCents: 6000, category: "Transportation", description: "Fuel" });
const movie = buildExpense({
  date: "2026-09-20",
  amountCents: 2500,
  category: "Entertainment",
  description: "Movie night",
});
const all = [fuel, movie, groceries];

describe("applyFilters", () => {
  it("sorts newest first by default", () => {
    expect(applyFilters(all, DEFAULT_FILTERS)).toEqual([groceries, fuel, movie]);
  });

  it("filters by inclusive date range", () => {
    const result = applyFilters(all, { ...DEFAULT_FILTERS, from: "2026-10-15", to: "2026-11-01" });
    expect(result).toEqual([groceries, fuel]);
  });

  it("filters by categories", () => {
    expect(applyFilters(all, { ...DEFAULT_FILTERS, categories: ["Entertainment", "Food"] })).toEqual([
      groceries,
      movie,
    ]);
  });

  it("searches case-insensitively in description and category", () => {
    expect(applyFilters(all, { ...DEFAULT_FILTERS, query: "MOVIE" })).toEqual([movie]);
    expect(applyFilters(all, { ...DEFAULT_FILTERS, query: "transport" })).toEqual([fuel]);
  });

  it("sorts by amount", () => {
    expect(applyFilters(all, { ...DEFAULT_FILTERS, sort: "amount-asc" })).toEqual([movie, fuel, groceries]);
  });

  it("does not mutate the input", () => {
    const input = [...all];
    applyFilters(input, DEFAULT_FILTERS);
    expect(input).toEqual(all);
  });
});

describe("URL round trip", () => {
  it("serialises and parses filters", () => {
    const filters = {
      query: "fuel",
      from: "2026-01-01",
      to: "2026-02-01",
      categories: ["Food" as const],
      sort: "amount-desc" as const,
    };
    expect(filtersFromSearchParams(filtersToSearchParams(filters))).toEqual(filters);
  });

  it("omits defaults from the URL", () => {
    expect(filtersToSearchParams(DEFAULT_FILTERS).toString()).toBe("");
  });

  it("drops malformed values", () => {
    const params = new URLSearchParams("from=yesterday&to=2026-02-30&cat=Food,Nope,Food&sort=random");
    expect(filtersFromSearchParams(params)).toEqual({ ...DEFAULT_FILTERS, categories: ["Food"] });
  });
});
