import type { Metadata } from "next";
import { Suspense } from "react";
import { ExpensesView } from "@/features/expenses/components/ExpensesView";
import { LoadingSkeleton } from "@/features/expenses/components/StatusViews";

export const metadata: Metadata = { title: "Expenses" };

export default function ExpensesPage() {
  // useSearchParams requires a Suspense boundary in a statically exported page.
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ExpensesView />
    </Suspense>
  );
}
