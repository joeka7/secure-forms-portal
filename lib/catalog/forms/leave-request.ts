import type { CatalogForm } from "@/lib/catalog/types";

/** Facts block, decimal numbers, conditional "other" text, a declaration and a signature. */
export const leaveRequest: CatalogForm = {
  slug: "leave-request",
  name: "Leave Request",
  description: "Request annual, sick, parental or unpaid leave.",
  schema: {
    version: 1,
    submitLabel: "Submit leave request",
    sections: [
      {
        title: "Employee",
        content: [
          {
            kind: "facts",
            title: "Leave policy at a glance",
            items: [
              { label: "Annual allowance", value: "25 working days" },
              { label: "Notice", value: "Two weeks for 3+ days" },
              { label: "Carry-over", value: "Up to 5 days" },
              { label: "Approval", value: "Line manager" },
            ],
          },
        ],
        fields: [
          { name: "employeeName", label: "Employee name", type: "text", required: true, width: "half" },
          { name: "employeeEmail", label: "Work email", type: "email", required: true, width: "half" },
        ],
      },
      {
        title: "Leave",
        fields: [
          {
            name: "leaveType",
            label: "Type of leave",
            type: "radio",
            required: true,
            options: [
              { value: "annual", label: "Annual" },
              { value: "sick", label: "Sick" },
              { value: "parental", label: "Parental" },
              { value: "unpaid", label: "Unpaid" },
              { value: "other", label: "Other" },
            ],
          },
          {
            name: "otherLeaveType",
            label: "Other leave type",
            type: "text",
            maxLength: 120,
            requiredWhen: { field: "leaveType", values: ["other"], message: "Tell us which type of leave you need." },
          },
          { name: "firstDay", label: "First day of leave", type: "date", required: true, width: "half" },
          { name: "lastDay", label: "Last day of leave", type: "date", required: true, width: "half" },
          {
            name: "workingDays",
            label: "Working days",
            type: "number",
            required: true,
            min: 0.5,
            max: 60,
            step: 0.5,
            width: "half",
            helpText: "Half days are allowed.",
          },
          { name: "cover", label: "Cover arranged with", type: "text", width: "half" },
          { name: "handoverNotes", label: "Handover notes", type: "textarea", maxLength: 2000 },
        ],
      },
      {
        title: "Declaration",
        fields: [
          {
            name: "declaration",
            label: "The information in this request is accurate, and I have discussed the dates with my team.",
            type: "checkbox",
            required: true,
          },
          { name: "signature", label: "Signature", type: "signature", required: true },
        ],
      },
    ],
  },
};
