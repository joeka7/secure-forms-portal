"use client";

import { CircleAlert, LoaderCircle, Trash2, UserX } from "lucide-react";
import { useRef, useState } from "react";
import type { ManagedUser } from "@/lib/types";
import { cn, plural } from "@/lib/utils";
import { alertError, buttonDanger, buttonSecondary } from "@/components/ui/classes";
import { Dialog, DialogBody, DialogFooter } from "@/components/ui/Dialog";

/**
 * Confirmation for permanently removing a user. A user with submissions can't be removed (records
 * keep their author); the dialog explains that and points to disabling instead. The server enforces
 * the same rules.
 */
export function RemoveUserDialog({ user, onClose, onRemoved }: { user: ManagedUser; onClose: () => void; onRemoved: (user: ManagedUser) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = user.submissionCount > 0;

  async function remove() {
    if (removing) return;
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(user.id)}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (res.ok) return onRemoved(user);
      if (res.status === 404) setError("This user no longer exists.");
      else if (res.status === 401) setError("Your session has expired. Please sign in again.");
      else if (res.status === 403) setError("You don't have permission to manage users.");
      else setError(body.message ?? "The user could not be removed. Please try again.");
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    }
    setRemoving(false);
  }

  return (
    <Dialog
      role="alertdialog"
      title={blocked ? "This user can't be removed" : "Remove user?"}
      subtitle={`${user.name} · ${user.email}`}
      onClose={onClose}
      busy={removing}
      initialFocus={cancelRef}
    >
      <DialogBody>
        <div className="flex items-start gap-4">
          <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", blocked ? "bg-warning-soft text-warning" : "bg-danger-soft text-danger")}>
            {blocked ? <UserX className="h-5 w-5" aria-hidden="true" /> : <Trash2 className="h-5 w-5" aria-hidden="true" />}
          </span>
          <div className="min-w-0 space-y-2 text-[15px] leading-relaxed text-muted">
            {blocked ? (
              <p>
                {user.name} has {plural(user.submissionCount, "submission")}, so the account can&apos;t be removed without losing who submitted them. To
                stop them signing in, edit the user and set the status to <span className="font-semibold text-primary">Disabled</span>. Their records
                are kept.
              </p>
            ) : (
              <p>They lose access immediately and are signed out. Their category access and any saved drafts are deleted. This can&apos;t be undone.</p>
            )}
          </div>
        </div>
        {error && (
          <div role="alert" className={cn(alertError, "mt-4")}>
            <CircleAlert className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <button ref={cancelRef} type="button" onClick={onClose} disabled={removing} className={buttonSecondary}>
          {blocked ? "Close" : "Cancel"}
        </button>
        {!blocked && (
          <button type="button" onClick={remove} disabled={removing} className={buttonDanger}>
            {removing ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
            {removing ? "Removing…" : "Remove user"}
          </button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
