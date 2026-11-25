import { CATEGORIES, type Category } from "../domain/types";

/** Colour follows the category (fixed slot), never its rank. */
export function categoryColor(category: Category): string {
  return `var(--cat-${CATEGORIES.indexOf(category) + 1})`;
}

const CATEGORY_EMOJI: Record<Category, string> = {
  Food: "🍔",
  Transportation: "🚗",
  Entertainment: "🎬",
  Shopping: "🛍️",
  Bills: "🧾",
  Other: "📦",
};

/** Decorative only: always render next to the category name and hide it from assistive tech. */
export function categoryEmoji(category: Category): string {
  return CATEGORY_EMOJI[category];
}

export function CategoryDot({ category }: { category: Category }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: categoryColor(category) }}
    />
  );
}

export function CategoryBadge({ category }: { category: Category }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-muted">
      <CategoryDot category={category} />
      {category}
    </span>
  );
}
