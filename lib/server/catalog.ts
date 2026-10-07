import "server-only";
import { canAccessCategory, canAccessForm, isAdministrator } from "@/lib/authz";
import type { FormSchema } from "@/lib/forms/types";
import { getDb } from "@/lib/server/db";
import type { Category, CategoryWithCount, FormDefinition, FormIndexEntry, FormSummary, SessionUser } from "@/lib/types";

/**
 * Authorization-scoped catalog reads. Pages and API routes use these functions rather than querying
 * categories or forms directly: queries are filtered in SQL to the user's permitted categories, and
 * every result is re-checked against the central rules in `authz.ts`.
 *
 * For non-administrators an unknown category is reported as "denied" (not "not_found"), so the
 * portal never reveals which categories exist outside a user's permissions.
 */

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  sort_order: number;
  status: "active" | "inactive";
  form_count?: number;
};

type FormRow = {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  status: "active" | "inactive";
  sort_order: number;
  current_version: number;
  updated_at: string;
  schema?: string;
};

const toCategory = (r: CategoryRow): Category => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  description: r.description,
  icon: r.icon,
  sortOrder: r.sort_order,
  status: r.status,
});

const toFormSummary = (r: FormRow): FormSummary => ({
  id: r.id,
  categoryId: r.category_id,
  name: r.name,
  slug: r.slug,
  description: r.description,
  status: r.status,
  sortOrder: r.sort_order,
  version: r.current_version,
  updatedAt: r.updated_at,
});

/** SQL join + params restricting `c` (categories) to the user's assigned categories. */
function categoryScope(user: SessionUser): { join: string; params: string[] } {
  if (isAdministrator(user)) return { join: "", params: [] };
  return { join: "JOIN user_categories uc ON uc.category_id = c.id AND uc.user_id = ?", params: [user.id] };
}

const hasNoAccess = (user: SessionUser) => !isAdministrator(user) && user.categoryIds.length === 0;

export function listAccessibleCategories(user: SessionUser): CategoryWithCount[] {
  if (hasNoAccess(user)) return [];
  const scope = categoryScope(user);
  const rows = getDb()
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM forms f WHERE f.category_id = c.id AND f.status = 'active') AS form_count
         FROM categories c ${scope.join}
        WHERE c.status = 'active'
        ORDER BY c.sort_order, c.name`
    )
    .all(...scope.params) as CategoryRow[];
  return rows.filter((r) => canAccessCategory(user, r.id)).map((r) => ({ ...toCategory(r), formCount: r.form_count ?? 0 }));
}

/** Forms across every category the user may access, for the catalog-wide search. */
export function listAccessibleFormIndex(user: SessionUser): FormIndexEntry[] {
  if (hasNoAccess(user)) return [];
  const scope = categoryScope(user);
  const rows = getDb()
    .prepare(
      `SELECT f.id, f.name, f.slug, f.description, f.category_id, c.name AS category_name, c.slug AS category_slug
         FROM forms f
         JOIN categories c ON c.id = f.category_id ${scope.join}
        WHERE f.status = 'active' AND c.status = 'active'
        ORDER BY c.sort_order, f.sort_order, f.name`
    )
    .all(...scope.params) as Array<{
    id: string;
    name: string;
    slug: string;
    description: string;
    category_id: string;
    category_name: string;
    category_slug: string;
  }>;
  return rows
    .filter((r) => canAccessForm(user, { categoryId: r.category_id }))
    .map((r) => ({ id: r.id, name: r.name, slug: r.slug, description: r.description, categoryName: r.category_name, categorySlug: r.category_slug }));
}

export type CategoryResult = { kind: "ok"; category: Category; forms: FormSummary[] } | { kind: "denied" } | { kind: "not_found" };

function findActiveCategory(slug: string) {
  const row = getDb().prepare("SELECT * FROM categories WHERE slug = ? AND status = 'active'").get(slug) as CategoryRow | undefined;
  return row ? toCategory(row) : null;
}

export function getCategoryForUser(user: SessionUser, categorySlug: string): CategoryResult {
  const category = findActiveCategory(categorySlug);
  if (!category) return { kind: isAdministrator(user) ? "not_found" : "denied" };
  if (!canAccessCategory(user, category.id)) return { kind: "denied" };
  const forms = (
    getDb()
      .prepare(
        `SELECT id, category_id, name, slug, description, status, sort_order, current_version, updated_at
           FROM forms WHERE category_id = ? AND status = 'active'
          ORDER BY sort_order, name`
      )
      .all(category.id) as FormRow[]
  ).map(toFormSummary);
  return { kind: "ok", category, forms };
}

export type FormResult = { kind: "ok"; category: Category; form: FormDefinition } | { kind: "denied" } | { kind: "not_found" };

/** An active form with its current schema version, if the user may access its category. */
export function getFormForUser(user: SessionUser, categorySlug: string, formSlug: string): FormResult {
  const category = findActiveCategory(categorySlug);
  if (!category) return { kind: isAdministrator(user) ? "not_found" : "denied" };
  if (!canAccessCategory(user, category.id)) return { kind: "denied" };

  const row = getDb()
    .prepare(
      `SELECT f.*, v.schema
         FROM forms f
         JOIN form_versions v ON v.form_id = f.id AND v.version = f.current_version
        WHERE f.category_id = ? AND f.slug = ? AND f.status = 'active'`
    )
    .get(category.id, formSlug) as FormRow | undefined;
  if (!row?.schema) return { kind: "not_found" };

  const form: FormDefinition = { ...toFormSummary(row), schema: JSON.parse(row.schema) as FormSchema };
  if (!canAccessForm(user, form)) return { kind: "denied" };
  return { kind: "ok", category, form };
}

/** Every active category, for the administrator's category assignment picker. */
export function listAllCategoriesForAdmin(user: SessionUser): Category[] {
  if (!isAdministrator(user)) throw new Error("Administrator access required.");
  return (getDb().prepare("SELECT * FROM categories WHERE status = 'active' ORDER BY sort_order, name").all() as CategoryRow[]).map(toCategory);
}
