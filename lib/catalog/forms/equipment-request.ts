import type { CatalogForm } from "@/lib/catalog/types";

/** Short form: basic inputs, a radio with an "Other" option that makes a follow-up field required. */
export const equipmentRequest: CatalogForm = {
  slug: "equipment-request",
  name: "Equipment Request",
  description: "Request a laptop, monitor, phone or other hardware for yourself or a team member.",
  schema: {
    version: 1,
    submitLabel: "Submit request",
    sections: [
      {
        title: "Requester",
        fields: [
          { name: "requesterName", label: "Full name", type: "text", required: true, width: "half", maxLength: 120 },
          { name: "requesterEmail", label: "Work email", type: "email", required: true, width: "half", placeholder: "name@example.com" },
          { name: "phone", label: "Phone", type: "tel", width: "half", helpText: "Optional. Used if the service desk needs to reach you." },
          {
            name: "department",
            label: "Department",
            type: "select",
            required: true,
            width: "half",
            options: [
              { value: "operations", label: "Operations" },
              { value: "finance", label: "Finance" },
              { value: "people", label: "Human Resources" },
              { value: "facilities", label: "Facilities" },
              { value: "engineering", label: "Engineering" },
              { value: "sales", label: "Sales" },
            ],
          },
        ],
      },
      {
        title: "Request",
        fields: [
          {
            name: "equipmentType",
            label: "Equipment",
            type: "radio",
            required: true,
            options: [
              { value: "laptop", label: "Laptop" },
              { value: "monitor", label: "Monitor" },
              { value: "phone", label: "Mobile phone" },
              { value: "peripherals", label: "Keyboard, mouse or headset" },
              { value: "other", label: "Other" },
            ],
          },
          {
            name: "equipmentOther",
            label: "Other equipment",
            type: "text",
            requiredWhen: { field: "equipmentType", values: ["other"], message: "Describe the equipment you need." },
            helpText: "Required when you choose Other.",
            maxLength: 200,
          },
          { name: "quantity", label: "Quantity", type: "number", required: true, min: 1, max: 20, step: 1, width: "half" },
          { name: "neededBy", label: "Needed by", type: "date", required: true, width: "half" },
          {
            name: "justification",
            label: "Business justification",
            type: "textarea",
            required: true,
            minLength: 20,
            maxLength: 1000,
            placeholder: "What will the equipment be used for?",
          },
        ],
      },
      {
        title: "Confirmation",
        fields: [
          {
            name: "policyAccepted",
            label: "I confirm this equipment is needed for work and will be used in line with the acceptable use policy.",
            type: "checkbox",
            required: true,
          },
        ],
      },
    ],
  },
};
