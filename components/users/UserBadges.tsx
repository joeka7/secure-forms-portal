import { ROLE_LABELS, USER_STATUS_LABELS, type Category, type Role, type UserStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const chip = "inline-flex max-w-full items-center rounded-md px-2 py-0.5 text-xs font-semibold leading-5";

export function RoleBadge({ role }: { role: Role }) {
  return <span className={cn(chip, role === "administrator" ? "bg-primary text-white" : "bg-accent-soft text-accent")}>{ROLE_LABELS[role]}</span>;
}

export function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary">
      <span className={cn("h-2 w-2 rounded-full", status === "active" ? "bg-[#1f9d5c]" : "bg-faint")} aria-hidden="true" />
      {USER_STATUS_LABELS[status]}
    </span>
  );
}

/** Compact category chips; administrators show a single "All categories" chip. */
export function CategoryChips({
  role,
  categoryIds,
  categoriesById,
  max = 3,
}: {
  role: Role;
  categoryIds: string[];
  categoriesById: Map<string, Category>;
  max?: number;
}) {
  if (role === "administrator") return <span className={cn(chip, "border border-accent/25 bg-surface text-accent")}>All categories</span>;
  const names = categoryIds
    .map((id) => categoriesById.get(id)?.name)
    .filter((n): n is string => !!n)
    .sort((a, b) => a.localeCompare(b));
  if (names.length === 0) return <span className={cn(chip, "bg-warning-soft text-warning")}>No categories</span>;
  const shown = names.slice(0, max);
  const hidden = names.slice(max);
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Assigned categories">
      {shown.map((name) => (
        <li key={name} className={cn(chip, "border border-line bg-surface-hover font-medium text-ink-soft")}>
          <span className="truncate">{name}</span>
        </li>
      ))}
      {hidden.length > 0 && (
        <li className={cn(chip, "bg-line-soft text-ink-nav")} title={hidden.join(", ")}>
          +{hidden.length} more
        </li>
      )}
    </ul>
  );
}
