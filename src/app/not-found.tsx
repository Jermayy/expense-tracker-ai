import Link from "next/link";
import { buttonStyles, card } from "@/components/ui/styles";

export default function NotFound() {
  return (
    <div className={`${card} mx-auto max-w-lg p-8 text-center`}>
      <h2 className="text-lg font-semibold text-ink">Page not found</h2>
      <p className="mt-2 text-sm text-ink-muted">That page doesn&apos;t exist.</p>
      <Link href="/" className={`${buttonStyles.primary} mt-6`}>
        Back to dashboard
      </Link>
    </div>
  );
}
