import Link from "next/link";
import { ArrowRight, ChevronRight, FileText } from "lucide-react";
import type { CategoryWithCount } from "@/lib/types";
import { cn, plural } from "@/lib/utils";
import { CategoryIcon } from "@/components/catalog/CategoryIcon";

const interactiveCard =
  "group rounded-xl border border-line bg-surface shadow-card transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none motion-reduce:hover:translate-y-0";

export function CategoryCard({ category }: { category: CategoryWithCount }) {
  return (
    <Link href={`/forms/${category.slug}`} className={cn(interactiveCard, "flex h-full flex-col p-5 sm:p-6")}>
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent ring-1 ring-inset ring-accent/10 transition-colors duration-200 group-hover:bg-accent group-hover:text-white">
          <CategoryIcon icon={category.icon} className="h-[22px] w-[22px]" />
        </span>
        <span className="rounded-full border border-line bg-surface-hover px-2.5 py-1 text-xs font-semibold text-ink-nav">{plural(category.formCount, "form")}</span>
      </div>
      <h3 className="mt-5 text-[17px] font-semibold leading-snug text-primary">{category.name}</h3>
      {category.description && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">{category.description}</p>}
      <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-accent">
        View forms
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

export function FormCard({ href, name, description, context }: { href: string; name: string; description: string; context?: string }) {
  return (
    <Link href={href} className={cn(interactiveCard, "flex h-full items-center gap-4 px-4 py-4 sm:px-5")}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-hover text-accent transition-colors duration-200 group-hover:bg-accent-soft">
        <FileText className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        {context && <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{context}</p>}
        <p className="font-semibold leading-snug text-primary">{name}</p>
        {description && <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-faint transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden="true" />
    </Link>
  );
}
