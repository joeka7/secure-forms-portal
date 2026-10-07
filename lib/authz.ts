import type { SessionUser } from "@/lib/types";

/**
 * Central authorization rules.
 *
 * Every permission decision (server pages, API routes, service functions and UI) goes through these
 * functions. Rules deny by default: an unknown role, a disabled account or a missing user never
 * gets access. Hiding UI is only a convenience; the server re-checks every rule.
 *
 * Form access is inherited from the form's category, so a user automatically gains access to forms
 * added later to a category they are assigned to.
 */

type Actor = Pick<SessionUser, "role" | "status" | "categoryIds"> | null | undefined;

function isActive(user: Actor): user is NonNullable<Actor> {
  return !!user && user.status === "active";
}

export function isAdministrator(user: Actor) {
  return isActive(user) && user.role === "administrator";
}

export function canAccessCategory(user: Actor, categoryId: string) {
  if (!isActive(user)) return false;
  if (user.role === "administrator") return true;
  if (user.role === "user") return user.categoryIds.includes(categoryId);
  return false;
}

export function canAccessForm(user: Actor, form: { categoryId: string }) {
  return canAccessCategory(user, form.categoryId);
}

export function canSubmitForm(user: Actor, form: { categoryId: string }) {
  return canAccessForm(user, form);
}

export function canManageUsers(user: Actor) {
  return isAdministrator(user);
}

/** Listing and reading stored submissions (every user's answers) is reserved for administrators. */
export function canViewSubmissions(user: Actor) {
  return isAdministrator(user);
}
