"use client";

import { FolderLock, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { matchesQuery } from "@/lib/search";
import type { CategoryWithCount, FormIndexEntry } from "@/lib/types";
import { plural } from "@/lib/utils";
import { CategoryCard, FormCard } from "@/components/catalog/CatalogCards";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchField } from "@/components/ui/SearchField";
import { EmptyState } from "@/components/ui/States";

/**
 * The /forms dashboard. It receives only the categories and forms the server has already authorised
 * for this user, so search runs instantly in the browser without exposing anything else.
 */
export function FormsHome({ categories, forms, isAdministrator }: { categories: CategoryWithCount[]; forms: FormIndexEntry[]; isAdministrator: boolean }) {
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  const matchingCategories = useMemo(() => categories.filter((c) => matchesQuery(query, c.name, c.description)), [categories, query]);
  const matchingForms = useMemo(
    () => (searching ? forms.filter((f) => matchesQuery(query, f.name, f.description, f.categoryName)) : []),
    [forms, query, searching]
  );

  const header = (
    <PageHeader
      title="Forms"
      description={
        isAdministrator
          ? "Every form category. As an administrator you can open and submit any form."
          : "The form categories assigned to you. Choose a category to see its forms."
      }
    />
  );

  if (categories.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={FolderLock}
          title="No forms available"
          description={
            isAdministrator
              ? "No form categories are active. Categories and forms appear here once they are added to the catalog."
              : "You don't have access to any form categories yet. Contact an administrator to request access."
          }
        />
      </>
    );
  }

  const totalForms = categories.reduce((sum, c) => sum + c.formCount, 0);

  return (
    <>
      {header}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchField value={query} onChange={setQuery} placeholder="Search forms and categories" label="Search forms and categories" className="w-full sm:max-w-md" />
        <p className="text-sm text-muted" aria-live="polite">
          {searching
            ? `${plural(matchingCategories.length, "category", "categories")}, ${plural(matchingForms.length, "form")}`
            : `${plural(categories.length, "category", "categories")} · ${plural(totalForms, "form")}`}
        </p>
      </div>

      {searching && matchingCategories.length === 0 && matchingForms.length === 0 ? (
        <EmptyState icon={SearchX} title="No results" description={<>Nothing matches &ldquo;{query.trim()}&rdquo;. Try a different form or category name.</>} />
      ) : (
        <div className="space-y-10">
          {matchingCategories.length > 0 && (
            <section aria-labelledby="categories-heading">
              <h2 id="categories-heading" className={searching ? "mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted" : "sr-only"}>
                Categories
              </h2>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {matchingCategories.map((category) => (
                  <li key={category.id}>
                    <CategoryCard category={category} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {matchingForms.length > 0 && (
            <section aria-labelledby="forms-heading">
              <h2 id="forms-heading" className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                Forms
              </h2>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {matchingForms.map((form) => (
                  <li key={form.id}>
                    <FormCard href={`/forms/${form.categorySlug}/${form.slug}`} name={form.name} description={form.description} context={form.categoryName} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
