"use client";

import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { EMPTY_FILTERS, activeFilterCount, type SubmissionFilterOptions, type SubmissionFilters } from "@/lib/submissions/filters";
import { cn } from "@/lib/utils";
import { buttonGhost, inputBase, selectBase, surface } from "@/components/ui/classes";
import { FilterCombobox, filterLabel } from "@/components/submissions/FilterCombobox";

/**
 * Person, Category, Form and date-range filters. Changes are reported to the parent, which applies
 * them through the URL (the server runs the filtered query). On phones the controls fold into a
 * "Filters" panel.
 */
export function SubmissionFiltersBar({
  filters,
  options,
  timeZoneLabel,
  onChange,
}: {
  filters: SubmissionFilters;
  options: SubmissionFilterOptions;
  timeZoneLabel: string;
  onChange: (next: SubmissionFilters) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(filters);
  const set = (patch: Partial<SubmissionFilters>) => onChange({ ...filters, ...patch });

  const people = useMemo(() => options.people.map((p) => ({ value: p.id, label: p.name, detail: p.email })), [options.people]);
  // With a category chosen, only its forms are offered.
  const forms = useMemo(
    () => options.forms.filter((f) => !filters.category || f.categorySlug === filters.category).map((f) => ({ value: f.id, label: f.name, detail: f.categoryName })),
    [options.forms, filters.category]
  );
  const rangeReversed = !!filters.from && !!filters.to && filters.from > filters.to;

  const badge = count > 0 && (
    <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">
      {count}
      <span className="sr-only"> active</span>
    </span>
  );

  return (
    <section aria-label="Filters" className={cn(surface, "mb-5 px-4 py-3 sm:px-5 sm:py-4")}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          className="-ml-1 inline-flex min-h-[36px] items-center gap-2 rounded-md px-1 text-sm font-semibold text-primary md:hidden"
        >
          <SlidersHorizontal className="h-4 w-4 text-accent" aria-hidden="true" />
          Filters
          {badge}
          <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")} aria-hidden="true" />
        </button>
        <h2 className="hidden items-center gap-2 text-sm font-semibold text-primary md:inline-flex">
          <SlidersHorizontal className="h-4 w-4 text-accent" aria-hidden="true" />
          Filters
          {badge}
        </h2>
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          disabled={count === 0}
          className={cn(buttonGhost, "min-h-[36px] px-3 text-[13px] disabled:opacity-40")}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear filters
        </button>
      </div>

      <div id={`${id}-panel`} className={cn("mt-3 grid-cols-1 gap-3 sm:grid-cols-2 md:grid lg:grid-cols-3 2xl:grid-cols-5", open ? "grid" : "hidden")}>
        <FilterCombobox label="Person" allLabel="All people" options={people} value={filters.person ?? ""} onChange={(v) => set({ person: v || null })} />
        <div className="min-w-0">
          <label htmlFor={`${id}-category`} className={filterLabel}>
            Category
          </label>
          <select
            id={`${id}-category`}
            value={filters.category ?? ""}
            onChange={(e) => {
              const category = e.target.value || null;
              // Keep the chosen form only if it belongs to the new category.
              const form = options.forms.find((f) => f.id === filters.form);
              set({ category, form: form && (!category || form.categorySlug === category) ? filters.form : null });
            }}
            className={cn(selectBase, "min-h-[42px] py-2 text-sm", filters.category && "font-medium")}
          >
            <option value="">All categories</option>
            {options.categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <FilterCombobox label="Form" allLabel="All forms" options={forms} value={filters.form ?? ""} onChange={(v) => set({ form: v || null })} />
        <div className="min-w-0">
          <label htmlFor={`${id}-from`} className={filterLabel}>
            From
          </label>
          <input
            id={`${id}-from`}
            type="date"
            value={filters.from ?? ""}
            max={filters.to ?? undefined}
            onChange={(e) => set({ from: e.target.value || null })}
            aria-describedby={rangeReversed ? `${id}-range` : undefined}
            className={cn(inputBase, "min-h-[42px] py-2 text-sm")}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-to`} className={filterLabel}>
            To
          </label>
          <input
            id={`${id}-to`}
            type="date"
            value={filters.to ?? ""}
            min={filters.from ?? undefined}
            onChange={(e) => set({ to: e.target.value || null })}
            aria-describedby={rangeReversed ? `${id}-range` : undefined}
            className={cn(inputBase, "min-h-[42px] py-2 text-sm")}
          />
        </div>
      </div>
      {rangeReversed && (
        <p id={`${id}-range`} className="mt-2 text-[13px] font-medium text-danger">
          &ldquo;From&rdquo; is after &ldquo;To&rdquo;, so no submissions can match.
        </p>
      )}
      <p className={cn("mt-2 text-[12px] text-muted", !open && "hidden md:block")}>Dates are whole days in {timeZoneLabel}.</p>
    </section>
  );
}
