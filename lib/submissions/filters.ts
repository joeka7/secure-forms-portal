import { isValidCalendarDate } from "@/lib/time";

/**
 * Administrator submission filters, shared by the Submissions page, its API and the filter toolbar.
 *
 * Filters travel in the URL (`?person=&category=&form=&from=&to=`), so a filtered view can be
 * bookmarked, and they are applied by the database query on the server, combined with AND. Every
 * value is re-validated here whatever the client sent; a malformed value is dropped.
 */

export type SubmissionFilters = {
  /** User id of the person who submitted. */
  person: string | null;
  /** Category slug. */
  category: string | null;
  /** Form id. */
  form: string | null;
  /** First day to include (YYYY-MM-DD in the display time zone). */
  from: string | null;
  /** Last day to include (YYYY-MM-DD in the display time zone); the whole day is included. */
  to: string | null;
};

/** Values offered by the filter controls. */
export type SubmissionFilterOptions = {
  /** People who have submitted at least one form. */
  people: Array<{ id: string; name: string; email: string }>;
  categories: Array<{ id: string; name: string; slug: string }>;
  forms: Array<{ id: string; name: string; categoryId: string; categoryName: string; categorySlug: string }>;
};

export const FILTER_KEYS = ["person", "category", "form", "from", "to"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export const EMPTY_FILTERS: SubmissionFilters = { person: null, category: null, form: null, from: null, to: null };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Raw = string | string[] | null | undefined;

function single(value: Raw) {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" ? v.trim() : "";
}

/** Read filters from URL parameters, dropping anything malformed. */
export function parseSubmissionFilters(get: (key: FilterKey) => Raw): SubmissionFilters {
  const person = single(get("person"));
  const category = single(get("category"));
  const form = single(get("form"));
  const from = single(get("from"));
  const to = single(get("to"));
  return {
    person: UUID_RE.test(person) ? person.toLowerCase() : null,
    category: category.length <= 80 && SLUG_RE.test(category) ? category : null,
    form: UUID_RE.test(form) ? form.toLowerCase() : null,
    from: isValidCalendarDate(from) ? from : null,
    to: isValidCalendarDate(to) ? to : null,
  };
}

/** "?person=…&from=…" for the active filters ("" when none). */
export function filtersToQuery(filters: SubmissionFilters) {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function activeFilterCount(filters: SubmissionFilters) {
  return FILTER_KEYS.filter((key) => filters[key]).length;
}
