"use client";

import { useCallback, useMemo } from "react";
import type { FieldValue, FormField, FormSchema, SubmissionData } from "@/lib/forms/types";
import { emptyValue, isFieldRequired, schemaFields } from "@/lib/forms/validation";
import { cn } from "@/lib/utils";
import { surface } from "@/components/ui/classes";
import { FormSectionView, SectionJumpList, SectionNavLinks, navigableSections, useActiveSection } from "@/components/forms/renderer/FormSection";
import { ScalarField } from "@/components/forms/renderer/inputs";
import { FormModeContext } from "@/components/forms/renderer/mode";
import { RepeaterInput, TableInput } from "@/components/forms/renderer/TableInput";

const NO_ERRORS: Record<string, string> = {};
const noop = () => undefined;

/**
 * A form rendered from its schema without editing, with the same section and field components as
 * `FormRenderer`:
 * - "preview" shows every question, instruction and table with empty, disabled controls;
 * - "review" shows a stored submission's answers as text.
 * Nothing here can save, submit or change data.
 */
export function FormReadOnlyView({ schema, mode, data }: { schema: FormSchema; mode: "preview" | "review"; data?: SubmissionData }) {
  const longForm = !!schema.navigation;
  const values = useMemo(() => {
    const result: Record<string, FieldValue> = {};
    for (const field of schemaFields(schema)) {
      const stored = mode === "review" ? data?.[field.name] : undefined;
      // A register with no stored rows shows "No entries recorded." rather than blank rows.
      result[field.name] = stored ?? (mode === "review" && field.type === "repeater" ? [] : emptyValue(field));
    }
    return result;
  }, [schema, mode, data]);

  const renderField = useCallback(
    (field: FormField) => {
      const disabled = mode === "preview";
      if (field.type === "table") return <TableInput field={field} value={values[field.name]} errors={NO_ERRORS} disabled={disabled} onChange={noop} />;
      if (field.type === "repeater") {
        return (
          <RepeaterInput field={field} value={values[field.name]} errors={NO_ERRORS} required={isFieldRequired(field, values)} disabled={disabled} onChange={noop} />
        );
      }
      return <ScalarField field={field} id={`${mode}-${field.name}`} value={values[field.name]} disabled={disabled} onChange={noop} />;
    },
    [mode, values]
  );

  const navSections = navigableSections(schema.sections, longForm);
  const activeSection = useActiveSection(schema.sections, longForm);
  const sections = schema.sections.map((section, index) => <FormSectionView key={index} section={section} longForm={longForm} renderField={renderField} />);

  return (
    <FormModeContext.Provider value={mode}>
      {longForm ? (
        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_248px] xl:gap-8">
          <div className="min-w-0">
            {navSections.length > 0 && (
              <div className={cn(surface, "mb-6 px-5 py-4 xl:hidden print:hidden")}>
                <SectionJumpList items={navSections} />
              </div>
            )}
            <div className="space-y-6">{sections}</div>
          </div>
          <aside className="hidden xl:block print:hidden" aria-label="Form sections">
            <div className="sticky top-8">
              <div className={cn(surface, "p-4")}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Sections</p>
                <nav className="mt-3" aria-label="Sections">
                  <SectionNavLinks items={navSections} active={activeSection} />
                </nav>
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <div className={cn(surface, "overflow-hidden")}>
          <div className="divide-y divide-line-soft">{sections}</div>
        </div>
      )}
    </FormModeContext.Provider>
  );
}
