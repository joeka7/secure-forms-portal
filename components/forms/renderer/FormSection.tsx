"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { RequiredProgress } from "@/lib/forms/progress";
import type { FormField, FormSection } from "@/lib/forms/types";
import { cn } from "@/lib/utils";
import { surface } from "@/components/ui/classes";
import { ContentBlocks } from "@/components/forms/renderer/ContentBlocks";

export type NavItem = { section: FormSection; index: number };

/**
 * One schema section: heading, instructions, fields and footer. Shared by every mode so a form
 * always looks the same whether it is being filled in, previewed or reviewed.
 */
export function FormSectionView({
  section,
  longForm,
  progress,
  renderField,
}: {
  section: FormSection;
  longForm: boolean;
  /** Required-item progress (fill mode only). */
  progress?: RequiredProgress;
  renderField: (field: FormField) => React.ReactNode;
}) {
  const body = (
    <>
      {(section.eyebrow || section.title || section.description) && (
        <div className="mb-5">
          {section.eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">{section.eyebrow}</p>}
          {section.title && (
            <h2 className={cn("font-semibold tracking-tight text-primary", longForm ? "text-xl" : "text-base")}>{section.title}</h2>
          )}
          {section.description && <p className="mt-1 text-sm leading-relaxed text-muted">{section.description}</p>}
          {longForm && progress && progress.total > 0 && (
            <p className={cn("mt-2 text-xs font-medium", progress.done === progress.total ? "text-success" : "text-muted")}>
              {progress.done} of {progress.total} required items complete
            </p>
          )}
        </div>
      )}
      {section.content?.length ? (
        <div className="mb-6">
          <ContentBlocks blocks={section.content} />
        </div>
      ) : null}
      {section.fields.length > 0 && (
        <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
          {section.fields.map((field) => (
            <div
              key={field.name}
              className={cn("min-w-0", field.width === "half" && field.type !== "table" && field.type !== "repeater" ? "sm:col-span-1" : "sm:col-span-2")}
            >
              {renderField(field)}
            </div>
          ))}
        </div>
      )}
      {section.footer?.length ? (
        <div className="mt-6">
          <ContentBlocks blocks={section.footer} />
        </div>
      ) : null}
    </>
  );
  if (longForm) {
    return (
      <section
        id={section.id ? `section-${section.id}` : undefined}
        aria-label={section.title}
        tabIndex={-1}
        className={cn(surface, "scroll-mt-24 px-5 py-6 outline-none sm:px-8 sm:py-8 print:break-inside-auto print:shadow-none")}
      >
        {body}
      </section>
    );
  }
  return (
    <section aria-label={section.title} className="min-w-0 px-5 py-6 sm:px-8 sm:py-8">
      {body}
    </section>
  );
}

/** Sections of a long form that appear in its navigation (they need an id and a title). */
export function navigableSections(sections: FormSection[], longForm: boolean): NavItem[] {
  return sections.map((section, index) => ({ section, index })).filter(({ section }) => longForm && section.id && section.title);
}

/** Tracks which long-form section is on screen, for the side navigation. */
export function useActiveSection(sections: FormSection[], enabled: boolean, resetKey?: unknown) {
  const [active, setActive] = useState<string | null>(sections.find((s) => s.id && s.title)?.id ?? null);
  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;
    const els = sections.map((s) => (s.id ? document.getElementById(`section-${s.id}`) : null)).filter((el): el is HTMLElement => !!el);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id.replace(/^section-/, ""));
      },
      { rootMargin: "-15% 0px -70% 0px" }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [enabled, sections, resetKey]);
  return active;
}

/** Side navigation of a long form (desktop). Progress is shown in fill mode only. */
export function SectionNavLinks({ items, active, progress }: { items: NavItem[]; active: string | null; progress?: RequiredProgress[] }) {
  return (
    <ol className="space-y-0.5">
      {items.map(({ section, index }) => {
        const p = progress?.[index];
        const isActive = active === section.id;
        const complete = !!p && p.total > 0 && p.done === p.total;
        return (
          <li key={section.id}>
            <a
              href={`#section-${section.id}`}
              aria-current={isActive ? "location" : undefined}
              className={cn(
                "flex items-start gap-2 rounded-md px-2 py-1.5 text-[13px] leading-snug transition-colors",
                isActive ? "bg-accent-soft font-semibold text-accent" : "text-ink-nav hover:bg-surface-hover hover:text-primary"
              )}
            >
              <span className="min-w-0 flex-1">{section.title}</span>
              {p && p.total > 0 && (
                <span className={cn("shrink-0 text-[11px] tabular-nums", complete ? "text-success" : "text-muted")}>
                  {complete ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="sr-only">complete</span>
                    </>
                  ) : (
                    <>
                      {p.done}/{p.total}
                      <span className="sr-only"> required items complete</span>
                    </>
                  )}
                </span>
              )}
            </a>
          </li>
        );
      })}
    </ol>
  );
}

/** Collapsible section list for screens without the side navigation. */
export function SectionJumpList({ items, progress }: { items: NavItem[]; progress?: RequiredProgress[] }) {
  return (
    <details className="group">
      <summary className="cursor-pointer rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm font-medium text-primary">Jump to section</summary>
      <nav aria-label="Jump to section" className="mt-2">
        <ol className="space-y-0.5">
          {items.map(({ section, index }) => (
            <li key={section.id}>
              <a
                href={`#section-${section.id}`}
                className="flex items-start justify-between gap-3 rounded-md px-2 py-2 text-sm text-ink-nav hover:bg-surface-hover hover:text-primary"
              >
                <span>{section.title}</span>
                {progress && progress[index].total > 0 && (
                  <span className="shrink-0 text-[12px] tabular-nums text-muted">
                    {progress[index].done}/{progress[index].total}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}
