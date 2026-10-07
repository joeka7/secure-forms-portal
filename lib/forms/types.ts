/**
 * Form definitions are data, not pages.
 *
 * Every form is described by a `FormSchema`. The same schema drives the renderer (fill, preview and
 * review modes), the browser-side validation and the authoritative server-side validation, so adding
 * a form never requires a new page or API route.
 *
 * Besides simple fields, a schema can describe:
 * - read-only content blocks (instructions, legends, callouts, reference facts) inside a section;
 * - `table` fields: a fixed list of rows (e.g. numbered checklist items), each with the same input columns;
 * - `repeater` fields: a register whose rows the user adds or removes (e.g. an action log);
 * - conditional requirements: a field required when a choice field has certain values
 *   (`requiredWhen`), a table cell required when another cell of its row has certain values, and
 *   cells required in specific table rows only (`requiredColumns`).
 *
 * This module is shared by client and server code and must stay free of Node-only imports.
 */

export type FieldOption = { value: string; label: string; description?: string };

/** Makes a field required while another choice field (select, radio or checkboxes) holds one of `values`. */
export type FieldCondition = {
  /** Name of the select, radio or checkboxes field that triggers the requirement. */
  field: string;
  values: string[];
  /** Message shown when the condition applies and the field is empty. */
  message?: string;
};

type BaseField = {
  /** Key used in the submission payload. Starts with a letter; letters, digits and underscores; unique within a form. */
  name: string;
  label: string;
  required?: boolean;
  requiredWhen?: FieldCondition;
  helpText?: string;
  placeholder?: string;
  /** Layout hint: "half" fields sit side by side on wider screens. */
  width?: "full" | "half";
};

export type TextField = BaseField & {
  /** `signature` is a typed full-name attestation, not a drawn signature. */
  type: "text" | "email" | "tel" | "textarea" | "signature";
  minLength?: number;
  maxLength?: number;
};

export type NumberField = BaseField & {
  type: "number";
  min?: number;
  max?: number;
  /** Use 1 for whole numbers. */
  step?: number;
};

export type DateTimeField = BaseField & {
  /** `datetime` is a local date and time (YYYY-MM-DDTHH:MM) without a time zone. */
  type: "date" | "time" | "datetime";
  /** Same format as the value: YYYY-MM-DD, HH:MM or YYYY-MM-DDTHH:MM. */
  min?: string;
  max?: string;
};

export type ChoiceField = BaseField & {
  type: "select" | "radio";
  options: FieldOption[];
};

export type MultiChoiceField = BaseField & {
  type: "checkboxes";
  options: FieldOption[];
  minSelected?: number;
  maxSelected?: number;
};

export type CheckboxField = BaseField & {
  /** A single yes/no checkbox. `required` means it must be ticked (e.g. a declaration). */
  type: "checkbox";
};

/** Input used in one column of a table or repeater row. */
export type CellInput =
  | { type: "text" | "textarea" | "signature"; maxLength?: number; placeholder?: string }
  | { type: "select" | "radio"; options: FieldOption[] }
  | { type: "date" | "time" | "datetime" }
  | { type: "number"; min?: number; max?: number; step?: number };

export type TableColumn = {
  /** Key of the cell within a row. Unique within the table. */
  key: string;
  label: string;
  input: CellInput;
  required?: boolean;
  /** The cell becomes required when another (select/radio) column of the same row holds one of `values`. */
  requiredWhen?: { column: string; values: string[]; message?: string };
  helpText?: string;
  /** Layout hint inside a row card. */
  width?: "full" | "half";
};

export type TableRow = {
  /** Key of the row within the table value. */
  key: string;
  /** Short row label, e.g. "3" or "Prepared by". */
  label: string;
  /** Text of the row, e.g. the checklist item or the question. */
  description?: string;
  /** Columns required in this row only, in addition to the columns' own rules. */
  requiredColumns?: string[];
};

export type TableField = BaseField & {
  type: "table";
  rows: TableRow[];
  columns: TableColumn[];
  /** "cards": one card per row (long questions). "grid": compact rows. "list": numbered single inputs. */
  layout?: "cards" | "grid" | "list";
  /** Heading of the row-label column in the grid layout. */
  rowHeader?: string;
};

export type RepeaterField = BaseField & {
  type: "repeater";
  columns: TableColumn[];
  /** Blank rows shown initially (blank rows are ignored on submit). */
  initialRows?: number;
  /** With `required`, the minimum number of non-blank rows. */
  minRows?: number;
  maxRows: number;
  /** Generates row identifiers such as "ACT-01". */
  rowLabel?: { prefix: string; pad?: number };
  /** Singular noun used in buttons, e.g. "action". */
  itemLabel?: string;
};

export type FormField =
  | TextField
  | NumberField
  | DateTimeField
  | ChoiceField
  | MultiChoiceField
  | CheckboxField
  | TableField
  | RepeaterField;
export type FieldType = FormField["type"];
export type ScalarFormField = Exclude<FormField, TableField | RepeaterField>;

/** Read-only content shown inside a section (instructions, legends, reference information). */
export type ContentBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "callout"; tone?: "info" | "warning" | "neutral"; title?: string; text: string }
  | { kind: "list"; title?: string; ordered?: boolean; items: string[] }
  | { kind: "table"; title?: string; columns: string[]; rows: string[][] }
  | { kind: "facts"; title?: string; items: Array<{ label: string; value: string }> };

export type FormSection = {
  /** Anchor id used by the section navigation. Letters, digits, "-" and "_". */
  id?: string;
  /** Small label above the title, e.g. "Part 2". */
  eyebrow?: string;
  title?: string;
  description?: string;
  /** Shown before the fields. */
  content?: ContentBlock[];
  fields: FormField[];
  /** Shown after the fields. */
  footer?: ContentBlock[];
};

export type FormSchema = {
  /** Schema format version (not the form's content version, which the catalog tracks). */
  version: 1;
  sections: FormSection[];
  submitLabel?: string;
  /** Long forms: section navigation, progress, a sticky action bar and server-side drafts. */
  navigation?: boolean;
};

export type CellValue = string | number | null;
export type RowValue = Record<string, CellValue>;
export type TableValue = Record<string, RowValue>;
export type FieldValue = string | number | boolean | string[] | null | TableValue | RowValue[];
export type SubmissionData = Record<string, FieldValue>;
/** Keyed by field name, or "field.row.column" for table/repeater cells. */
export type ValidationErrors = Record<string, string>;

export type ValidationResult = { ok: true; data: SubmissionData } | { ok: false; errors: ValidationErrors };

/** "submit" enforces every rule; "draft" keeps what was typed and never fails. */
export type ValidationMode = "submit" | "draft";
