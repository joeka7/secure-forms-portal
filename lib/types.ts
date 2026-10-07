import type { FormSchema } from "@/lib/forms/types";

export const ROLES = ["administrator", "user"] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ["active", "disabled"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export type RecordStatus = "active" | "inactive";

export const ROLE_LABELS: Record<Role, string> = {
  administrator: "Administrator",
  user: "User",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: "Active",
  disabled: "Disabled",
};

/** The authenticated user, loaded fresh from the database on every request. */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  /** Assigned active category ids. Always empty for administrators (implicit access to everything). */
  categoryIds: string[];
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  sortOrder: number;
  status: RecordStatus;
};

export type CategoryWithCount = Category & { formCount: number };

export type FormSummary = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  status: RecordStatus;
  sortOrder: number;
  /** Version number of the schema currently used for new submissions. */
  version: number;
  updatedAt: string;
};

export type FormDefinition = FormSummary & { schema: FormSchema };

/** Lightweight entry used by the catalog-wide search on /forms. */
export type FormIndexEntry = {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryName: string;
  categorySlug: string;
};

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  categoryIds: string[];
  /** Stored submissions by this user (a user with submissions can be disabled but not removed). */
  submissionCount: number;
};

/** A stored submission as listed for administrators (no answers). */
export type SubmissionSummary = {
  id: string;
  /** Server-generated ISO timestamp (UTC). */
  submittedAt: string;
  person: { id: string; name: string; email: string };
  form: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string };
};

/** A stored submission with its answers and the exact form version it was submitted against. */
export type SubmissionDetail = SubmissionSummary & {
  data: Record<string, unknown>;
  schema: FormSchema;
  formVersion: number;
  /** Whether a newer version of the form has been published since. */
  isLatestVersion: boolean;
};
