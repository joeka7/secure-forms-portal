"use client";

import Link from "next/link";
import { Eye, FileText, FileX, Inbox, PenLine, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { matchesQuery } from "@/lib/search";
import type { Category, FormSummary } from "@/lib/types";
import { cn, plural } from "@/lib/utils";
import { CategoryIcon } from "@/components/catalog/CategoryIcon";
import { buttonGhost, buttonPrimary, buttonSecondary, buttonSmall, surface } from "@/components/ui/classes";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchField } from "@/components/ui/SearchField";
import { EmptyState } from "@/components/ui/States";

/**
 * Row actions. "Submissions" is shown to administrators only; every target page checks access on
 * the server, so hiding a button is only a convenience.
 */
function FormActions({ category, form, canViewSubmissions, className }: { category: Category; form: FormSummary; canViewSubmissions: boolean; className?: string }) {
  const href = `/forms/${category.slug}/${form.slug}`;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {canViewSubmissions && (
        <Link
          href={`/submissions?category=${encodeURIComponent(category.slug)}&form=${encodeURIComponent(form.id)}`}
          className={cn(buttonSecondary, buttonSmall, "flex-1 whitespace-nowrap sm:flex-none")}
          aria-label={`View submissions: ${form.name}`}
        >
          <Inbox className="h-4 w-4" aria-hidden="true" />
          Submissions
        </Link>
      )}
      <Link href={`${href}/view`} className={cn(buttonGhost, buttonSmall, "flex-1 whitespace-nowrap sm:flex-none")} aria-label={`Preview form: ${form.name}`}>
        <Eye className="h-4 w-4" aria-hidden="true" />
        Preview
      </Link>
      <Link href={href} className={cn(buttonPrimary, buttonSmall, "flex-1 whitespace-nowrap sm:flex-none")} aria-label={`Fill form: ${form.name}`}>
        <PenLine className="h-4 w-4" aria-hidden="true" />
        Fill form
      </Link>
    </div>
  );
}

function Description({ text, className }: { text: string; className?: string }) {
  if (!text) return <span className={cn("text-faint", className)}>—</span>;
  return (
    <p className={cn("line-clamp-3 leading-relaxed text-muted", className)} title={text}>
      {text}
    </p>
  );
}

export function CategoryFormsView({ category, forms, canViewSubmissions }: { category: Category; forms: FormSummary[]; canViewSubmissions: boolean }) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => forms.filter((f) => matchesQuery(query, f.name, f.description)), [forms, query]);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Forms", href: "/forms" }, { label: category.name }]}
        leading={
          <span className="hidden h-14 w-14 shrink-0 place-items-center rounded-xl border border-accent/10 bg-accent-soft text-accent sm:grid">
            <CategoryIcon icon={category.icon} className="h-7 w-7" />
          </span>
        }
        eyebrow={
          <span className="inline-flex items-center rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-semibold text-ink-nav">
            {plural(forms.length, "form")}
          </span>
        }
        title={category.name}
        description={category.description}
      />

      {forms.length === 0 ? (
        <EmptyState icon={FileX} title="No forms yet" description="Forms added to this category will appear here." />
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={`Search in ${category.name}`}
              label={`Search forms in ${category.name}`}
              className="w-full sm:max-w-md"
            />
            {query.trim() && (
              <p className="text-sm text-muted" aria-live="polite">
                {visible.length} of {plural(forms.length, "form")}
              </p>
            )}
          </div>
          {visible.length === 0 ? (
            <EmptyState icon={SearchX} title="No matching forms" description={<>No forms in {category.name} match &ldquo;{query.trim()}&rdquo;.</>} />
          ) : (
            <>
              <div className={cn(surface, "hidden overflow-x-auto md:block")}>
                <table className="w-full border-collapse text-left text-sm">
                  <caption className="sr-only">Forms in {category.name}</caption>
                  <thead>
                    <tr className="border-b border-line-soft bg-surface-subtle text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                      <th scope="col" className="px-5 py-3 font-semibold">
                        Form
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Description
                      </th>
                      <th scope="col" className="px-5 py-3 text-right font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {visible.map((form) => (
                      <tr key={form.id} className="align-top transition-colors hover:bg-surface-subtle">
                        <th scope="row" className="w-[30%] min-w-[200px] px-5 py-4 text-left font-normal">
                          <div className="flex items-start gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-hover text-accent">
                              <FileText className="h-[18px] w-[18px]" aria-hidden="true" strokeWidth={1.75} />
                            </span>
                            <span className="pt-1.5 font-semibold leading-snug text-primary">{form.name}</span>
                          </div>
                        </th>
                        <td className="min-w-[200px] px-4 py-4">
                          <Description text={form.description} className="pt-1.5" />
                        </td>
                        <td className="px-5 py-4">
                          <FormActions category={category} form={form} canViewSubmissions={canViewSubmissions} className="justify-end lg:flex-nowrap" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="space-y-3 md:hidden">
                {visible.map((form) => (
                  <li key={form.id} className={cn(surface, "p-4")}>
                    <p className="font-semibold leading-snug text-primary">{form.name}</p>
                    <Description text={form.description} className="mt-1.5 text-sm" />
                    <FormActions category={category} form={form} canViewSubmissions={canViewSubmissions} className="mt-4" />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </>
  );
}
