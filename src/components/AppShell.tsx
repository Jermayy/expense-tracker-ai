"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonStyles } from "@/components/ui/styles";
import { useExpenseDialog } from "@/features/expenses/components/ExpenseDialog";
import { useExpenses } from "@/features/expenses/state/ExpensesProvider";
import { ActivityTray } from "@/features/exports/components/ActivityTray";
import { SyncStatus } from "@/features/exports/components/SyncStatus";
import { useExportHub } from "@/features/exports/state/ExportHubProvider";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/expenses/", label: "Expenses" },
  { href: "/exports/", label: "Exports" },
];

function isActive(pathname: string, href: string): boolean {
  const normalise = (p: string) => p.replace(/\/$/, "") || "/";
  return normalise(pathname) === normalise(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { openAdd } = useExpenseDialog();
  const { status } = useExpenses();
  const { dueSchedules } = useExportHub();

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="bg-surface/90 sticky top-0 z-30 border-b border-line backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-ink">
              <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M10.75 10.818v2.614A3.13 3.13 0 0 0 11.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 0 0-1.138-.432ZM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 0 0-.35.13c-.14.065-.27.143-.386.233-.377.292-.514.627-.514.909 0 .184.058.39.202.592.037.051.08.102.128.152Z" />
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-6a.75.75 0 0 1 .75.75v.316a3.78 3.78 0 0 1 1.653.713c.426.33.744.74.925 1.2a.75.75 0 0 1-1.395.55 1.35 1.35 0 0 0-.447-.563 2.187 2.187 0 0 0-.736-.363V9.3c.698.093 1.383.32 1.959.696.787.514 1.29 1.27 1.29 2.13 0 .86-.504 1.616-1.29 2.13-.576.377-1.261.603-1.96.696v.299a.75.75 0 1 1-1.5 0v-.3c-.697-.092-1.382-.318-1.958-.695-.482-.315-.857-.717-1.078-1.188a.75.75 0 1 1 1.359-.636c.08.173.245.376.54.569.313.205.706.353 1.138.432v-2.748a3.782 3.782 0 0 1-1.653-.713C6.9 9.433 6.5 8.681 6.5 7.875c0-.805.4-1.558 1.097-2.096a3.78 3.78 0 0 1 1.653-.713V4.75A.75.75 0 0 1 10 4Z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <span className="hidden sm:inline">Spendwise</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active ? "bg-accent-soft text-ink" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  {item.label}
                  {item.href === "/exports/" && dueSchedules.length > 0 && (
                    <>
                      <span
                        aria-hidden
                        className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle"
                      />
                      <span className="sr-only"> ({dueSchedules.length} due)</span>
                    </>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <SyncStatus />
            <button type="button" className={buttonStyles.primary} onClick={openAdd} disabled={status !== "ready"}>
              <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
              </svg>
              <span>
                Add<span className="hidden sm:inline"> expense</span>
              </span>
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
      <ActivityTray />
      <footer className="border-t border-line py-6 text-center text-xs text-ink-soft">
        Your data is stored only in this browser. Export to CSV regularly to keep a backup.
      </footer>
    </div>
  );
}
