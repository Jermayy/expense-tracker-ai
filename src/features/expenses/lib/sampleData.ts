import { toIsoDate } from "../domain/dates";
import type { Category, Expense } from "../domain/types";

type Template = [daysAgo: number, amountCents: number, category: Category, description: string];

// Synthetic data spread over ~5 months so every dashboard chart has something to show.
const TEMPLATES: Template[] = [
  [0, 1450, "Food", "Lunch at the café"],
  [1, 6230, "Transportation", "Fuel"],
  [2, 2899, "Entertainment", "Movie tickets"],
  [3, 18900, "Bills", "Electricity bill"],
  [4, 8745, "Food", "Weekly groceries"],
  [6, 4999, "Shopping", "Running shoes (sale)"],
  [8, 1200, "Transportation", "Train top-up"],
  [10, 7950, "Bills", "Mobile & internet"],
  [12, 9320, "Food", "Weekly groceries"],
  [15, 1599, "Entertainment", "Streaming subscription"],
  [19, 3500, "Other", "Birthday gift"],
  [24, 12999, "Shopping", "Winter jacket"],
  [29, 8410, "Food", "Weekly groceries"],
  [33, 18200, "Bills", "Electricity bill"],
  [37, 5480, "Transportation", "Fuel"],
  [41, 6500, "Entertainment", "Concert tickets"],
  [48, 2340, "Food", "Takeaway dinner"],
  [55, 7950, "Bills", "Mobile & internet"],
  [62, 8990, "Food", "Weekly groceries"],
  [70, 24900, "Shopping", "New headphones"],
  [77, 5820, "Transportation", "Fuel"],
  [85, 1599, "Entertainment", "Streaming subscription"],
  [96, 19450, "Bills", "Electricity bill"],
  [105, 7630, "Food", "Weekly groceries"],
  [118, 4200, "Other", "Haircut"],
  [130, 6100, "Transportation", "Fuel"],
  [142, 3150, "Food", "Brunch with friends"],
];

export function sampleExpenses(now: Date, newId: () => string): Expense[] {
  const stamp = now.toISOString();
  return TEMPLATES.map(([daysAgo, amountCents, category, description]) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
    return {
      id: newId(),
      date: toIsoDate(day),
      amountCents,
      category,
      description,
      createdAt: stamp,
      updatedAt: stamp,
    };
  });
}
