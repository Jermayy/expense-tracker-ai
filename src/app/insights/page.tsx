import type { Metadata } from "next";
import { MonthlyInsights } from "@/features/expenses/components/MonthlyInsights";

export const metadata: Metadata = { title: "Monthly Insights" };

export default function InsightsPage() {
  return <MonthlyInsights />;
}
