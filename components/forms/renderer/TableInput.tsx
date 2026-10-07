"use client";

import { Eraser, Plus, Trash2 } from "lucide-react";
import { memo, useCallback, useId, useMemo, useRef } from "react";
import type { CellValue, FieldValue, RepeaterField, RowValue, TableColumn, TableField, TableRow, TableValue } from "@/lib/forms/types";
import { cellField, cellKey, isCellRequired, repeaterRowLabel, rowContext } from "@/lib/forms/validation";
import { cn } from "@/lib/utils";
import { buttonSecondary, errorText, helpText } from "@/components/ui/classes";
import { Control, RequiredMark } from "@/components/forms/renderer/inputs";
import { useFormMode } from "@/components/forms/renderer/mode";

export type FieldUpdater = (name: string, value: FieldValue | ((prev: FieldValue | undefined) => FieldValue)) => void;
type Errors = Record<string, string>;

const EMPTY_ROW: RowValue = {};
const NO_ERRORS: Errors = {};
const cellLabelClass = "block text-[12px] font-semibold uppercase tracking-[0.06em] text-muted";

function asRow(value: unknown): RowValue {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RowValue) : EMPTY_ROW;
}

const toCell = (v: FieldValue): CellValue => (typeof v === "string" || typeof v === "number" ? v : null);

/** Group "field.row.column" errors by row, keeping stable objects while errors are unchanged. */
function useRowErrors(errors: Errors, fieldName: string) {
  return useMemo(() => {
    const byRow = new Map<string, Errors>();
    const prefix = `${fieldName}.`;
    for (const [key, message] of Object.entries(errors)) {
      if (!key.startsWith(prefix)) continue;
      const [row, column] = key.slice(prefix.length).split(".");
      if (!row || !column) continue;
      byRow.set(row, { ...byRow.get(row), [column]: message });
    }
    return byRow;
  }, [errors, fieldName]);
}

/** Grid track of a column in the desktop grid layout. */
function gridTrack(column: TableColumn) {
  switch (column.input.type) {
    case "radio": {
      // Fixed width so the header row and every data row share the same tracks: each option is at
      // least 38px (or its label plus padding), with 4px gaps, 4px inner padding and a 1px border.
      const buttons = column.input.options.reduce((sum, o) => sum + Math.max(38, o.label.length * 8.5 + 20), 0);
      return `${Math.ceil(buttons + (column.input.options.length - 1) * 4 + 12)}px`;
    }
    case "textarea":
      return "minmax(0,1.6fr)";
    case "signature":
    case "datetime":
      return "minmax(0,1.15fr)";
    default:
      return "minmax(0,1fr)";
  }
}

/** One cell: its label (visible in card layouts), control, help and error. */
function Cell({
  field,
  column,
  rowId,
  rowLabel,
  rowValue,
  rowDef,
  error,
  disabled,
  onCell,
  labelClassName,
}: {
  field: TableField | RepeaterField;
  column: TableColumn;
  rowId: string;
  rowLabel: string;
  rowValue: RowValue;
  rowDef?: TableRow;
  error?: string;
  disabled: boolean;
  onCell: (rowId: string, column: string, value: CellValue) => void;
  labelClassName?: string;
}) {
  const uid = useId();
  const id = `${uid}-cell`;
  const mode = useFormMode();
  const required = isCellRequired(column, rowValue, rowDef);
  const context = `${rowContext(field, rowLabel)}: ${column.label}`;
  const control = cellField(column, cellKey(field.name, rowId, column.key), context, required);
  const describedBy = [column.helpText ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  // Radio groups and read-only values are named by aria-label, so their caption is not a <label>.
  const Caption = column.input.type === "radio" || mode === "review" ? "p" : "label";
  return (
    <div className="min-w-0">
      <Caption {...(Caption === "label" ? { htmlFor: id } : { "aria-hidden": true })} className={cn(cellLabelClass, "mb-1.5", labelClassName)}>
        {column.label}
        {required && mode !== "review" && <RequiredMark />}
      </Caption>
      <Control
        field={control}
        id={id}
        value={rowValue[column.key] ?? ""}
        onChange={(v) => onCell(rowId, column.key, toCell(v))}
        disabled={disabled}
        invalid={!!error}
        describedBy={describedBy}
        ariaLabel={context}
        compact
      />
      {column.helpText && mode !== "review" && (
        <p id={`${id}-help`} className={helpText}>
          {column.helpText}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={errorText}>
          {error}
        </p>
      )}
    </div>
  );
}

const TableRowView = memo(function TableRowView({
  field,
  row,
  rowValue,
  errors,
  disabled,
  onCell,
  layout,
  gridTemplate,
}: {
  field: TableField;
  row: TableRow;
  rowValue: RowValue;
  errors: Errors;
  disabled: boolean;
  onCell: (rowId: string, column: string, value: CellValue) => void;
  layout: "cards" | "grid" | "list";
  gridTemplate: string;
}) {
  if (layout === "list") {
    const column = field.columns[0];
    const required = isCellRequired(column, rowValue, row);
    return (
      <li className="flex items-start gap-3">
        <span className="mt-3 w-5 shrink-0 text-right text-sm font-semibold text-accent" aria-hidden="true">
          {row.label}
        </span>
        <div className="min-w-0 flex-1">
          <Control
            field={cellField(column, cellKey(field.name, row.key, column.key), `${field.label} ${row.label}`, required)}
            id={`${field.name}-${row.key}`}
            value={rowValue[column.key] ?? ""}
            onChange={(v) => onCell(row.key, column.key, toCell(v))}
            disabled={disabled}
            invalid={!!errors[column.key]}
            ariaLabel={`${field.label} ${row.label}${required ? " (required)" : ""}`}
            compact
          />
          {errors[column.key] && <p className={errorText}>{errors[column.key]}</p>}
        </div>
      </li>
    );
  }

  if (layout === "grid") {
    return (
      <li
        className="gap-x-4 rounded-lg border border-line bg-surface p-4 lg:grid lg:items-start lg:rounded-none lg:border-0 lg:border-t lg:bg-transparent lg:px-4 lg:py-3 lg:[grid-template-columns:var(--table-cols)] lg:first:border-t-0 lg:[&_[data-option-description]]:hidden"
        style={{ "--table-cols": gridTemplate } as React.CSSProperties}
      >
        <div className="mb-3 min-w-0 lg:mb-0 lg:pt-2">
          <p className="text-[13px] font-semibold text-accent">{row.label}</p>
          {row.description && <p className="mt-0.5 text-sm leading-snug text-primary">{row.description}</p>}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:contents">
          {field.columns.map((column) => (
            <Cell
              key={column.key}
              field={field}
              column={column}
              rowId={row.key}
              rowLabel={row.label}
              rowValue={rowValue}
              rowDef={row}
              error={errors[column.key]}
              disabled={disabled}
              onCell={onCell}
              labelClassName="lg:sr-only"
            />
          ))}
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-8 min-w-[32px] shrink-0 place-items-center rounded-lg bg-accent-soft px-1.5 text-[13px] font-bold text-accent">{row.label}</span>
        {row.description && <p className="pt-1 text-[15px] leading-relaxed text-primary">{row.description}</p>}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
        {field.columns.map((column) => (
          <div key={column.key} className={column.width === "half" ? "" : "sm:col-span-2"}>
            <Cell
              field={field}
              column={column}
              rowId={row.key}
              rowLabel={row.label}
              rowValue={rowValue}
              rowDef={row}
              error={errors[column.key]}
              disabled={disabled}
              onCell={onCell}
            />
          </div>
        ))}
      </div>
    </li>
  );
});

/** A table: fixed rows, each with the same input columns. */
export const TableInput = memo(function TableInput({
  field,
  value,
  errors,
  disabled,
  onChange,
}: {
  field: TableField;
  value: FieldValue | undefined;
  errors: Errors;
  disabled: boolean;
  onChange: FieldUpdater;
}) {
  const table = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as TableValue;
  const rowErrors = useRowErrors(errors, field.name);
  const layout = field.layout ?? "cards";
  const mode = useFormMode();
  const gridTemplate = useMemo(() => ["minmax(0,1.5fr)", ...field.columns.map(gridTrack)].join(" "), [field.columns]);

  const onCell = useCallback(
    (rowId: string, column: string, cell: CellValue) =>
      onChange(field.name, (prev) => {
        const current = (prev && typeof prev === "object" && !Array.isArray(prev) ? prev : {}) as TableValue;
        return { ...current, [rowId]: { ...current[rowId], [column]: cell } };
      }),
    [field.name, onChange]
  );

  return (
    <fieldset className="min-w-0">
      <legend className={cn("mb-3 text-sm font-semibold text-primary", layout !== "list" && "sr-only")}>{field.label}</legend>
      {field.helpText && <p className="mb-3 text-sm text-muted">{field.helpText}</p>}
      {layout === "grid" && (
        <div
          className="hidden gap-x-4 rounded-t-lg bg-primary px-4 py-2.5 text-xs font-semibold text-white lg:grid lg:[grid-template-columns:var(--table-cols)]"
          style={{ "--table-cols": gridTemplate } as React.CSSProperties}
          aria-hidden="true"
        >
          <span>{field.rowHeader ?? ""}</span>
          {field.columns.map((c) => (
            <span key={c.key}>
              {c.label}
              {c.required && mode !== "review" && <span className="ml-0.5 text-[#ffb4bb]">*</span>}
              {/* Conditionally required: the section text explains the condition. */}
              {!c.required && c.requiredWhen && mode !== "review" && <span className="ml-0.5 text-[#ffb4bb]">†</span>}
            </span>
          ))}
        </div>
      )}
      <ul
        className={cn(
          layout === "cards" && "space-y-4",
          layout === "list" && "space-y-2.5",
          layout === "grid" && "space-y-3 lg:space-y-0 lg:rounded-b-lg lg:border lg:border-t-0 lg:border-line lg:bg-surface"
        )}
      >
        {field.rows.map((row) => (
          <TableRowView
            key={row.key}
            field={field}
            row={row}
            rowValue={asRow(table[row.key])}
            errors={rowErrors.get(row.key) ?? NO_ERRORS}
            disabled={disabled}
            onCell={onCell}
            layout={layout}
            gridTemplate={gridTemplate}
          />
        ))}
      </ul>
    </fieldset>
  );
});

/** A register whose rows the user adds and removes. Blank rows are ignored on submit. */
export const RepeaterInput = memo(function RepeaterInput({
  field,
  value,
  errors,
  required,
  disabled,
  onChange,
}: {
  field: RepeaterField;
  value: FieldValue | undefined;
  errors: Errors;
  /** Effective requirement (it can depend on another field). */
  required: boolean;
  disabled: boolean;
  onChange: FieldUpdater;
}) {
  const rows = (Array.isArray(value) ? value : []) as RowValue[];
  const rowErrors = useRowErrors(errors, field.name);
  const mode = useFormMode();
  const editable = mode === "fill";
  const item = field.itemLabel ?? "row";
  const minRows = Math.max(field.minRows ?? 0, 1);
  const addRef = useRef<HTMLButtonElement>(null);
  const errorId = useId();
  // Generated identifiers ("ACT-03") follow the row position, so with identifiers only the last row
  // can be removed; other rows are cleared instead and every identifier stays stable.
  const removable = (index: number) => rows.length > minRows && (!field.rowLabel || index === rows.length - 1);
  const isBlank = (row: RowValue | undefined) => !row || field.columns.every((c) => row[c.key] === undefined || row[c.key] === null || row[c.key] === "");

  const onCell = useCallback(
    (rowId: string, column: string, cell: CellValue) =>
      onChange(field.name, (prev) => {
        const list = (Array.isArray(prev) ? [...prev] : []) as RowValue[];
        const index = Number(rowId);
        list[index] = { ...list[index], [column]: cell };
        return list;
      }),
    [field.name, onChange]
  );

  return (
    <fieldset className="min-w-0 outline-none" data-field={field.name} tabIndex={-1} aria-describedby={errors[field.name] ? errorId : undefined}>
      <legend className="mb-1 text-sm font-semibold text-primary">
        {field.label}
        {required && mode !== "review" && <RequiredMark />}
      </legend>
      {field.helpText && mode !== "review" && <p className="mb-3 text-sm text-muted">{field.helpText}</p>}
      {mode === "review" && rows.every(isBlank) && (
        <p className="mt-3 rounded-lg border border-dashed border-line-strong px-4 py-3 text-sm italic text-muted">No entries recorded.</p>
      )}
      <ol className="mt-3 space-y-3 empty:hidden">
        {rows.map((row, index) => {
          // A stored register keeps row positions (and so identifiers); unused rows are not shown.
          if (mode === "review" && isBlank(row)) return null;
          const label = repeaterRowLabel(field, index);
          const errs = rowErrors.get(String(index)) ?? NO_ERRORS;
          return (
            <li key={index} className="rounded-xl border border-line bg-surface p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="rounded-md bg-accent-soft px-2 py-1 font-mono text-[12px] font-semibold text-accent">{label}</span>
                {!editable ? null : removable(index) ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onChange(field.name, (prev) => (Array.isArray(prev) ? (prev as RowValue[]).filter((_, i) => i !== index) : []));
                      requestAnimationFrame(() => addRef.current?.focus());
                    }}
                    className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-danger-strong hover:bg-danger-soft disabled:opacity-60"
                    aria-label={`Remove ${label}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Remove
                  </button>
                ) : (
                  !isBlank(row) && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange(field.name, (prev) => (Array.isArray(prev) ? (prev as RowValue[]).map((r, i) => (i === index ? {} : r)) : []))}
                      className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-ink-nav hover:bg-accent-soft disabled:opacity-60"
                      aria-label={`Clear ${label}`}
                    >
                      <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
                      Clear
                    </button>
                  )
                )}
              </div>
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                {field.columns.map((column) => (
                  <div key={column.key} className={column.width === "half" ? "" : "sm:col-span-2"}>
                    <Cell
                      field={field}
                      column={column}
                      rowId={String(index)}
                      rowLabel={label}
                      rowValue={asRow(row)}
                      error={errs[column.key]}
                      disabled={disabled}
                      onCell={onCell}
                    />
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      {mode === "preview" && (
        <p className="mt-3 text-[13px] text-muted">
          Up to {field.maxRows} {field.maxRows === 1 ? item : `${item}s`} can be recorded. Blank rows are ignored.
        </p>
      )}
      {editable && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            ref={addRef}
            type="button"
            disabled={disabled || rows.length >= field.maxRows}
            onClick={() => onChange(field.name, (prev) => [...((Array.isArray(prev) ? prev : []) as RowValue[]), {}])}
            className={cn(buttonSecondary, "min-h-[38px] px-3")}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add {item}
          </button>
          <span className="text-[13px] text-muted">
            {rows.length} of {field.maxRows} rows · blank rows are ignored
          </span>
        </div>
      )}
      {errors[field.name] && (
        <p id={errorId} className={errorText}>
          {errors[field.name]}
        </p>
      )}
    </fieldset>
  );
});
