import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/config";
import { ROLES, USER_STATUSES, type Role, type UserStatus } from "@/lib/types";

/**
 * Validation for administrator user management, shared by the Users dialog and the API so both
 * apply identical rules.
 */

export type UserInput = {
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  categoryIds: string[];
  /** Required when creating; optional when editing (absent or blank keeps the current password). */
  password?: string;
};

export type UserFieldErrors = Partial<Record<keyof UserInput, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CATEGORIES = 500;

export function validateUserInput(raw: unknown, mode: "create" | "update"): { ok: true; value: UserInput } | { ok: false; errors: UserFieldErrors } {
  const input = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const errors: UserFieldErrors = {};

  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2) errors.name = "Enter the user's full name.";
  else if (name.length > 120) errors.name = "Name must be 120 characters or fewer.";

  // Email addresses are case-insensitive: always stored and compared in lower case.
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!email) errors.email = "Email is required.";
  else if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";

  const role = input.role as Role;
  if (!ROLES.includes(role)) errors.role = "Choose a role.";

  const status = (input.status ?? "active") as UserStatus;
  if (!USER_STATUSES.includes(status)) errors.status = "Choose a status.";

  const rawCategories = Array.isArray(input.categoryIds) ? input.categoryIds : [];
  const categoryIds = Array.from(new Set(rawCategories.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 64)));
  if (rawCategories.length > MAX_CATEGORIES) errors.categoryIds = "Too many categories selected.";
  // Administrators have implicit access to everything, so their assignments are not stored.
  const effectiveCategories = role === "administrator" ? [] : categoryIds;
  if (role === "user" && effectiveCategories.length === 0 && !errors.categoryIds) {
    errors.categoryIds = "Assign at least one category to this user.";
  }

  const password = typeof input.password === "string" ? input.password : "";
  const passwordProvided = password.length > 0;
  if (mode === "create" && !passwordProvided) errors.password = "Password is required.";
  else if (passwordProvided) {
    if (password.length < PASSWORD_MIN_LENGTH) errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
    else if (password.length > PASSWORD_MAX_LENGTH) errors.password = `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, email, role, status, categoryIds: effectiveCategories, password: passwordProvided ? password : undefined } };
}
