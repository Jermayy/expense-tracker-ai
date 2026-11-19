import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingSkeleton } from "@/features/expenses/components/StatusViews";
import { ExportsHub } from "@/features/exports/components/ExportsHub";

export const metadata: Metadata = { title: "Exports" };

export default function ExportsPage() {
  // useSearchParams requires a Suspense boundary in a statically exported page.
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ExportsHub />
    </Suspense>
  );
}
