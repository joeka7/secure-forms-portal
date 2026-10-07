"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Inbox, SearchX, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { matchesQuery } from "@/lib/search";
import { EMPTY_FILTERS, activeFilterCount, filtersToQuery, type SubmissionFilterOptions, type SubmissionFilters } from "@/lib/submissions/filters";
import type { SubmissionSummary } from "@/lib/types";
import { cn, plural } from "@/lib/utils";
import { buttonSecondary, buttonSmall, selectBase, surface } from "@/components/ui/classes";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchField } from "@/components/ui/SearchField";
import { EmptyState } from "@/components/ui/States";
import { LocalTime } from "@/components/ui/TimeZone";
import { SubmissionFiltersBar } from "@/components/submissions/SubmissionFiltersBar";

type SortKey = "person" | "form" | "category" | "submittedAt";
type SortDir = "asc" | "desc";
type Sort = { key: SortKey; dir: SortDir };

const DEFAULT_SORT: Sort = { key: "submittedAt", dir: "desc" };
const SORT_LABELS: Record<SortKey, string> = { person: "Person", form: "Form", category: "Category", submittedAt: "Submitted" };

/** Sort choices for layouts without column headings (phones and tablets). */
const SORT_OPTIONS = [
  { value: "submittedAt:desc", label: "Newest first" },
  { value: "submittedAt:asc", label: "Oldest first" },
  { value: "person:asc", label: "Person (A–Z)" },
  { value: "person:desc", label: "Person (Z–A)" },
  { value: "form:asc", label: "Form (A–Z)" },
  { value: "form:desc", label: "Form (Z–A)" },
  { value: "category:asc", label: "Category (A–Z)" },
  { value: "category:desc", label: "Category (Z–A)" },
];

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

function sortValue(s: SubmissionSummary, key: SortKey) {
  if (key === "person") return s.person.name;
  if (key === "form") return s.form.name;
  if (key === "category") return s.category.name;
  return s.submittedAt;
}

function sortSubmissions(list: SubmissionSummary[], sort: Sort) {
  const factor = sort.dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    const primary = sort.key === "submittedAt" ? a.submittedAt.localeCompare(b.submittedAt) : collator.compare(sortValue(a, sort.key), sortValue(b, sort.key));
    // Ties stay newest first.
    return primary * factor || b.submittedAt.localeCompare(a.submittedAt);
  });
}

function describeSort(sort: Sort) {
  if (sort.key === "submittedAt") return sort.dir === "desc" ? "newest first" : "oldest first";
  return `by ${SORT_LABELS[sort.key].toLowerCase()} (${sort.dir === "asc" ? "A–Z" : "Z–A"})`;
}

function SortHeader({ column, sort, onSort, className }: { column: SortKey; sort: Sort; onSort: (key: SortKey) => void; className?: string }) {
  const active = sort.key === column;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("py-2 font-semibold", className)}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "-mx-2 inline-flex min-h-[32px] items-center gap-1.5 rounded-md px-2 uppercase tracking-[0.06em] transition-colors hover:bg-accent-soft hover:text-primary",
          active && "text-accent"
        )}
      >
        {SORT_LABELS[column]}
        <Icon className={cn("h-3.5 w-3.5", !active && "opacity-50")} aria-hidden="true" />
      </button>
    </th>
  );
}

function ViewLink({ submission, className }: { submission: SubmissionSummary; className?: string }) {
  return (
    <Link
      href={`/submissions/${submission.id}`}
      className={cn(buttonSecondary, buttonSmall, "whitespace-nowrap", className)}
      aria-label={`View submission: ${submission.form.name} by ${submission.person.name}`}
    >
      <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
      View
    </Link>
  );
}

/**
 * Administrator submissions list. The server applies the filters (from the URL) to all stored
 * submissions; this component then applies the search and the sort, which survive filter changes.
 */
export function SubmissionsTable({
  submissions,
  total,
  filters,
  options,
  timeZoneLabel,
}: {
  submissions: SubmissionSummary[];
  total: number;
  filters: SubmissionFilters;
  options: SubmissionFilterOptions;
  timeZoneLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  // The controls reflect a change immediately; the server's validated filters take over once loaded.
  const [shownFilters, setShownFilters] = useState(filters);
  useEffect(() => setShownFilters(filters), [filters]);

  const visible = useMemo(
    () => sortSubmissions(submissions.filter((s) => matchesQuery(query, s.person.name, s.person.email, s.form.name, s.category.name)), sort),
    [submissions, query, sort]
  );

  // A new column starts A–Z (names) or newest first (time); the same column toggles the direction.
  const onSort = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "submittedAt" ? "desc" : "asc" }));

  const applyFilters = (next: SubmissionFilters) => {
    setShownFilters(next);
    startTransition(() => router.replace(`/submissions${filtersToQuery(next)}`, { scroll: false }));
  };

  const filtersActive = activeFilterCount(filters) > 0;
  const searching = query.trim() !== "";

  return (
    <>
      <PageHeader title="Submissions" description={`Every submitted form, newest first by default. Times are shown in ${timeZoneLabel}.`} />

      {total === 0 ? (
        <EmptyState icon={Inbox} title="No submissions yet" description="Submitted forms will appear here." />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search by person, form or category"
              label="Search submissions by person, form or category"
              className="w-full sm:min-w-0 sm:max-w-md sm:flex-1"
            />
            <div className="flex items-center justify-between gap-3 sm:shrink-0">
              <label className="flex flex-1 items-center gap-2 xl:hidden">
                <span className="shrink-0 text-sm text-muted">Sort by</span>
                <select
                  value={`${sort.key}:${sort.dir}`}
                  onChange={(e) => {
                    const [key, dir] = e.target.value.split(":") as [SortKey, SortDir];
                    setSort({ key, dir });
                  }}
                  className={cn(selectBase, "min-h-[40px] min-w-[160px] py-2 text-sm")}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="shrink-0 text-sm text-muted" aria-live="polite" data-testid="result-count">
                {filtersActive || searching ? `${visible.length} of ${plural(total, "submission")}` : plural(total, "submission")}
              </p>
            </div>
          </div>

          <SubmissionFiltersBar filters={shownFilters} options={options} timeZoneLabel={timeZoneLabel} onChange={applyFilters} />

          <div aria-busy={pending} className={cn("transition-opacity", pending && "opacity-60")}>
            {visible.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title={filtersActive ? "No submissions match your filters" : "No submissions match your search"}
                description={
                  filtersActive && searching ? (
                    <>No submissions match the selected filters and &ldquo;{query.trim()}&rdquo;.</>
                  ) : filtersActive ? (
                    "Try different filters, or clear them to see every submission."
                  ) : (
                    <>No submissions match &ldquo;{query.trim()}&rdquo;.</>
                  )
                }
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    {filtersActive && (
                      <button type="button" onClick={() => applyFilters(EMPTY_FILTERS)} className={buttonSecondary}>
                        <X className="h-4 w-4" aria-hidden="true" />
                        Clear filters
                      </button>
                    )}
                    {searching && (
                      <button type="button" onClick={() => setQuery("")} className={buttonSecondary}>
                        Clear search
                      </button>
                    )}
                  </div>
                }
              />
            ) : (
              <>
                <div className={cn(surface, "hidden overflow-x-auto xl:block")}>
                  <table className="w-full border-collapse text-left text-sm">
                    <caption className="sr-only">Submitted forms, sorted {describeSort(sort)}</caption>
                    <thead>
                      <tr className="border-b border-line-soft bg-surface-subtle text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                        <SortHeader column="person" sort={sort} onSort={onSort} className="px-5" />
                        <SortHeader column="form" sort={sort} onSort={onSort} className="px-4" />
                        <SortHeader column="category" sort={sort} onSort={onSort} className="px-4" />
                        <SortHeader column="submittedAt" sort={sort} onSort={onSort} className="whitespace-nowrap px-4" />
                        <th scope="col" className="px-5 py-3 text-right font-semibold">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft">
                      {visible.map((s) => (
                        <tr key={s.id} className="align-top transition-colors hover:bg-surface-subtle">
                          <td className="min-w-[180px] px-5 py-4">
                            <p className="break-words font-semibold text-primary">{s.person.name}</p>
                            <p className="max-w-[260px] truncate text-[13px] text-muted" title={s.person.email}>
                              {s.person.email}
                            </p>
                          </td>
                          <td className="min-w-[160px] px-4 py-4 font-medium leading-snug text-primary">{s.form.name}</td>
                          <td className="min-w-[120px] px-4 py-4 leading-snug text-muted">{s.category.name}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-primary">
                            <LocalTime iso={s.submittedAt} />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <ViewLink submission={s} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:hidden">
                  {visible.map((s) => (
                    <li key={s.id} className={cn(surface, "flex flex-col p-4")}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{s.category.name}</p>
                      <p className="mt-1 font-semibold leading-snug text-primary">{s.form.name}</p>
                      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
                        <dt className="text-muted">Person</dt>
                        <dd className="min-w-0 break-words text-primary">
                          {s.person.name}
                          <span className="block break-all text-muted">{s.person.email}</span>
                        </dd>
                        <dt className="text-muted">Submitted</dt>
                        <dd className="text-primary">
                          <LocalTime iso={s.submittedAt} />
                        </dd>
                      </dl>
                      <div className="mt-auto pt-4">
                        <ViewLink submission={s} className="w-full" />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
