"use client";

import { useEffect } from "react";
import { buttonStyles, card } from "@/components/ui/styles";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] unhandled error", error);
  }, [error]);

  return (
    <div role="alert" className={`${card} mx-auto max-w-lg p-8 text-center`}>
      <h2 className="text-lg font-semibold text-ink">Something went wrong</h2>
      <p className="mt-2 text-sm text-ink-muted">An unexpected error occurred. Your saved expenses are not affected.</p>
      <button type="button" className={`${buttonStyles.primary} mt-6`} onClick={reset}>
        Try again
      </button>
    </div>
  );
}
