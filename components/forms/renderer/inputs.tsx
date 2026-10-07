"use client";

import { Check, Minus } from "lucide-react";
import { memo, useRef } from "react";
import type { FieldOption, FieldValue, ScalarFormField } from "@/lib/forms/types";
import { DEFAULT_SIGNATURE_MAX, isEmptyValue } from "@/lib/forms/validation";
import { formatEnteredDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { errorText, helpText, inputBase, inputError, labelText, selectBase } from "@/components/ui/classes";
import { useFormMode } from "@/components/forms/renderer/mode";

const readOnlyBox = "min-h-[44px] rounded-lg border border-line bg-surface-subtle px-3.5 py-2.5 text-[15px] leading-relaxed text-primary break-words";

function optionText(option: FieldOption | undefined, raw: string) {
  if (!option) return raw;
  return option.description ? `${option.label} (${option.description})` : option.label;
}

export function NotAnswered() {
  return <span className="text-[14px] italic text-muted">Not answered</span>;
}

export function RequiredMark() {
  return (
    <span className="ml-0.5 text-danger" aria-hidden="true">
      *
    </span>
  );
}

/** A stored answer shown as text (review mode). */
export function ReadOnlyValue({
  field,
  id,
  value,
  ariaLabel,
  labelledBy,
  compact,
}: {
  field: ScalarFormField;
  id?: string;
  value: FieldValue | undefined;
  ariaLabel?: string;
  labelledBy?: string;
  compact?: boolean;
}) {
  let content: React.ReactNode;
  if (isEmptyValue(value)) {
    content = <NotAnswered />;
  } else {
    const text = typeof value === "object" ? "" : String(value);
    switch (field.type) {
      case "select":
      case "radio": {
        const option = field.options.find((o) => o.value === text);
        content = option ? (
          <span title={option.description}>
            <span className={cn(compact && "font-semibold")}>{option.label}</span>
            {/* Hidden in narrow grid columns, where the code alone is shown (data-option-description). */}
            {option.description && <span data-option-description=""> ({option.description})</span>}
          </span>
        ) : (
          text
        );
        break;
      }
      case "checkboxes": {
        const selected = (Array.isArray(value) ? value : []) as string[];
        content = (
          <ul className="space-y-1">
            {selected.map((v) => (
              <li key={v} className="flex items-start gap-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                {optionText(
                  field.options.find((o) => o.value === v),
                  v
                )}
              </li>
            ))}
          </ul>
        );
        break;
      }
      case "date":
      case "datetime":
        content = formatEnteredDate(text);
        break;
      case "signature":
        content = <span className="font-serif text-[17px] italic tracking-wide">{text}</span>;
        break;
      case "textarea":
        content = <span className="whitespace-pre-wrap">{text}</span>;
        break;
      default:
        content = text;
    }
  }
  return (
    <div
      id={id}
      role={ariaLabel || labelledBy ? "group" : undefined}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      className={cn(readOnlyBox, compact && "text-[14px]")}
    >
      {content}
    </div>
  );
}

/**
 * Compact single-choice control for short codes (M / P / N / N/A, P1–P4) used in table cells.
 * Keyboard: arrow keys move and select, like a native radio group. Clicking the selected option of
 * an optional control clears it.
 */
export function SegmentedChoice({
  name,
  options,
  value,
  onChange,
  disabled,
  required,
  invalid,
  ariaLabel,
  describedBy,
}: {
  name: string;
  options: FieldOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  ariaLabel: string;
  describedBy?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex((o) => o.value === value);

  function move(from: number, delta: number) {
    const next = (from + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      aria-required={required || undefined}
      aria-invalid={invalid || undefined}
      className={cn("inline-flex max-w-full flex-wrap gap-1 rounded-lg border bg-surface-hover p-1", invalid ? "border-danger" : "border-line-strong")}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        const tabbable = selectedIndex === -1 ? index === 0 : checked;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.description ? `${option.label}: ${option.description}` : undefined}
            tabIndex={tabbable ? 0 : -1}
            disabled={disabled}
            title={option.description ? `${option.label}: ${option.description}` : option.label}
            data-field={index === 0 ? name : undefined}
            onClick={() => onChange(checked && !required ? "" : option.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(index, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(index, -1);
              }
            }}
            className={cn(
              "min-h-[34px] min-w-[38px] rounded-md px-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60",
              checked ? "bg-accent text-white shadow-[0_1px_2px_rgba(39,33,71,0.25)]" : "text-ink-nav hover:bg-surface hover:text-primary"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** The bare control of a scalar field (no label), shared by top-level fields and table cells. */
export function Control({
  field,
  id,
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
  ariaLabel,
  compact,
}: {
  field: ScalarFormField;
  id: string;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  ariaLabel?: string;
  /** Smaller textareas inside tables. */
  compact?: boolean;
}) {
  const mode = useFormMode();
  if (mode === "review") {
    return <ReadOnlyValue field={field} id={id} value={value} ariaLabel={ariaLabel} compact={compact} />;
  }
  const className = cn(inputBase, invalid && inputError);
  const stringValue = value === null || value === undefined || typeof value === "object" ? "" : String(value);
  const common = {
    id,
    name: field.name,
    disabled,
    "data-field": field.name,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
    "aria-required": field.required || undefined,
    "aria-label": ariaLabel,
  };

  switch (field.type) {
    case "textarea":
      return (
        <textarea
          {...common}
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          rows={compact ? 3 : 5}
          className={cn(className, compact ? "min-h-[84px]" : "min-h-[128px]", "resize-y leading-relaxed")}
        />
      );
    case "select":
      return (
        <select {...common} value={stringValue} onChange={(e) => onChange(e.target.value)} className={cn(selectBase, invalid && inputError)}>
          <option value="">{field.placeholder ?? "Select an option"}</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case "radio":
      return (
        <SegmentedChoice
          name={field.name}
          options={field.options}
          value={stringValue}
          onChange={onChange}
          disabled={disabled}
          required={field.required}
          invalid={invalid}
          ariaLabel={ariaLabel ?? field.label}
          describedBy={describedBy}
        />
      );
    case "number":
      return (
        <input
          {...common}
          type="number"
          inputMode={field.step === 1 ? "numeric" : "decimal"}
          value={stringValue}
          min={field.min}
          max={field.max}
          step={field.step ?? "any"}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      );
    case "date":
    case "time":
    case "datetime":
      return (
        <input
          {...common}
          type={field.type === "datetime" ? "datetime-local" : field.type}
          value={stringValue}
          min={field.min}
          max={field.max}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      );
    case "signature":
      return (
        <input
          {...common}
          type="text"
          value={stringValue}
          maxLength={field.maxLength ?? DEFAULT_SIGNATURE_MAX}
          placeholder={field.placeholder ?? "Type your full name to sign"}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          className={cn(className, "font-serif text-[17px] italic tracking-wide")}
        />
      );
    case "text":
    case "email":
    case "tel":
      return (
        <input
          {...common}
          type={field.type}
          value={stringValue}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      );
    default:
      return null;
  }
}

/** A labelled top-level scalar field. `field.required` is the effective (possibly conditional) requirement. */
export const ScalarField = memo(function ScalarField({
  field,
  id,
  value,
  error,
  disabled,
  onChange,
}: {
  field: ScalarFormField;
  id: string;
  value: FieldValue;
  error?: string;
  disabled: boolean;
  onChange: (name: string, value: FieldValue) => void;
}) {
  const mode = useFormMode();
  const describedBy = [field.helpText ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  // Required markers describe what to fill in, so a stored submission doesn't show them.
  const required = field.required && mode !== "review" ? <RequiredMark /> : null;
  const footer = (
    <>
      {field.helpText && (
        <p id={`${id}-help`} className={helpText}>
          {field.helpText}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={errorText}>
          {error}
        </p>
      )}
    </>
  );
  const set = (v: FieldValue) => onChange(field.name, v);

  if (mode === "review" && field.type === "checkbox") {
    const checked = value === true;
    return (
      <div>
        <p className="flex items-start gap-3 text-[15px] leading-snug text-primary">
          <span
            className={cn(
              "mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded border",
              checked ? "border-accent bg-accent text-white" : "border-line-strong bg-surface text-faint"
            )}
            aria-hidden="true"
          >
            {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Minus className="h-3 w-3" />}
          </span>
          <span>
            {field.label}
            <span className="sr-only">: {checked ? "Yes" : "No"}</span>
          </span>
        </p>
        {field.helpText && <p className={helpText}>{field.helpText}</p>}
      </div>
    );
  }

  if (mode === "review") {
    return (
      <div>
        <p id={`${id}-label`} className={cn(labelText, "mb-2")}>
          {field.label}
        </p>
        <ReadOnlyValue field={field} value={value} labelledBy={`${id}-label`} />
      </div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <div>
        <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-[15px] leading-snug text-primary">
          <input
            id={id}
            name={field.name}
            data-field={field.name}
            type="checkbox"
            checked={value === true}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            aria-required={field.required || undefined}
            onChange={(e) => set(e.target.checked)}
            className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded accent-accent"
          />
          <span>
            {field.label}
            {required}
          </span>
        </label>
        {footer}
      </div>
    );
  }

  if (field.type === "radio" || field.type === "checkboxes") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <fieldset className="min-w-0" aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
        <legend className={cn(labelText, "mb-2.5")}>
          {field.label}
          {required}
        </legend>
        <div className={cn("grid grid-cols-1 gap-2", field.options.length > 3 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
          {field.options.map((option, index) => {
            const checked = field.type === "radio" ? value === option.value : selected.includes(option.value);
            return (
              <label
                key={option.value}
                className={cn(
                  "flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-[15px] transition-colors",
                  checked ? "border-accent/50 bg-accent-tint text-primary" : "border-line-strong bg-surface text-ink-soft hover:border-[#c9c4e2]",
                  error && !checked && "border-[#e5b3b8]",
                  disabled && "cursor-not-allowed opacity-70"
                )}
              >
                <input
                  type={field.type === "radio" ? "radio" : "checkbox"}
                  name={field.name}
                  value={option.value}
                  checked={checked}
                  disabled={disabled}
                  data-field={index === 0 ? field.name : undefined}
                  onChange={(e) => {
                    if (field.type === "radio") set(option.value);
                    else set(e.target.checked ? [...selected, option.value] : selected.filter((v) => v !== option.value));
                  }}
                  className="h-[18px] w-[18px] shrink-0 cursor-pointer accent-accent"
                />
                <span className="leading-snug">
                  {option.label}
                  {option.description && <span className="block text-[13px] text-muted">{option.description}</span>}
                </span>
              </label>
            );
          })}
        </div>
        {footer}
      </fieldset>
    );
  }

  return (
    <div>
      <label htmlFor={id} className={cn(labelText, "mb-2")}>
        {field.label}
        {required}
      </label>
      <Control field={field} id={id} value={value} onChange={set} disabled={disabled} invalid={!!error} describedBy={describedBy} />
      {footer}
    </div>
  );
});
