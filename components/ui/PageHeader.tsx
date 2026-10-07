import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-[13px] font-medium">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {item.href && !last ? (
                <Link href={item.href} className="truncate rounded text-muted transition-colors hover:text-accent">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className="truncate text-primary">
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  breadcrumbs,
  eyebrow,
  title,
  description,
  actions,
  leading,
}: {
  breadcrumbs?: Crumb[];
  eyebrow?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  leading?: React.ReactNode;
}) {
  return (
    <header className="mb-8">
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className={cn("flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between", breadcrumbs && "mt-4")}>
        <div className="flex min-w-0 items-start gap-4">
          {leading}
          <div className="min-w-0">
            {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
            <h1 className="break-words text-[26px] font-semibold leading-tight tracking-tight text-primary sm:text-[30px]">{title}</h1>
            {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}
