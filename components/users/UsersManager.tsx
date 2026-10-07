"use client";

import { CircleCheck, Pencil, Trash2, UserPlus, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { matchesQuery } from "@/lib/search";
import { ROLE_LABELS, ROLES, USER_STATUS_LABELS, USER_STATUSES, type Category, type ManagedUser, type Role, type UserStatus } from "@/lib/types";
import { cn, initials, plural } from "@/lib/utils";
import { alertSuccess, buttonPrimary, buttonSecondary, selectBase, surface } from "@/components/ui/classes";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchField } from "@/components/ui/SearchField";
import { EmptyState } from "@/components/ui/States";
import { LocalTime } from "@/components/ui/TimeZone";
import { CategoryChips, RoleBadge, StatusBadge } from "@/components/users/UserBadges";
import { RemoveUserDialog } from "@/components/users/RemoveUserDialog";
import { UserDialog } from "@/components/users/UserDialog";

type DialogState = { mode: "create" } | { mode: "edit"; user: ManagedUser } | null;

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent" aria-hidden="true">
      {initials(name)}
    </span>
  );
}

function RowActions({ user, isSelf, onEdit, onRemove }: { user: ManagedUser; isSelf: boolean; onEdit: () => void; onRemove: () => void }) {
  return (
    <div className="flex shrink-0 justify-end gap-2">
      <button type="button" onClick={onEdit} className={cn(buttonSecondary, "min-h-[40px] shrink-0 px-3")} aria-label={`Edit ${user.name}`}>
        <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Edit
      </button>
      {/* Your own account can't be removed (also enforced on the server). */}
      {!isSelf && (
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex min-h-[40px] w-[40px] shrink-0 items-center justify-center rounded-lg border border-[#ecc9cd] bg-surface text-danger transition-colors hover:bg-danger-soft"
          aria-label={`Remove ${user.name}`}
          title="Remove user"
        >
          <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function UsersManager({ initialUsers, categories, currentUserId }: { initialUsers: ManagedUser[]; categories: Category[]; currentUserId: string }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  // The server's list is the source of truth: adopt it whenever the page is re-rendered with fresh data.
  useEffect(() => setUsers(initialUsers), [initialUsers]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"all" | Role>("all");
  const [status, setStatus] = useState<"all" | UserStatus>("all");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [removing, setRemoving] = useState<ManagedUser | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const filtered = useMemo(
    () => users.filter((u) => matchesQuery(query, u.name, u.email) && (role === "all" || u.role === role) && (status === "all" || u.status === status)),
    [users, query, role, status]
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  /**
   * After a successful change the list updates at once from the API response, and `router.refresh()`
   * re-renders this page from the server. The refresh also clears Next.js's client Router Cache,
   * which would otherwise serve the pre-change list when the page is revisited by client-side
   * navigation or browser back/forward.
   */
  function onSaved(saved: ManagedUser, mode: "create" | "edit") {
    setUsers((prev) => (mode === "create" ? [saved, ...prev] : prev.map((u) => (u.id === saved.id ? saved : u))));
    setDialog(null);
    setToast(mode === "create" ? `${saved.name} was added.` : `Changes to ${saved.name} were saved.`);
    router.refresh();
  }

  function onRemoved(removed: ManagedUser) {
    setUsers((prev) => prev.filter((u) => u.id !== removed.id));
    setRemoving(null);
    setToast(`${removed.name} was removed.`);
    router.refresh();
  }

  function clearFilters() {
    setQuery("");
    setRole("all");
    setStatus("all");
  }

  const filtersActive = query.trim() !== "" || role !== "all" || status !== "all";
  const selectClass = cn(selectBase, "w-full sm:w-[170px]");
  const you = <span className="ml-1.5 text-xs font-medium text-muted">(you)</span>;

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage who can sign in. Administrators can access every category; users only see the categories assigned to them."
        actions={
          <button type="button" onClick={() => setDialog({ mode: "create" })} className={cn(buttonPrimary, "w-full sm:w-auto")}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Add user
          </button>
        }
      />

      <div aria-live="polite" className="empty:hidden">
        {toast && (
          <div className={cn(alertSuccess, "mb-5")}>
            <CircleCheck className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            {toast}
          </div>
        )}
      </div>

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
        <SearchField value={query} onChange={setQuery} placeholder="Search by name or email" label="Search users by name or email" className="w-full md:max-w-sm md:flex-1" />
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} aria-label="Filter by role" className={selectClass}>
            <option value="all">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filter by status" className={selectClass}>
            <option value="all">All statuses</option>
            {USER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {USER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-muted md:ml-auto" aria-live="polite" data-testid="user-count">
          {filtersActive ? `${filtered.length} of ${plural(users.length, "user")}` : plural(users.length, "user")}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={filtersActive ? "No users match your filters" : "No users yet"}
          description={filtersActive ? "Try a different name, email, role or status." : "Add the first user to give them access."}
          action={
            filtersActive ? (
              <button type="button" onClick={clearFilters} className={buttonSecondary}>
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className={cn(surface, "hidden overflow-x-auto xl:block")}>
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Users</caption>
              <thead>
                <tr className="border-b border-line-soft bg-surface-subtle text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                  <th scope="col" className="px-5 py-3 font-semibold">
                    User
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Role
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Categories
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="hidden px-4 py-3 font-semibold 2xl:table-cell">
                    Created
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {filtered.map((u) => (
                  <tr key={u.id} className="align-middle transition-colors hover:bg-surface-subtle">
                    <td className="px-5 py-4">
                      <div className="flex min-w-[200px] items-center gap-3">
                        <Avatar name={u.name} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-primary">
                            {u.name}
                            {u.id === currentUserId && you}
                          </p>
                          <p className="truncate text-[13px] text-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="min-w-[160px] max-w-[280px] px-4 py-4">
                      <CategoryChips role={u.role} categoryIds={u.categoryIds} categoriesById={categoriesById} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-4 text-muted 2xl:table-cell">
                      <LocalTime iso={u.createdAt} format="date" />
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <RowActions user={u} isSelf={u.id === currentUserId} onEdit={() => setDialog({ mode: "edit", user: u })} onRemove={() => setRemoving(u)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:hidden">
            {filtered.map((u) => (
              <li key={u.id} className={cn(surface, "p-4")}>
                <div className="flex items-start gap-3">
                  <Avatar name={u.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-primary">
                      {u.name}
                      {u.id === currentUserId && you}
                    </p>
                    <p className="truncate text-[13px] text-muted">{u.email}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <RoleBadge role={u.role} />
                  <StatusBadge status={u.status} />
                  <span className="text-[13px] text-muted">
                    Created <LocalTime iso={u.createdAt} format="date" />
                  </span>
                </div>
                <div className="mt-3 border-t border-line-soft pt-3">
                  <CategoryChips role={u.role} categoryIds={u.categoryIds} categoriesById={categoriesById} max={4} />
                </div>
                <div className="mt-4">
                  <RowActions user={u} isSelf={u.id === currentUserId} onEdit={() => setDialog({ mode: "edit", user: u })} onRemove={() => setRemoving(u)} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {removing && <RemoveUserDialog user={removing} onClose={() => setRemoving(null)} onRemoved={onRemoved} />}
      {dialog && (
        <UserDialog
          key={dialog.mode === "edit" ? dialog.user.id : "create"}
          mode={dialog.mode}
          user={dialog.mode === "edit" ? dialog.user : undefined}
          categories={categories}
          isSelf={dialog.mode === "edit" && dialog.user.id === currentUserId}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
