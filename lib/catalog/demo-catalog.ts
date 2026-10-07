import type { CatalogCategory } from "@/lib/catalog/types";
import { equipmentRequest } from "@/lib/catalog/forms/equipment-request";
import { incidentReport } from "@/lib/catalog/forms/incident-report";
import { leaveRequest } from "@/lib/catalog/forms/leave-request";
import { maintenanceRequest } from "@/lib/catalog/forms/maintenance-request";
import { operationsReview } from "@/lib/catalog/forms/operations-review";
import { systemAccessRequest } from "@/lib/catalog/forms/system-access-request";

/**
 * The demo catalog: four generic categories and six fictional forms that together exercise every
 * field type, content block, table layout and conditional rule the schema supports.
 *
 * Array order sets the display order of categories and of forms within a category. Entries are synced
 * by slug, so renaming a slug creates a new record; removing an entry never deletes it (set
 * `status: "inactive"` to retire one).
 */
export const catalog: CatalogCategory[] = [
  {
    slug: "it-requests",
    name: "IT Requests",
    description: "Hardware, software and system access requests.",
    icon: "laptop",
    forms: [equipmentRequest, systemAccessRequest],
  },
  {
    slug: "facilities",
    name: "Facilities",
    description: "Building maintenance, repairs and workplace services.",
    icon: "building",
    forms: [maintenanceRequest],
  },
  {
    slug: "human-resources",
    name: "Human Resources",
    description: "Leave and other people processes.",
    icon: "users",
    forms: [leaveRequest],
  },
  {
    slug: "operations",
    name: "Operations",
    description: "Incident reporting and operational reviews.",
    icon: "clipboard",
    forms: [incidentReport, operationsReview],
  },
];
