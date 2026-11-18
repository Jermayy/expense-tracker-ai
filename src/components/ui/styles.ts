const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export const buttonStyles = {
  primary: `${buttonBase} bg-accent text-accent-ink hover:bg-accent-hover`,
  secondary: `${buttonBase} border border-line bg-surface text-ink hover:bg-surface-2`,
  danger: `${buttonBase} bg-danger text-white hover:opacity-90 dark:text-canvas`,
  ghost: `${buttonBase} text-ink-muted hover:bg-surface-2 hover:text-ink`,
};

export const iconButton =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink";

export const inputBase =
  "block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 aria-[invalid=true]:border-danger";

export const labelBase = "mb-1.5 block text-sm font-medium text-ink";

export const card = "rounded-xl border border-line bg-surface shadow-sm";
