import { formatDate } from "../../domain/dates";
import { CATEGORIES } from "../../domain/types";
import type { ExportOptions } from "../options";

export function describePeriod({ from, to }: Pick<ExportOptions, "from" | "to">): string {
  if (from && to) return `${formatDate(from)} – ${formatDate(to)}`;
  if (from) return `From ${formatDate(from)}`;
  if (to) return `Up to ${formatDate(to)}`;
  return "All dates";
}

export function describeCategories({ categories }: Pick<ExportOptions, "categories">): string {
  return categories.length === CATEGORIES.length ? "All categories" : categories.join(", ");
}
