import type { FieldValue, FormSection, TableValue } from "@/lib/forms/types";
import { isCellRequired, isEmptyValue, isFieldRequired, isPlainObject } from "@/lib/forms/validation";

export type RequiredProgress = { done: number; total: number };

/**
 * Required items completed in one section: each required field, each required table cell (including
 * cells that are currently required by a condition) and each required register.
 */
export function sectionProgress(section: FormSection, values: Record<string, FieldValue | undefined>): RequiredProgress {
  let done = 0;
  let total = 0;
  for (const field of section.fields) {
    const value = values[field.name];
    if (field.type === "table") {
      const table = isPlainObject(value) ? (value as TableValue) : {};
      for (const row of field.rows) {
        for (const column of field.columns) {
          if (!isCellRequired(column, table[row.key], row)) continue;
          total += 1;
          if (!isEmptyValue(table[row.key]?.[column.key])) done += 1;
        }
      }
    } else if (field.type === "repeater") {
      if (!isFieldRequired(field, values)) continue;
      total += 1;
      if (Array.isArray(value) && value.some((row) => isPlainObject(row) && field.columns.some((c) => !isEmptyValue(row[c.key])))) done += 1;
    } else if (isFieldRequired(field, values)) {
      total += 1;
      if (!isEmptyValue(value)) done += 1;
    }
  }
  return { done, total };
}
