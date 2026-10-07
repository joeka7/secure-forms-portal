"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SubmissionData } from "@/lib/forms/types";

export type SavedDraft = { data: SubmissionData; updatedAt: string };

export type DraftStatus =
  | { kind: "none" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "error"; message: string }
  /** A newer draft exists on the server (another tab or device). Autosave pauses until resolved. */
  | { kind: "conflict"; serverDraft: SavedDraft | null };

const AUTOSAVE_DELAY_MS = 2500;

/**
 * Server-side draft lifecycle for a form: restore, autosave (debounced), manual save, discard and
 * optimistic-concurrency conflicts.
 *
 * Every save sends the draft version this page last saw (`baseUpdatedAt`). If the server holds a
 * different version, it answers 409 with its copy and the user chooses: load the saved version, or
 * keep the answers on this page (a forced save without the version check).
 */
export function useServerDraft({
  url,
  initialDraft,
  valuesRef,
  editVersion,
  onLoad,
  paused,
}: {
  /** Draft endpoint; drafts are disabled when undefined. */
  url?: string;
  initialDraft: SavedDraft | null;
  /** Current form values, read at save time. */
  valuesRef: React.MutableRefObject<unknown>;
  /** Incremented by the form on every edit. */
  editVersion: React.MutableRefObject<number>;
  /** Replace the form's values with a draft (or blank values for null). */
  onLoad: (draft: SavedDraft | null) => void;
  /** Suspends autosave (while submitting, or after a successful submission). */
  paused: boolean;
}) {
  const [status, setStatus] = useState<DraftStatus>(initialDraft ? { kind: "saved", at: initialDraft.updatedAt } : { kind: "none" });
  const [restoredAt, setRestoredAt] = useState<string | null>(initialDraft?.updatedAt ?? null);
  const [editTick, setEditTick] = useState(0);
  /** Version of the server draft this page is editing (null: none). */
  const base = useRef<string | null>(initialDraft?.updatedAt ?? null);
  const inFlight = useRef<Promise<boolean> | null>(null);

  const load = useCallback(
    (draft: SavedDraft | null) => {
      base.current = draft?.updatedAt ?? null;
      setRestoredAt(draft?.updatedAt ?? null);
      setStatus(draft ? { kind: "saved", at: draft.updatedAt } : { kind: "none" });
      onLoad(draft);
    },
    [onLoad]
  );

  // The server-rendered draft can be stale when this page comes from the router cache or browser
  // history, so re-read it once on mount (only while nothing has been edited yet).
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { draft?: SavedDraft | null } | null) => {
        if (cancelled || !body || editVersion.current > 0) return;
        const latest = body.draft ?? null;
        if ((latest?.updatedAt ?? null) !== base.current) load(latest);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [url, load, editVersion]);

  /** Called by the form after every edit. */
  const markEdited = useCallback(() => {
    if (!url) return;
    setStatus((s) => (s.kind === "saving" || s.kind === "conflict" ? s : { kind: "dirty" }));
    setEditTick((t) => t + 1);
  }, [url]);

  const save = useCallback(
    async (options: { force?: boolean } = {}): Promise<boolean> => {
      if (!url) return true;
      if (inFlight.current) await inFlight.current;
      const version = editVersion.current;
      setStatus({ kind: "saving" });
      const run = (async () => {
        try {
          const res = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: valuesRef.current, ...(options.force ? {} : { baseUpdatedAt: base.current }) }),
          });
          const body = (await res.json().catch(() => ({}))) as { draft?: SavedDraft | null; message?: string };
          if (res.ok && body.draft) {
            base.current = body.draft.updatedAt;
            setStatus(editVersion.current === version ? { kind: "saved", at: body.draft.updatedAt } : { kind: "dirty" });
            return true;
          }
          if (res.status === 409) setStatus({ kind: "conflict", serverDraft: body.draft ?? null });
          else if (res.status === 401) setStatus({ kind: "error", message: "Session expired. Sign in again to keep saving." });
          else setStatus({ kind: "error", message: body.message ?? "Draft not saved." });
        } catch {
          setStatus({ kind: "error", message: "Offline: draft not saved." });
        }
        return false;
      })();
      inFlight.current = run;
      try {
        return await run;
      } finally {
        if (inFlight.current === run) inFlight.current = null;
      }
    },
    [url, valuesRef, editVersion]
  );

  // Debounced autosave: every edit restarts the timer.
  useEffect(() => {
    if (!url || paused || status.kind !== "dirty") return;
    const timer = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [url, paused, status, editTick, save]);

  /** Wait for a save in flight, so it cannot re-create a draft that is about to be removed. */
  const settle = useCallback(async () => {
    if (inFlight.current) await inFlight.current;
  }, []);

  const discard = useCallback(async () => {
    if (!url) return true;
    await settle();
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setStatus({ kind: "error", message: "The saved draft could not be discarded. Please try again." });
      return false;
    }
    load(null);
    return true;
  }, [url, settle, load]);

  const resolveConflict = useCallback(
    async (choice: "load" | "keep") => {
      if (status.kind !== "conflict") return;
      if (choice === "load") load(status.serverDraft);
      else await save({ force: true });
    },
    [status, load, save]
  );

  /** After a successful submission the server removed the draft. */
  const clear = useCallback(() => {
    base.current = null;
    setRestoredAt(null);
    setStatus({ kind: "none" });
  }, []);

  const hasUnsaved = !!url && (status.kind === "dirty" || status.kind === "saving" || status.kind === "error" || status.kind === "conflict");

  return { enabled: !!url, status, restoredAt, hasUnsaved, markEdited, save, settle, discard, resolveConflict, clear };
}
