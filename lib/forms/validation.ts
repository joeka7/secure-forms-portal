import type {
  CellValue,
  FieldCondition,
  FieldValue,
  FormField,
  FormSchema,
  RepeaterField,
  RowValue,
  ScalarFormField,
  SubmissionData,
  TableColumn,
  TableField,
  TableRow,
  TableValue,
  ValidationErrors,
  ValidationMode,
  ValidationResult,
} from "@/lib/forms/types";

/**
 * Shared validation: the browser runs it for instant feedback, and the server runs it again as the
 * authority before anything is stored. Unknown keys are always discarded, so a client can never
 * store data the form does not define.
 */

export const DEFAULT_TEXT_MAX = 500;
export const DEFAULT_TEXTAREA_MAX = 5000;
export const DEFAULT_SIGNATURE_MAX = 120;
/** Longest raw value kept in a draft for a field whose current value is not yet valid. */
const DRAFT_RAW_MAX = 10000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_RE = /^[+()\d\s.-]{5,32}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATETIME_RE = /^(\d{4}-\d{2}-\d{2})T(([01]\d|2[0-3]):[0-5]\d)$/;

export function schemaFields(schema: FormSchema): FormField[] {
  return schema.sections.flatMap((section) => section.fields);
}

/** Error key of a table or repeater cell: "field.row.column". */
export function cellKey(fieldName: string, row: string | number, column: string) {
  return `${fieldName}.${row}.${column}`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Display label of a repeater row, e.g. "ACT-03" or "Witness 2". */
export function repeaterRowLabel(field: RepeaterField, index: number) {
  if (!field.rowLabel) return `${field.itemLabel ? capitalize(field.itemLabel) : "Row"} ${index + 1}`;
  return `${field.rowLabel.prefix}${String(index + 1).padStart(field.rowLabel.pad ?? 2, "0")}`;
}

/** Initial value of a field in the UI. */
export function emptyValue(field: FormField): FieldValue {
  if (field.type === "checkbox") return false;
  if (field.type === "checkboxes") return [];
  if (field.type === "table") return {};
  if (field.type === "repeater") {
    return Array.from({ length: Math.max(field.initialRows ?? 1, field.minRows ?? 0, 1) }, () => ({}));
  }
  return "";
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.every(isEmptyValue);
  if (isPlainObject(value)) return Object.values(value).every(isEmptyValue);
  return false;
}

function isValidDate(value: string) {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function isValidDateTime(value: string) {
  const m = DATETIME_RE.exec(value);
  return !!m && isValidDate(m[1]);
}

/** Whether a choice value (string, or array for checkboxes) matches one of the condition's values. */
function conditionMet(condition: FieldCondition | { values: string[] }, value: unknown) {
  if (typeof value === "string") return condition.values.includes(value);
  if (Array.isArray(value)) return value.some((v) => typeof v === "string" && condition.values.includes(v));
  return false;
}

/** Whether a top-level field is required, given the current values of the form. */
export function isFieldRequired(field: FormField, values: Record<string, unknown>) {
  if (field.required) return true;
  return !!field.requiredWhen && conditionMet(field.requiredWhen, values[field.requiredWhen.field]);
}

/**
 * Whether a table/repeater cell is required, given the other values of its row and (for tables) the
 * row definition, which can require columns in that row only.
 */
export function isCellRequired(column: TableColumn, row: Record<string, unknown> | undefined, rowDef?: TableRow) {
  if (column.required) return true;
  if (rowDef?.requiredColumns?.includes(column.key)) return true;
  if (!column.requiredWhen) return false;
  return conditionMet(column.requiredWhen, row?.[column.requiredWhen.column]);
}

/** A table/repeater cell expressed as a scalar field, so cells share the field rules. */
export function cellField(column: TableColumn, name: string, label: string, required: boolean): ScalarFormField {
  const input = column.input;
  switch (input.type) {
    case "select":
    case "radio":
      return { type: input.type, name, label, required, options: input.options };
    case "number":
      return { type: "number", name, label, required, min: input.min, max: input.max, step: input.step };
    case "date":
    case "time":
    case "datetime":
      return { type: input.type, name, label, required };
    default:
      return { type: input.type, name, label, required, maxLength: input.maxLength, placeholder: input.placeholder };
  }
}

/** Validate one scalar field. Returns the normalised value, or an error message. */
export function validateField(field: ScalarFormField, raw: unknown): { value: FieldValue; error?: string } {
  const label = field.label;

  if (field.type === "checkbox") {
    const checked = raw === true;
    if (field.required && !checked) return { value: false, error: `Please confirm "${label}".` };
    return { value: checked };
  }

  if (isEmptyValue(raw)) {
    if (field.required) {
      return {
        value: emptyValue(field),
        error:
          field.type === "checkboxes"
            ? `Select at least one option for ${label}.`
            : label.trim().endsWith("?")
              ? `Answer "${label}"`
              : `${label} is required.`,
      };
    }
    return { value: field.type === "checkboxes" ? [] : null };
  }

  switch (field.type) {
    case "text":
    case "email":
    case "tel":
    case "textarea":
    case "signature": {
      if (typeof raw !== "string") return { value: null, error: `${label} is invalid.` };
      const value = raw.trim();
      const max =
        field.maxLength ??
        (field.type === "textarea" ? DEFAULT_TEXTAREA_MAX : field.type === "signature" ? DEFAULT_SIGNATURE_MAX : DEFAULT_TEXT_MAX);
      if (field.minLength && value.length < field.minLength) {
        return { value, error: `${label} must be at least ${field.minLength} characters.` };
      }
      if (value.length > max) return { value, error: `${label} must be ${max} characters or fewer.` };
      if (field.type === "email" && !EMAIL_RE.test(value)) return { value, error: `Enter a valid email address for ${label}.` };
      if (field.type === "tel" && !TEL_RE.test(value)) return { value, error: `Enter a valid phone number for ${label}.` };
      if (field.type === "signature" && value.replace(/[^\p{L}]/gu, "").length < 2) {
        return { value, error: `Type your full name to sign ${label}.` };
      }
      return { value };
    }
    case "number": {
      const num = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.trim()) : NaN;
      if (!Number.isFinite(num)) return { value: null, error: `${label} must be a number.` };
      if (field.step === 1 && !Number.isInteger(num)) return { value: num, error: `${label} must be a whole number.` };
      if (field.min !== undefined && num < field.min) return { value: num, error: `${label} must be at least ${field.min}.` };
      if (field.max !== undefined && num > field.max) return { value: num, error: `${label} must be at most ${field.max}.` };
      return { value: num };
    }
    case "date":
    case "time":
    case "datetime": {
      if (typeof raw !== "string") return { value: null, error: `${label} is invalid.` };
      const value = raw.trim();
      const valid = field.type === "date" ? isValidDate(value) : field.type === "time" ? TIME_RE.test(value) : isValidDateTime(value);
      if (!valid) return { value, error: `Enter a valid ${field.type === "datetime" ? "date and time" : field.type} for ${label}.` };
      // Same-format ISO strings compare chronologically.
      if (field.min && value < field.min) return { value, error: `${label} must be on or after ${field.min}.` };
      if (field.max && value > field.max) return { value, error: `${label} must be on or before ${field.max}.` };
      return { value };
    }
    case "select":
    case "radio": {
      if (typeof raw !== "string" || !field.options.some((o) => o.value === raw)) {
        return { value: null, error: `Choose a valid option for ${label}.` };
      }
      return { value: raw };
    }
    case "checkboxes": {
      if (!Array.isArray(raw) || raw.some((v) => typeof v !== "string")) return { value: [], error: `${label} is invalid.` };
      const allowed = new Set(field.options.map((o) => o.value));
      const value = Array.from(new Set(raw as string[]));
      if (value.some((v) => !allowed.has(v))) return { value: [], error: `Choose valid options for ${label}.` };
      // Keep the options' own order, whatever order they were ticked in.
      const ordered = field.options.map((o) => o.value).filter((v) => value.includes(v));
      if (field.minSelected && ordered.length < field.minSelected) {
        return { value: ordered, error: `Select at least ${field.minSelected} options for ${label}.` };
      }
      if (field.maxSelected && ordered.length > field.maxSelected) {
        return { value: ordered, error: `Select no more than ${field.maxSelected} options for ${label}.` };
      }
      return { value: ordered };
    }
  }
}

/**
 * Drafts keep what the user typed even when it is not yet valid (e.g. "3.5" in a whole-number
 * field), so nothing silently disappears; submit validation reports it later. Choice values that
 * are not options are still dropped, because they cannot be displayed.
 */
function draftRaw(type: string, raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > DRAFT_RAW_MAX) return null;
  return ["select", "radio", "checkbox", "checkboxes"].includes(type) ? null : raw;
}

/** How a row is named in messages: "Operational checklist – 3" for tables, "ACT-02" for registers. */
export function rowContext(field: TableField | RepeaterField, rowLabel: string) {
  return field.type === "table" ? `${field.label} – ${rowLabel}` : rowLabel;
}

/** Validate the cells of one row. Invalid cells are reported (submit) or kept raw (draft). */
function validateRow(
  field: TableField | RepeaterField,
  rowId: string | number,
  rowLabel: string,
  source: Record<string, unknown>,
  mode: ValidationMode,
  errors: ValidationErrors,
  rowDef?: TableRow
): RowValue {
  const out: RowValue = {};
  for (const column of field.columns) {
    const required = mode === "submit" && isCellRequired(column, source, rowDef);
    const key = cellKey(field.name, rowId, column.key);
    const context = rowContext(field, rowLabel);
    const { value, error } = validateField(cellField(column, key, `${context}: ${column.label}`, required), source[column.key]);
    if (error) {
      if (mode === "submit") {
        const conditionalMiss = !!column.requiredWhen?.message && !column.required && isEmptyValue(source[column.key]);
        errors[key] = conditionalMiss ? `${context}: ${column.requiredWhen!.message}` : error;
      } else {
        const raw = draftRaw(column.input.type, source[column.key]);
        if (raw !== null) out[column.key] = raw;
      }
      continue;
    }
    if (!isEmptyValue(value)) out[column.key] = value as CellValue;
  }
  return out;
}

function validateTable(field: TableField, raw: unknown, mode: ValidationMode, errors: ValidationErrors): TableValue {
  const source = isPlainObject(raw) ? raw : {};
  const out: TableValue = {};
  for (const row of field.rows) {
    const rowSource = isPlainObject(source[row.key]) ? (source[row.key] as Record<string, unknown>) : {};
    const value = validateRow(field, row.key, row.label, rowSource, mode, errors, row);
    if (Object.keys(value).length > 0) out[row.key] = value;
  }
  return out;
}

function validateRepeater(
  field: RepeaterField,
  raw: unknown,
  mode: ValidationMode,
  required: boolean,
  errors: ValidationErrors
): RowValue[] {
  const source = Array.isArray(raw) ? raw : [];
  if (source.length > field.maxRows && mode === "submit") {
    errors[field.name] = `${field.label} can have at most ${field.maxRows} entries.`;
  }
  // Rows keep their position, so generated identifiers ("ACT-03") never shift between the screen,
  // drafts and the stored record. Blank rows in between are kept empty; trailing blank rows are
  // dropped. Rows with a generated identifier store it in `id`.
  const out: RowValue[] = [];
  let filled = 0;
  source.slice(0, field.maxRows).forEach((entry, index) => {
    const rowSource = isPlainObject(entry) ? entry : {};
    if (field.columns.every((c) => isEmptyValue(rowSource[c.key]))) {
      out.push({});
      return;
    }
    const label = repeaterRowLabel(field, index);
    const value = validateRow(field, index, label, rowSource, mode, errors);
    out.push(field.rowLabel && Object.keys(value).length > 0 ? { id: label, ...value } : value);
    if (Object.keys(value).length > 0) filled += 1;
  });
  while (out.length > 0 && Object.keys(out[out.length - 1]).length === 0) out.pop();
  const minimum = Math.max(1, field.minRows ?? 1);
  if (mode === "submit" && required && filled < minimum) {
    errors[field.name] =
      field.requiredWhen?.message && !field.required
        ? field.requiredWhen.message
        : `Add at least ${minimum} ${field.itemLabel ?? "entry"} to ${field.label}.`;
  }
  return out;
}

/**
 * Validate a full submission against a schema.
 *
 * - "submit": every rule applies, including required and conditionally required fields.
 * - "draft": required rules are skipped and malformed values are kept raw (or dropped for choices),
 *   so a partially completed form can always be saved.
 */
export function validateSubmission(schema: FormSchema, input: unknown, mode: ValidationMode = "submit"): ValidationResult {
  const source = isPlainObject(input) ? input : {};
  const data: SubmissionData = {};
  const errors: ValidationErrors = {};

  for (const field of schemaFields(schema)) {
    const required = mode === "submit" && isFieldRequired(field, source);
    if (field.type === "table") {
      data[field.name] = validateTable(field, source[field.name], mode, errors);
      continue;
    }
    if (field.type === "repeater") {
      data[field.name] = validateRepeater(field, source[field.name], mode, required, errors);
      continue;
    }
    const { value, error } = validateField({ ...field, required }, source[field.name]);
    if (error) {
      if (mode === "submit") {
        const conditionalMiss = !field.required && !!field.requiredWhen?.message && isEmptyValue(source[field.name]);
        errors[field.name] = conditionalMiss ? field.requiredWhen!.message! : error;
      } else {
        const raw = draftRaw(field.type, source[field.name]);
        if (raw !== null) data[field.name] = raw;
      }
    } else {
      data[field.name] = value;
    }
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, data };
}

/** The storable subset of a partially completed form, for drafts. Never fails. */
export function sanitizeDraft(schema: FormSchema, input: unknown): SubmissionData {
  const result = validateSubmission(schema, input, "draft");
  return result.ok ? result.data : {};
}
