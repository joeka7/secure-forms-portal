import type { CatalogForm } from "@/lib/catalog/types";

/** Warning callout, time inputs, choices with descriptions and a footer list. */
export const maintenanceRequest: CatalogForm = {
  slug: "maintenance-request",
  name: "Maintenance Request",
  description: "Report a building issue such as a leak, a faulty light or broken furniture.",
  schema: {
    version: 1,
    submitLabel: "Report issue",
    sections: [
      {
        title: "Location",
        content: [
          {
            kind: "callout",
            tone: "warning",
            title: "Emergencies",
            text: "If anyone is at risk (fire, flooding, a gas smell or exposed wiring), call the emergency line first. Do not use this form.",
          },
        ],
        fields: [
          {
            name: "building",
            label: "Building",
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
          { name: "room", label: "Floor and room", type: "text", required: true, width: "half", placeholder: "e.g. Level 2, Room 2.14" },
        ],
      },
      {
        title: "Issue",
        fields: [
          {
            name: "issueType",
            label: "Type of issue",
            type: "select",
            required: true,
            width: "half",
            options: [
              { value: "electrical", label: "Electrical" },
              { value: "plumbing", label: "Plumbing" },
              { value: "hvac", label: "Heating and air conditioning" },
              { value: "furniture", label: "Furniture" },
              { value: "cleaning", label: "Cleaning" },
              { value: "other", label: "Other" },
            ],
          },
          {
            name: "priority",
            label: "Priority",
            type: "radio",
            required: true,
            options: [
              { value: "low", label: "Low", description: "Cosmetic, no impact on work" },
              { value: "medium", label: "Medium", description: "Inconvenient, work can continue" },
              { value: "high", label: "High", description: "Work is disrupted" },
            ],
          },
          { name: "description", label: "Describe the issue", type: "textarea", required: true, maxLength: 2000 },
          {
            name: "hazard",
            label: "Is the issue a safety hazard?",
            type: "radio",
            required: true,
            options: [
              { value: "no", label: "No" },
              { value: "yes", label: "Yes" },
            ],
          },
          {
            name: "hazardDetails",
            label: "Hazard details",
            type: "textarea",
            maxLength: 1000,
            requiredWhen: { field: "hazard", values: ["yes"], message: "Describe the hazard and any temporary measures taken." },
            helpText: "Required when the issue is a safety hazard.",
          },
        ],
      },
      {
        title: "Access and contact",
        description: "When can a technician get into the area?",
        fields: [
          { name: "accessFrom", label: "Available from", type: "time", width: "half" },
          { name: "accessUntil", label: "Available until", type: "time", width: "half" },
          { name: "contactPhone", label: "Contact phone", type: "tel", required: true, width: "half" },
        ],
        footer: [
          {
            kind: "list",
            title: "What happens next",
            ordered: true,
            items: [
              "You receive a reference number when the request is submitted.",
              "Facilities reviews new requests within one business day.",
              "A technician contacts you to arrange access.",
            ],
          },
        ],
      },
    ],
  },
};
