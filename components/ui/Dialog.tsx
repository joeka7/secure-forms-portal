"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal: labelled by its title, traps focus, closes on Escape or backdrop click (unless
 * `busy`), locks page scroll and restores focus to the opener. A bottom sheet on phones and a
 * centred 16px-radius panel from the `sm` breakpoint.
 */
export function Dialog({
  title,
  subtitle,
  onClose,
  busy = false,
  role = "dialog",
  size = "md",
  initialFocus,
  showClose = true,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  /** While true, the dialog cannot be dismissed (e.g. a save is in flight). */
  busy?: boolean;
  role?: "dialog" | "alertdialog";
  size?: "md" | "lg";
  /** Element to focus when the dialog opens (default: the first focusable element). */
  initialFocus?: React.RefObject<HTMLElement>;
  showClose?: boolean;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subtitleId = useId();
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (initialFocus?.current ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
    // Runs once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (!busyRef.current) onCloseRef.current();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 animate-fade-in bg-dark/45 motion-reduce:animate-none" aria-hidden="true" onClick={() => !busy && onClose()} />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        className={cn(
          "relative flex max-h-[100dvh] w-full animate-sheet-in flex-col overflow-hidden rounded-t-2xl bg-surface shadow-dialog motion-reduce:animate-none sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl",
          size === "lg" ? "sm:max-w-[600px]" : "sm:max-w-[480px]"
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-4 sm:px-7 sm:py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-semibold tracking-tight text-primary">
              {title}
            </h2>
            {subtitle && (
              <p id={subtitleId} className="mt-0.5 break-words text-sm text-muted">
                {subtitle}
              </p>
            )}
          </div>
          {showClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="-mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-accent-soft hover:text-primary disabled:opacity-50"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Scrollable body of a dialog. */
export function DialogBody({ children, className, bodyRef }: { children: React.ReactNode; className?: string; bodyRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={bodyRef} className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7", className)}>
      {children}
    </div>
  );
}

/** Action bar of a dialog: stacked on phones, right-aligned from `sm`. */
export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col-reverse gap-3 border-t border-line-soft bg-surface-subtle px-5 py-4 sm:flex-row sm:justify-end sm:px-7">{children}</div>;
}
