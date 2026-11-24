"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { buttonStyles, inputBase, labelBase } from "@/components/ui/styles";
import { CATEGORIES, type Category, type Expense } from "../domain/types";
import { CategoryDot } from "../components/CategoryBadge";
import { recordBackup } from "../lib/backupReminder";
import { useExpenses } from "../state/ExpensesProvider";
import { FORMAT_SPECS } from "./formats";
import {
  DATE_PRESETS,
  EXPORT_LAYOUTS,
  EXPORT_FORMATS,
  MAX_FILENAME_LENGTH,
  activePreset,
  defaultExportOptions,
  fileFields,
  includesDescriptions,
  isFullBackup,
  suggestedFilename,
  presetRange,
  sanitizeFilename,
  selectExportRecords,
  summarizeExport,
  validateExportOptions,
  type DatePreset,
  type ExportLayout,
  type ExportOptions,
} from "./options";
import { ExportPreviewTable, ExportSummaryStats } from "./ExportPreview";
import { canShareFiles, isShareCancelled, runExport, shareExport } from "./runExport";

export type InitialOptions = Partial<Pick<ExportOptions, "from" | "to" | "categories">>;

interface ExportPanelProps {
  initial: InitialOptions;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}

export function ExportPanel({ initial, onBusyChange, onDone }: ExportPanelProps) {
  const id = useId();
  const { expenses } = useExpenses();
  const toast = useToast();
  // Fixed for the dialog's lifetime so presets and the default filename don't shift mid-edit.
  const [now] = useState(() => new Date());
  const [options, setOptions] = useState(() => defaultExportOptions(now, initial));
  const [exporting, setExporting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // The panel loads after the dialog opens, so the Modal's initial focus can't find this
  // form yet; focus the intended field once it's mounted.
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, []);

  // Until the user types their own name, the filename follows the layout and date range.
  const [filenameEdited, setFilenameEdited] = useState(false);
  const set = (patch: Partial<ExportOptions>) => {
    setFailure(null);
    setOptions((current) => {
      const next = { ...current, ...patch };
      return filenameEdited || "filename" in patch ? next : { ...next, filename: suggestedFilename(next, now) };
    });
  };

  const records = useMemo(() => selectExportRecords(expenses, options), [expenses, options]);
  const summary = useMemo(() => summarizeExport(records), [records]);
  const errors = validateExportOptions(options);
  const spec = FORMAT_SPECS[options.format];
  const filename = `${sanitizeFilename(options.filename, options.format) || "…"}.${spec.extension}`;
  const canExport = Object.keys(errors).length === 0 && summary.count > 0 && !exporting;
  const [deviceShareSupported] = useState(canShareFiles);
  const redacting = options.redact && includesDescriptions(options);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canExport) return;
    setExporting(true);
    onBusyChange(true);
    try {
      const file = await runExport(expenses, options);
      if (isFullBackup(options, file.summary.count, expenses.length)) recordBackup(new Date());
      toast.show(
        `Exported ${file.summary.count} ${file.summary.count === 1 ? "record" : "records"} to ${file.filename}`,
      );
      onDone();
    } catch (err) {
      console.error("[export] failed", { format: options.format, count: summary.count }, err);
      setFailure("Export failed. Please try again.");
      setExporting(false);
      onBusyChange(false);
    }
  }

  // Not an async-first handler: the share sheet must open within the click (see shareExport).
  function share() {
    if (!canExport) return;
    setExporting(true);
    onBusyChange(true);
    shareExport(expenses, options).then(
      (file) => {
        if (isFullBackup(options, file.summary.count, expenses.length)) recordBackup(new Date());
        toast.show(`Shared ${file.filename}`);
        onDone();
      },
      (err) => {
        setExporting(false);
        onBusyChange(false);
        if (isShareCancelled(err)) return;
        console.error("[export] share failed", { format: options.format, count: summary.count }, err);
        setFailure("Sharing failed. Try Export instead.");
      },
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate aria-busy={exporting}>
      <div className="grid gap-6 md:grid-cols-[21rem_minmax(0,1fr)]">
        <fieldset disabled={exporting} className="m-0 min-w-0 space-y-6 border-0 p-0">
          <FormatPicker value={options.format} onChange={(format) => set({ format })} />
          {options.format === "csv" && <LayoutPicker value={options.layout} onChange={(layout) => set({ layout })} />}
          <DateRangeFields id={id} options={options} errors={errors} now={now} onChange={set} />
          <CategoryPicker
            expenses={expenses}
            options={options}
            error={errors.categories}
            onChange={(categories) => set({ categories })}
          />
          <div>
            <label htmlFor={`${id}-filename`} className={labelBase}>
              File name
            </label>
            <div className="flex items-stretch">
              <input
                id={`${id}-filename`}
                value={options.filename}
                maxLength={MAX_FILENAME_LENGTH + 10}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => {
                  setFilenameEdited(true);
                  set({ filename: e.target.value });
                }}
                aria-invalid={errors.filename ? true : undefined}
                aria-describedby={errors.filename ? `${id}-filename-error` : undefined}
                className={`${inputBase} rounded-r-none`}
              />
              <span className="inline-flex items-center rounded-r-lg border border-l-0 border-line bg-surface-2 px-3 text-sm text-ink-muted">
                .{spec.extension}
              </span>
            </div>
            {errors.filename && (
              <p id={`${id}-filename-error`} className="mt-1.5 text-sm text-danger">
                {errors.filename}
              </p>
            )}
          </div>
          <FileContents
            options={options}
            onRedactChange={(redact) => set({ redact })}
            shareAvailable={deviceShareSupported}
          />
        </fieldset>

        <div className="min-w-0 space-y-4 md:sticky md:top-0 md:self-start">
          <ExportSummaryStats summary={summary} />
          <ExportPreviewTable records={records} redacted={redacting} />
        </div>
      </div>

      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex flex-col-reverse gap-3 border-t border-line bg-surface px-6 pb-6 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 truncate text-sm text-ink-muted">
          {failure ? (
            <span role="alert" className="text-danger">
              {failure}
            </span>
          ) : (
            <>
              {spec.label} · <span className="font-medium text-ink">{filename}</span>
            </>
          )}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className={buttonStyles.secondary} onClick={onDone} disabled={exporting}>
            Cancel
          </button>
          {deviceShareSupported && (
            <button type="button" className={buttonStyles.secondary} onClick={share} disabled={!canExport}>
              Share…
            </button>
          )}
          <button type="submit" className={buttonStyles.primary} disabled={!canExport}>
            {exporting ? (
              <>
                <Spinner />
                Exporting…
              </>
            ) : summary.count === 0 ? (
              "Nothing to export"
            ) : (
              `Export ${summary.count} ${summary.count === 1 ? "record" : "records"}`
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

/** Visible tick so the selected state isn't conveyed by colour alone. */
function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
        checked ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface"
      }`}
    >
      {checked && (
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
          <path d="M12.7 4.3a1 1 0 0 1 0 1.4l-5.5 5.5a1 1 0 0 1-1.4 0L3.3 8.7a1 1 0 1 1 1.4-1.4l1.8 1.8 4.8-4.8a1 1 0 0 1 1.4 0Z" />
        </svg>
      )}
    </span>
  );
}

function Spinner() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 animate-spin motion-reduce:animate-none" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const legend = "mb-2 text-sm font-medium text-ink";

/** What leaves the device, and the option to hide descriptions. Adapted from V3's privacy panel. */
function FileContents({
  options,
  onRedactChange,
  shareAvailable,
}: {
  options: ExportOptions;
  onRedactChange: (redact: boolean) => void;
  shareAvailable: boolean;
}) {
  const id = useId();
  const canRedact = includesDescriptions(options);
  const redacting = options.redact && canRedact;
  return (
    <section aria-labelledby={`${id}-h`} className="rounded-lg bg-surface-2 p-4">
      <h3 id={`${id}-h`} className="text-sm font-semibold text-ink">
        What&apos;s in the file
      </h3>
      <p className="mt-1 text-xs text-ink-muted">
        {shareAvailable
          ? "Export saves it to this device. Share sends it to the app you pick."
          : "Saved to this device. Nothing is uploaded."}
      </p>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Fields included">
        {fileFields(options).map((field) => {
          const removed = redacting && field === "Description";
          return (
            <li
              key={field}
              className={`rounded-full border border-line px-2 py-0.5 text-xs ${
                removed ? "text-ink-soft line-through" : "bg-surface text-ink"
              }`}
            >
              {field}
              {removed && <span className="sr-only"> (redacted)</span>}
            </li>
          );
        })}
      </ul>
      {canRedact && (
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={options.redact}
            onChange={(e) => onRedactChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
          />
          <span>
            Redact descriptions
            <span className="block text-xs text-ink-muted">
              Share amounts and categories without saying what you bought.
            </span>
          </span>
        </label>
      )}
    </section>
  );
}

function LayoutPicker({ value, onChange }: { value: ExportLayout; onChange: (layout: ExportLayout) => void }) {
  const name = useId();
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className={legend}>Layout</legend>
      <div className="space-y-1">
        {(Object.keys(EXPORT_LAYOUTS) as ExportLayout[]).map((layout) => (
          <label
            key={layout}
            className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2"
          >
            <input
              type="radio"
              name={name}
              value={layout}
              checked={value === layout}
              onChange={() => onChange(layout)}
              className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            />
            <span>
              <span className="block font-medium text-ink">{EXPORT_LAYOUTS[layout].label}</span>
              <span className="block text-xs text-ink-muted">{EXPORT_LAYOUTS[layout].description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function FormatPicker({
  value,
  onChange,
}: {
  value: ExportOptions["format"];
  onChange: (f: ExportOptions["format"]) => void;
}) {
  const name = useId();
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className={legend}>Format</legend>
      <div className="space-y-2">
        {EXPORT_FORMATS.map((format) => {
          const spec = FORMAT_SPECS[format];
          const selected = value === format;
          return (
            <label
              key={format}
              className={`has-[:focus-visible]:ring-accent/40 flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 ${
                selected ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={format}
                checked={selected}
                onChange={() => onChange(format)}
                data-autofocus={selected ? "" : undefined}
                className="sr-only"
              />
              <span
                aria-hidden
                className={`inline-flex h-9 w-11 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tracking-wide ${
                  selected ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-muted"
                }`}
              >
                {spec.label}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{spec.label}</span>
                <span className="block text-xs text-ink-muted">{spec.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

interface DateRangeFieldsProps {
  id: string;
  options: ExportOptions;
  errors: ReturnType<typeof validateExportOptions>;
  now: Date;
  onChange: (patch: Partial<ExportOptions>) => void;
}

function DateRangeFields({ id, options, errors, now, onChange }: DateRangeFieldsProps) {
  const current = activePreset(options, now);
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className={legend}>Date range</legend>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(Object.keys(DATE_PRESETS) as DatePreset[]).map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={current === preset}
            onClick={() => onChange(presetRange(preset, now))}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              current === preset
                ? "border-accent bg-accent-soft text-ink"
                : "border-line text-ink-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {DATE_PRESETS[preset]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["from", "to"] as const).map((field) => (
          <div key={field}>
            <label htmlFor={`${id}-${field}`} className="mb-1 block text-xs text-ink-muted">
              {field === "from" ? "Start date" : "End date"}
            </label>
            <input
              id={`${id}-${field}`}
              type="date"
              value={options[field]}
              min={field === "to" ? options.from || undefined : undefined}
              max={field === "from" ? options.to || undefined : undefined}
              onChange={(e) => onChange({ [field]: e.target.value })}
              aria-invalid={errors[field] ? true : undefined}
              aria-describedby={errors[field] ? `${id}-${field}-error` : undefined}
              className={`${inputBase} px-2`}
            />
          </div>
        ))}
      </div>
      {(["from", "to"] as const).map(
        (field) =>
          errors[field] && (
            <p key={field} id={`${id}-${field}-error`} className="mt-1.5 text-sm text-danger">
              {errors[field]}
            </p>
          ),
      )}
    </fieldset>
  );
}

interface CategoryPickerProps {
  expenses: readonly Expense[];
  options: ExportOptions;
  error?: string;
  onChange: (categories: Category[]) => void;
}

function CategoryPicker({ expenses, options, error, onChange }: CategoryPickerProps) {
  const errorId = useId();
  // Per-category counts within the chosen dates, so it's clear what each toggle contributes.
  const counts = useMemo(() => {
    const inRange = selectExportRecords(expenses, { ...options, categories: [...CATEGORIES] });
    const map = new Map<Category, number>();
    for (const e of inRange) map.set(e.category, (map.get(e.category) ?? 0) + 1);
    return map;
  }, [expenses, options]);

  const toggle = (category: Category) =>
    onChange(
      options.categories.includes(category)
        ? options.categories.filter((c) => c !== category)
        : CATEGORIES.filter((c) => c === category || options.categories.includes(c)),
    );

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0" aria-describedby={error ? errorId : undefined}>
      <div className="mb-2 flex items-baseline justify-between">
        <legend className="float-left text-sm font-medium text-ink">Categories</legend>
        <span className="flex gap-3 text-xs">
          <button
            type="button"
            className="font-medium text-accent hover:underline"
            onClick={() => onChange([...CATEGORIES])}
          >
            All
          </button>
          <button type="button" className="font-medium text-accent hover:underline" onClick={() => onChange([])}>
            None
          </button>
        </span>
      </div>
      <div className="clear-both grid grid-cols-2 gap-1.5 md:grid-cols-1">
        {CATEGORIES.map((category) => {
          const checked = options.categories.includes(category);
          return (
            <label
              key={category}
              className={`has-[:focus-visible]:ring-accent/40 flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 ${
                checked ? "border-accent/60 bg-accent-soft text-ink" : "border-line text-ink-muted hover:bg-surface-2"
              }`}
            >
              <input type="checkbox" checked={checked} onChange={() => toggle(category)} className="sr-only" />
              <CheckMark checked={checked} />
              <CategoryDot category={category} />
              <span className="min-w-0 flex-1 truncate">{category}</span>
              <span className="text-xs tabular-nums text-ink-soft">{counts.get(category) ?? 0}</span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
