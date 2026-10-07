import type { CatalogForm } from "@/lib/catalog/types";

/** Checkbox limits, date/time inputs, a typed signature and a conditionally required justification. */
export const systemAccessRequest: CatalogForm = {
  slug: "system-access-request",
  name: "System Access Request",
  description: "Request access to business applications, with the access level and duration you need.",
  schema: {
    version: 1,
    submitLabel: "Request access",
    sections: [
      {
        title: "Employee",
        content: [
          {
            kind: "callout",
            tone: "info",
            title: "Least privilege",
            text: "Request only the systems and access level needed for your role. Access is reviewed every quarter.",
          },
        ],
        fields: [
          { name: "employeeName", label: "Employee name", type: "text", required: true, width: "half" },
          { name: "employeeId", label: "Employee ID", type: "text", required: true, width: "half", maxLength: 20, placeholder: "e.g. EMP-1042" },
          { name: "managerEmail", label: "Line manager email", type: "email", required: true, width: "half" },
          { name: "teamName", label: "Team", type: "text", width: "half" },
        ],
      },
      {
        title: "Access",
        fields: [
          {
            name: "systems",
            label: "Systems",
            type: "checkboxes",
            required: true,
            maxSelected: 4,
            helpText: "Choose up to four systems per request.",
            options: [
              { value: "email", label: "Email and calendar" },
              { value: "documents", label: "Document management" },
              { value: "finance", label: "Finance system" },
              { value: "hr", label: "HR system" },
              { value: "ticketing", label: "Service desk ticketing" },
              { value: "analytics", label: "Analytics dashboards" },
              { value: "vpn", label: "Remote access (VPN)" },
            ],
          },
          {
            name: "accessLevel",
            label: "Access level",
            type: "select",
            required: true,
            width: "half",
            options: [
              { value: "read", label: "Read only" },
              { value: "standard", label: "Standard user" },
              { value: "power", label: "Power user" },
              { value: "admin", label: "Administrator" },
            ],
          },
          { name: "startAt", label: "Access starts", type: "datetime", required: true, width: "half" },
          { name: "endDate", label: "Access ends", type: "date", width: "half", helpText: "Leave blank for ongoing access." },
          {
            name: "adminJustification",
            label: "Reason for administrator access",
            type: "textarea",
            maxLength: 1000,
            requiredWhen: { field: "accessLevel", values: ["admin"], message: "Explain why administrator access is required." },
            helpText: "Required for administrator access.",
          },
        ],
      },
      {
        title: "Signature",
        fields: [
          {
            name: "requesterSignature",
            label: "Requester signature",
            type: "signature",
            required: true,
            helpText: "Type your full name. The portal also records your account and the submission time.",
          },
        ],
      },
    ],
  },
};
