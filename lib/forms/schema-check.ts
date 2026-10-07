import type { ContentBlock, FieldOption, FormSchema, RepeaterField, TableField } from "@/lib/forms/types";
import { schemaFields } from "@/lib/forms/validation";

/**
 * Structural checks for a form definition. The catalog runs them before syncing, so a typo in a
 * form definition fails loudly at startup (and in the test suite) instead of rendering a broken form.
 */

export const MAX_REPEATER_ROWS = 200;
const FIELD_NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const SECTION_ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const CELL_INPUT_TYPES = ["text", "textarea", "signature", "select", "radio", "date", "time", "datetime", "number"];

function checkOptions(options: FieldOption[] | undefined, where: string, problems: string[]) {
  if (!options?.length) {
    problems.push(`${where} has no options`);
    return;
  }
  const values = new Set<string>();
  for (const o of options) {
    if (typeof o.value !== "string" || !o.value || !o.label) problems.push(`${where} has an invalid option`);
    if (values.has(o.value)) problems.push(`${where} has duplicate option "${o.value}"`);
    values.add(o.value);
  }
}

function checkColumns(field: TableField | RepeaterField, problems: string[]) {
  if (!field.columns?.length) problems.push(`field "${field.name}" has no columns`);
  const keys = new Set<string>();
  for (const column of field.columns ?? []) {
    const where = `column "${field.name}.${column.key}"`;
    if (!FIELD_NAME_RE.test(column.key)) problems.push(`invalid ${where}`);
    if (column.key === "id" && field.type === "repeater" && field.rowLabel) problems.push(`${where}: "id" is reserved for row identifiers`);
    if (keys.has(column.key)) problems.push(`duplicate ${where}`);
    keys.add(column.key);
    if (!column.label) problems.push(`${where} has no label`);
    const input = column.input;
    if (!input || !CELL_INPUT_TYPES.includes(input.type)) problems.push(`${where} has an invalid input type`);
    else if (input.type === "select" || input.type === "radio") checkOptions(input.options, where, problems);
  }
  for (const column of field.columns ?? []) {
    if (!column.requiredWhen) continue;
    const where = `column "${field.name}.${column.key}"`;
    const other = field.columns.find((c) => c.key === column.requiredWhen!.column);
    if (!other || other.key === column.key) problems.push(`${where} requiredWhen refers to an unknown column`);
    else if (other.input.type !== "select" && other.input.type !== "radio") problems.push(`${where} requiredWhen must refer to a choice column`);
    else if (!column.requiredWhen.values.length || !column.requiredWhen.values.every((v) => (other.input as { options: FieldOption[] }).options.some((o) => o.value === v)))
      problems.push(`${where} requiredWhen uses unknown values`);
  }
}

function checkContent(blocks: ContentBlock[] | undefined, where: string, problems: string[]) {
  for (const block of blocks ?? []) {
    switch (block.kind) {
      case "paragraph":
      case "callout":
        if (!block.text) problems.push(`${where}: empty ${block.kind}`);
        break;
      case "list":
        if (!block.items?.length) problems.push(`${where}: empty list`);
        break;
      case "table":
        if (!block.columns?.length || !block.rows?.length || block.rows.some((r) => r.length !== block.columns.length))
          problems.push(`${where}: table rows do not match its columns`);
        break;
      case "facts":
        if (!block.items?.length) problems.push(`${where}: empty facts`);
        break;
      default:
        problems.push(`${where}: unknown content block`);
    }
  }
}

/** Throws with every problem found when the schema is not structurally valid. */
export function assertValidSchema(schema: FormSchema, context: string) {
  if (!schema || schema.version !== 1 || !Array.isArray(schema.sections)) {
    throw new Error(`${context}: schema must be { version: 1, sections: [...] }`);
  }
  const problems: string[] = [];
  const sectionIds = new Set<string>();
  schema.sections.forEach((section, index) => {
    const where = `section ${index + 1}`;
    if (section.id !== undefined) {
      if (!SECTION_ID_RE.test(section.id)) problems.push(`${where}: invalid id "${section.id}"`);
      if (sectionIds.has(section.id)) problems.push(`${where}: duplicate id "${section.id}"`);
      sectionIds.add(section.id);
    } else if (schema.navigation && section.title) {
      problems.push(`${where}: sections of a navigable form need an id`);
    }
    if (!Array.isArray(section.fields)) problems.push(`${where}: fields must be an array`);
    checkContent(section.content, where, problems);
    checkContent(section.footer, where, problems);
  });

  const fields = schemaFields(schema);
  const byName = new Map(fields.map((f) => [f.name, f]));
  const names = new Set<string>();
  for (const field of fields) {
    const where = `field "${field.name}"`;
    if (!FIELD_NAME_RE.test(field.name)) problems.push(`invalid field name "${field.name}"`);
    if (names.has(field.name)) problems.push(`duplicate field name "${field.name}"`);
    names.add(field.name);
    if (!field.label) problems.push(`${where} has no label`);

    if (field.requiredWhen) {
      const trigger = byName.get(field.requiredWhen.field);
      if (field.type === "table") problems.push(`${where}: tables use column rules, not requiredWhen`);
      else if (!trigger || trigger === field) problems.push(`${where} requiredWhen refers to an unknown field`);
      else if (trigger.type !== "select" && trigger.type !== "radio" && trigger.type !== "checkboxes")
        problems.push(`${where} requiredWhen must refer to a select, radio or checkboxes field`);
      else if (!field.requiredWhen.values.length || !field.requiredWhen.values.every((v) => trigger.options.some((o) => o.value === v)))
        problems.push(`${where} requiredWhen uses unknown values`);
    }

    switch (field.type) {
      case "select":
      case "radio":
        checkOptions(field.options, where, problems);
        break;
      case "checkboxes":
        checkOptions(field.options, where, problems);
        if ((field.minSelected ?? 0) > (field.maxSelected ?? Infinity)) problems.push(`${where}: minSelected exceeds maxSelected`);
        break;
      case "text":
      case "email":
      case "tel":
      case "textarea":
      case "signature":
        if ((field.minLength ?? 0) > (field.maxLength ?? Infinity)) problems.push(`${where}: minLength exceeds maxLength`);
        break;
      case "number":
        if (field.min !== undefined && field.max !== undefined && field.min > field.max) problems.push(`${where}: min exceeds max`);
        break;
      case "table": {
        if (!field.rows?.length) problems.push(`${where} has no rows`);
        if (field.layout === "list" && field.columns?.length !== 1) problems.push(`${where}: the list layout takes exactly one column`);
        const rowKeys = new Set<string>();
        for (const row of field.rows ?? []) {
          if (!FIELD_NAME_RE.test(row.key)) problems.push(`invalid row "${field.name}.${row.key}"`);
          if (rowKeys.has(row.key)) problems.push(`duplicate row "${field.name}.${row.key}"`);
          rowKeys.add(row.key);
          for (const key of row.requiredColumns ?? []) {
            if (!field.columns?.some((c) => c.key === key)) problems.push(`row "${field.name}.${row.key}" requires unknown column "${key}"`);
          }
        }
        checkColumns(field, problems);
        break;
      }
      case "repeater":
        if (!Number.isInteger(field.maxRows) || field.maxRows < 1 || field.maxRows > MAX_REPEATER_ROWS)
          problems.push(`${where} maxRows must be 1–${MAX_REPEATER_ROWS}`);
        if ((field.initialRows ?? 0) > field.maxRows || (field.minRows ?? 0) > field.maxRows)
          problems.push(`${where} initialRows/minRows exceed maxRows`);
        checkColumns(field, problems);
        break;
    }
  }
  if (names.size === 0) problems.push("form has no fields");
  if (problems.length) throw new Error(`${context}: ${problems.join("; ")}`);
}
