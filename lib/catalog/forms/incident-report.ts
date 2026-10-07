import type { CatalogForm } from "@/lib/catalog/types";

/** A repeater that becomes required by a condition, and a conditionally required follow-up field. */
export const incidentReport: CatalogForm = {
  slug: "incident-report",
  name: "Incident Report",
  description: "Record a workplace incident, near miss or security event as soon as it is safe to do so.",
  schema: {
    version: 1,
    submitLabel: "Submit report",
    sections: [
      {
        title: "What happened",
        fields: [
          { name: "occurredAt", label: "Date and time of incident", type: "datetime", required: true, width: "half" },
          { name: "location", label: "Location", type: "text", required: true, width: "half", maxLength: 200 },
          {
            name: "incidentType",
            label: "Type of incident",
            type: "select",
            required: true,
            width: "half",
            options: [
              { value: "near_miss", label: "Near miss" },
              { value: "injury", label: "Injury" },
              { value: "property", label: "Property damage" },
              { value: "security", label: "Security" },
              { value: "environmental", label: "Environmental" },
            ],
          },
          {
            name: "severity",
            label: "Severity",
            type: "radio",
            required: true,
            options: [
              { value: "minor", label: "Minor" },
              { value: "moderate", label: "Moderate" },
              { value: "major", label: "Major" },
            ],
          },
          { name: "summary", label: "Summary", type: "textarea", required: true, maxLength: 3000, helpText: "Describe the sequence of events." },
        ],
      },
      {
        title: "People involved",
        fields: [
          {
            name: "injuries",
            label: "Was anyone injured?",
            type: "radio",
            required: true,
            options: [
              { value: "no", label: "No" },
              { value: "yes", label: "Yes" },
            ],
          },
          {
            name: "injuryDetails",
            label: "Injuries and first aid given",
            type: "textarea",
            maxLength: 2000,
            requiredWhen: { field: "injuries", values: ["yes"], message: "Describe the injuries and any first aid given." },
          },
          {
            name: "people",
            label: "People involved",
            type: "repeater",
            itemLabel: "person",
            initialRows: 1,
            maxRows: 10,
            requiredWhen: { field: "injuries", values: ["yes"], message: "Add the people involved when someone was injured." },
            helpText: "Include witnesses. Blank rows are ignored.",
            columns: [
              { key: "name", label: "Name", input: { type: "text", maxLength: 120 }, required: true, width: "half" },
              {
                key: "role",
                label: "Role",
                width: "half",
                input: {
                  type: "select",
                  options: [
                    { value: "employee", label: "Employee" },
                    { value: "contractor", label: "Contractor" },
                    { value: "visitor", label: "Visitor" },
                    { value: "witness", label: "Witness" },
                  ],
                },
              },
              { key: "statement", label: "Statement", input: { type: "textarea", maxLength: 2000 } },
            ],
          },
        ],
      },
      {
        title: "Follow-up",
        fields: [
          { name: "immediateActions", label: "Immediate actions taken", type: "textarea", required: true, maxLength: 2000 },
          { name: "managerNotified", label: "My line manager has been notified.", type: "checkbox" },
          { name: "reporterSignature", label: "Reported by (signature)", type: "signature", required: true, width: "half" },
          { name: "reporterPhone", label: "Contact phone", type: "tel", width: "half" },
        ],
      },
    ],
  },
};
