import type { CatalogForm } from "@/lib/catalog/types";
import type { TableRow } from "@/lib/forms/types";

const STATUS_OPTIONS = [
  { value: "M", label: "M", description: "Met" },
  { value: "P", label: "P", description: "Partially met" },
  { value: "N", label: "N", description: "Not met" },
  { value: "NA", label: "N/A", description: "Not applicable" },
];

const CHECKLIST: Array<[string, string]> = [
  ["safety_walk", "Monthly safety walkthrough completed and recorded"],
  ["fire_test", "Fire alarm test logged for every week of the quarter"],
  ["first_aid", "First-aid kits inspected and restocked"],
  ["visitor_log", "Visitor log reviewed for gaps"],
  ["badge_audit", "Access badge audit completed"],
  ["backup_test", "Backup restore test completed successfully"],
  ["supplier_review", "Supplier contracts reviewed ahead of renewal"],
  ["maintenance_plan", "Preventive maintenance schedule on track"],
  ["training", "Mandatory training records up to date"],
  ["continuity", "Business continuity plan reviewed"],
];

const QUESTIONS: Array<[string, string]> = [
  ["staffing", "Was the site adequately staffed for the demand it saw this quarter? Note any recurring gaps."],
  ["service", "Did the site meet its service commitments to internal customers? Describe any missed commitments."],
  ["risks", "Which operational risks increased this quarter, and what is being done about them?"],
  ["improvements", "Which process improvements were delivered, and what measurable effect did they have?"],
];

const checklistRows: TableRow[] = CHECKLIST.map(([key, description], index) => ({
  key,
  label: String(index + 1),
  description,
}));

/**
 * The long form: section navigation, progress, autosaved drafts, every table layout, row-level
 * requirements, cell conditions, a register with generated identifiers and a cross-section condition.
 */
export const operationsReview: CatalogForm = {
  slug: "quarterly-operations-review",
  name: "Quarterly Operations Review",
  description: "The quarterly site review: checklist, key metrics, action register and sign-off. Saves as a draft while you work.",
  schema: {
    version: 1,
    navigation: true,
    submitLabel: "Submit review",
    sections: [
      {
        id: "details",
        eyebrow: "Part 1",
        title: "Review details",
        content: [
          {
            kind: "paragraph",
            text: "Complete one review per site each quarter. Answer from records held on site, and reference the evidence where the checklist asks for it.",
          },
          {
            kind: "callout",
            tone: "info",
            title: "Drafts",
            text: "Your answers save automatically as a draft. You can leave this page and finish the review later, from this or another device.",
          },
        ],
        fields: [
          {
            name: "site",
            label: "Site",
            type: "select",
            required: true,
            width: "half",
            options: [
              { value: "main", label: "Main Office" },
              { value: "warehouse", label: "Warehouse" },
              { value: "annex", label: "North Annex" },
              { value: "hub", label: "Regional Hub" },
            ],
          },
          {
            name: "quarter",
            label: "Quarter",
            type: "select",
            required: true,
            width: "half",
            options: [
              { value: "Q1", label: "Q1 (Jan–Mar)" },
              { value: "Q2", label: "Q2 (Apr–Jun)" },
              { value: "Q3", label: "Q3 (Jul–Sep)" },
              { value: "Q4", label: "Q4 (Oct–Dec)" },
            ],
          },
          { name: "year", label: "Year", type: "number", required: true, min: 2020, max: 2100, step: 1, width: "half" },
          { name: "reviewLead", label: "Review lead", type: "text", required: true, width: "half" },
          { name: "reviewDate", label: "Review meeting", type: "datetime", width: "half" },
          { name: "meetingStart", label: "Site visit start time", type: "time", width: "half" },
        ],
      },
      {
        id: "summary",
        eyebrow: "Part 2",
        title: "Summary",
        fields: [
          {
            name: "overallStatus",
            label: "Overall status",
            type: "radio",
            required: true,
            options: [
              { value: "on_track", label: "On track" },
              { value: "at_risk", label: "At risk" },
              { value: "off_track", label: "Off track" },
            ],
            helpText: "At risk or Off track requires at least one entry in the action register.",
          },
          { name: "headline", label: "Summary of the quarter", type: "textarea", required: true, maxLength: 1500 },
          {
            name: "highlights",
            label: "Top three highlights",
            type: "table",
            layout: "list",
            helpText: "The first highlight is required.",
            columns: [{ key: "text", label: "Highlight", input: { type: "text", maxLength: 200 } }],
            rows: [
              { key: "h1", label: "1", requiredColumns: ["text"] },
              { key: "h2", label: "2" },
              { key: "h3", label: "3" },
            ],
          },
        ],
      },
      {
        id: "checklist",
        eyebrow: "Part 3",
        title: "Operational checklist",
        description: "Give every item a status. Met and partially met items need an evidence reference; the others need an explanation.",
        content: [
          {
            kind: "table",
            title: "Status key",
            columns: ["Code", "Meaning", "Also required"],
            rows: [
              ["M", "Met: fully in place for the whole quarter", "Evidence reference"],
              ["P", "Partially met: in place, with gaps", "Evidence reference"],
              ["N", "Not met", "Explanation"],
              ["N/A", "Not applicable to this site", "Explanation"],
            ],
          },
        ],
        fields: [
          {
            name: "checklist",
            label: "Operational checklist",
            type: "table",
            layout: "grid",
            rowHeader: "Item",
            rows: checklistRows,
            columns: [
              { key: "status", label: "Status", input: { type: "radio", options: STATUS_OPTIONS }, required: true },
              {
                key: "evidence",
                label: "Evidence reference",
                input: { type: "text", maxLength: 120 },
                requiredWhen: { column: "status", values: ["M", "P"], message: "Add the evidence reference." },
              },
              {
                key: "explanation",
                label: "Explanation",
                input: { type: "text", maxLength: 300 },
                requiredWhen: { column: "status", values: ["N", "NA"], message: "Explain why the item is not met or not applicable." },
              },
            ],
          },
        ],
      },
      {
        id: "questions",
        eyebrow: "Part 4",
        title: "Review questions",
        fields: [
          {
            name: "questions",
            label: "Review questions",
            type: "table",
            layout: "cards",
            rows: QUESTIONS.map(([key, description], index) => ({ key, label: `Q${index + 1}`, description })),
            columns: [
              {
                key: "rating",
                label: "Rating",
                width: "half",
                required: true,
                input: {
                  type: "select",
                  options: [
                    { value: "5", label: "5: Excellent" },
                    { value: "4", label: "4: Good" },
                    { value: "3", label: "3: Adequate" },
                    { value: "2", label: "2: Weak" },
                    { value: "1", label: "1: Poor" },
                  ],
                },
              },
              { key: "owner", label: "Owner", width: "half", input: { type: "text", maxLength: 120 } },
              {
                key: "response",
                label: "Response",
                input: { type: "textarea", maxLength: 3000 },
                requiredWhen: { column: "rating", values: ["1", "2"], message: "Describe the gap for a rating of 1 or 2." },
                helpText: "Required for a rating of 1 or 2.",
              },
            ],
          },
        ],
      },
      {
        id: "metrics",
        eyebrow: "Part 5",
        title: "Key metrics",
        content: [
          {
            kind: "table",
            title: "Targets",
            columns: ["Metric", "Target", "Source"],
            rows: [
              ["Open service tickets", "Fewer than 25 at quarter end", "Service desk"],
              ["Average resolution time", "Under 24 hours", "Service desk"],
              ["Reported incidents", "Downward trend", "Incident register"],
              ["Budget variance", "Within ±5%", "Finance report"],
            ],
          },
        ],
        fields: [
          { name: "openTickets", label: "Open service tickets", type: "number", required: true, min: 0, max: 100000, step: 1, width: "half" },
          { name: "resolutionHours", label: "Average resolution time (hours)", type: "number", required: true, min: 0, max: 10000, width: "half" },
          { name: "incidents", label: "Reported incidents", type: "number", required: true, min: 0, max: 10000, step: 1, width: "half" },
          { name: "budgetVariance", label: "Budget variance (%)", type: "number", min: -100, max: 100, width: "half" },
          { name: "metricsNotes", label: "Notes on the metrics", type: "textarea", maxLength: 2000 },
        ],
      },
      {
        id: "actions",
        eyebrow: "Part 6",
        title: "Action register",
        description: "Record follow-up actions. Identifiers are generated and stay stable when you save drafts.",
        fields: [
          {
            name: "actions",
            label: "Actions",
            type: "repeater",
            itemLabel: "action",
            initialRows: 2,
            maxRows: 25,
            rowLabel: { prefix: "ACT-", pad: 2 },
            requiredWhen: {
              field: "overallStatus",
              values: ["at_risk", "off_track"],
              message: "Record at least one action when the site is at risk or off track.",
            },
            columns: [
              { key: "action", label: "Action", input: { type: "textarea", maxLength: 1000 }, required: true },
              { key: "owner", label: "Owner", input: { type: "text", maxLength: 120 }, required: true, width: "half" },
              { key: "due", label: "Due date", input: { type: "date" }, required: true, width: "half" },
              {
                key: "priority",
                label: "Priority",
                required: true,
                width: "half",
                input: {
                  type: "radio",
                  options: [
                    { value: "P1", label: "P1", description: "Critical" },
                    { value: "P2", label: "P2", description: "High" },
                    { value: "P3", label: "P3", description: "Medium" },
                    { value: "P4", label: "P4", description: "Low" },
                  ],
                },
              },
              {
                key: "status",
                label: "Status",
                width: "half",
                input: {
                  type: "select",
                  options: [
                    { value: "open", label: "Open" },
                    { value: "in_progress", label: "In progress" },
                    { value: "done", label: "Done" },
                  ],
                },
              },
            ],
          },
        ],
      },
      {
        id: "signoff",
        eyebrow: "Part 7",
        title: "Sign-off",
        description: "The person who prepared the review must sign. Reviewer and approver sign-off can be added later.",
        fields: [
          {
            name: "signoff",
            label: "Sign-off",
            type: "table",
            layout: "grid",
            rowHeader: "Role",
            columns: [
              { key: "name", label: "Name", input: { type: "text", maxLength: 120 } },
              { key: "signature", label: "Signature", input: { type: "signature" } },
              { key: "signedAt", label: "Date and time", input: { type: "datetime" } },
            ],
            rows: [
              { key: "prepared", label: "Prepared by", requiredColumns: ["name", "signature", "signedAt"] },
              { key: "reviewed", label: "Reviewed by" },
              { key: "approved", label: "Approved by" },
            ],
          },
          {
            name: "declaration",
            label: "I confirm this review reflects the records held on site for the quarter.",
            type: "checkbox",
            required: true,
          },
        ],
      },
    ],
  },
};
