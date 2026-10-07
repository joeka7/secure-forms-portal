import Link from "next/link";
import { ArrowLeft, Inbox, ShieldAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonSecondary, surface } from "@/components/ui/classes";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  headingLevel = 2,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className={cn(surface, "flex flex-col items-center px-6 py-14 text-center sm:py-16", className)}>
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent">
        <Icon className="h-6 w-6" aria-hidden="true" strokeWidth={1.75} />
      </span>
      <Heading className="mt-5 text-lg font-semibold text-primary">{title}</Heading>
      {description && <div className="mt-2 max-w-md text-[15px] leading-relaxed text-muted">{description}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/**
 * Shown when a user requests a category, form or page outside their permissions. Deliberately
 * generic: it never names the resource or reveals whether it exists.
 */
export function AccessDenied({ message }: { message: string }) {
  return (
    <div className={cn(surface, "mx-auto mt-4 flex max-w-xl flex-col items-center px-6 py-14 text-center sm:mt-10 sm:px-10")}>
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-danger-soft text-danger">
        <ShieldAlert className="h-6 w-6" aria-hidden="true" strokeWidth={1.75} />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-primary">Access denied</h1>
      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted">{message}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">If you believe you should have access, contact an administrator.</p>
      <Link href="/forms" className={cn(buttonSecondary, "mt-7")}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Forms
      </Link>
    </div>
  );
}
