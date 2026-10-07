"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleAlert, CircleCheck, CloudOff, LoaderCircle, Printer, RotateCcw, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LOGIN_PATH } from "@/lib/config";
import { sectionProgress } from "@/lib/forms/progress";
import type { FieldValue, FormField, FormSchema, FormSection, SubmissionData, ValidationErrors } from "@/lib/forms/types";
import { emptyValue, isFieldRequired, schemaFields, validateSubmission } from "@/lib/forms/validation";
import { formatDateTime, formatTime, submissionReference } from "@/lib/time";
import { cn } from "@/lib/utils";
import { alertError, buttonGhost, buttonPrimary, buttonSecondary, surface } from "@/components/ui/classes";
import { LocalTime, useTimeZone } from "@/components/ui/TimeZone";
import { FormSectionView, SectionJumpList, SectionNavLinks, navigableSections, useActiveSection } from "@/components/forms/renderer/FormSection";
import { ScalarField } from "@/components/forms/renderer/inputs";
import { RepeaterInput, TableInput, type FieldUpdater } from "@/components/forms/renderer/TableInput";
import { useServerDraft, type DraftStatus, type SavedDraft } from "@/components/forms/useServerDraft";

type Values = Record<string, FieldValue>;
type Errors = Record<string, string>;

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; id: string; submittedAt: string }
  | { kind: "error"; message: string; action?: "login" };

const NO_ERRORS: Errors = {};
const MAX_LISTED_ERRORS = 8;

function initialValues(schema: FormSchema, draft?: SubmissionData | null): Values {
  return Object.fromEntries(
    schemaFields(schema).map((field) => {
      const empty = emptyValue(field);
      const saved = draft?.[field.name];
      if (saved === undefined || saved === null) return [field.name, empty];
      if (field.type === "repeater" && Array.isArray(saved) && Array.isArray(empty)) {
        // Keep the register's initial blank rows below the saved entries.
        return [field.name, saved.length >= empty.length ? saved : [...saved, ...empty.slice(saved.length)]];
      }
      return [field.name, saved];
    })
  );
}

const topLevelName = (key: string) => key.split(".")[0];

function focusErrorTarget(root: HTMLElement | null, key: string) {
  const el = root?.querySelector<HTMLElement>(`[data-field="${CSS.escape(key)}"]`) ?? root?.querySelector<HTMLElement>(`[data-field="${CSS.escape(topLevelName(key))}"]`);
  el?.focus();
  el?.scrollIntoView({ block: "center", behavior: "smooth" });
}

/**
 * Warns before leaving with unsaved edits: the browser prompt on reload/close, and for in-app links
 * a draft save first (long forms) or a confirmation (short forms).
 */
function useLeaveGuard(hasUnsaved: () => boolean, saveFirst?: () => Promise<boolean>) {
  const router = useRouter();
  const hasUnsavedRef = useRef(hasUnsaved);
  hasUnsavedRef.current = hasUnsaved;
  const saveRef = useRef(saveFirst);
  saveRef.current = saveFirst;

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedRef.current()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = async (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.hash) return; // section links
      if (!hasUnsavedRef.current()) return;
      e.preventDefault();
      e.stopPropagation();
      const saved = saveRef.current ? await saveRef.current() : false;
      if (saved || window.confirm("You have unsaved changes on this form. Leave without saving them?")) {
        router.push(url.pathname + url.search + url.hash);
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [router]);
}

function DraftIndicator({ status }: { status: DraftStatus }) {
  const timeZone = useTimeZone();
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-[13px]", status.kind === "error" ? "text-danger" : "text-muted")}
      role="status"
      data-testid="draft-status"
    >
      {status.kind === "saving" && (
        <>
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Saving draft…
        </>
      )}
      {status.kind === "saved" && (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" /> Draft saved {formatTime(status.at, timeZone)}
        </>
      )}
      {status.kind === "dirty" && <>Unsaved changes</>}
      {status.kind === "error" && (
        <>
          <CloudOff className="h-3.5 w-3.5" aria-hidden="true" /> {status.message}
        </>
      )}
      {status.kind === "none" && <>Drafts save automatically</>}
      {status.kind === "conflict" && <>Newer draft found: not saved</>}
    </span>
  );
}

/**
 * Renders any form from its schema. The browser runs the same `validateSubmission` as the server
 * for instant feedback, but the server stays the authority for validation and permissions.
 */
export function FormRenderer({
  schema,
  submitUrl,
  draftUrl,
  initialDraft = null,
  backHref,
  backLabel,
}: {
  schema: FormSchema;
  submitUrl: string;
  /** Enables server-side drafts (long forms). */
  draftUrl?: string;
  initialDraft?: SavedDraft | null;
  backHref: string;
  backLabel: string;
}) {
  const timeZone = useTimeZone();
  const [values, setValues] = useState<Values>(() => initialValues(schema, initialDraft?.data));
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const editVersion = useRef(0);
  const skipNextEdit = useRef(true);

  const submitting = status.kind === "submitting";
  const longForm = !!schema.navigation;

  const onLoadDraft = useCallback(
    (saved: SavedDraft | null) => {
      skipNextEdit.current = true;
      editVersion.current = 0;
      setValues(initialValues(schema, saved?.data));
      setErrors({});
    },
    [schema]
  );

  const draft = useServerDraft({
    url: draftUrl,
    initialDraft,
    valuesRef,
    editVersion,
    onLoad: onLoadDraft,
    paused: submitting || status.kind === "success",
  });
  const { markEdited } = draft;

  const onFieldChange = useCallback<FieldUpdater>((name, next) => {
    editVersion.current += 1;
    setValues((prev) => ({ ...prev, [name]: typeof next === "function" ? next(prev[name]) : next }));
  }, []);
  const onScalarChange = useCallback((name: string, value: FieldValue) => onFieldChange(name, value), [onFieldChange]);

  // After an edit: mark the draft as changed, and drop error messages as they are fixed (new errors
  // only appear on submit, so the form doesn't shout while someone is typing).
  useEffect(() => {
    if (skipNextEdit.current) {
      skipNextEdit.current = false;
      return;
    }
    markEdited();
    setErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const result = validateSubmission(schema, values);
      const still = result.ok ? {} : result.errors;
      const next: Errors = {};
      for (const key of Object.keys(prev)) if (still[key]) next[key] = still[key];
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [values, schema, markEdited]);

  useLeaveGuard(
    () => status.kind !== "success" && (draft.enabled ? draft.hasUnsaved : editVersion.current > 0),
    draft.enabled ? () => draft.save() : undefined
  );

  const errorsByField = useMemo(() => {
    const map = new Map<string, Errors>();
    for (const [key, message] of Object.entries(errors)) {
      const name = topLevelName(key);
      map.set(name, { ...map.get(name), [key]: message });
    }
    return map;
  }, [errors]);

  function showError(message: string, action?: "login") {
    setStatus({ kind: "error", message, action });
    requestAnimationFrame(() => {
      alertRef.current?.focus();
      alertRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const result = validateSubmission(schema, values);
    if (!result.ok) {
      const count = Object.keys(result.errors).length;
      setErrors(result.errors);
      showError(`${count} ${count === 1 ? "item needs" : "items need"} attention before this form can be submitted.`);
      return;
    }
    setErrors({});
    setStatus({ kind: "submitting" });
    // A draft save still in flight must not re-create the draft after the submission removes it.
    await draft.settle();

    try {
      const res = await fetch(submitUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: result.data }) });
      const body = (await res.json().catch(() => ({}))) as { id?: string; submittedAt?: string; message?: string; fieldErrors?: ValidationErrors };
      if (res.ok && body.id) {
        draft.clear();
        setStatus({ kind: "success", id: body.id, submittedAt: body.submittedAt ?? new Date().toISOString() });
        window.scrollTo({ top: 0, behavior: "smooth" });
        requestAnimationFrame(() => successHeadingRef.current?.focus());
        return;
      }
      if (res.status === 422 && body.fieldErrors) {
        setErrors(body.fieldErrors);
        showError(body.message ?? "Please correct the highlighted fields.");
      } else if (res.status === 401) showError("Your session has expired. Sign in again to submit this form.", "login");
      else if (res.status === 403) showError("You don't have permission to submit this form.");
      else if (res.status === 413) showError("This submission is too large. Shorten the longest answers and try again.");
      else showError(body.message ?? "Your submission could not be saved. Please try again.");
    } catch {
      showError("We couldn't reach the server. Check your connection and try again.");
    }
  }

  function startAgain() {
    onLoadDraft(null);
    setStatus({ kind: "idle" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function discardDraft() {
    if (!window.confirm("Discard your saved draft and clear every answer on this form?")) return;
    if (await draft.discard()) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const progress = useMemo(() => schema.sections.map((section) => sectionProgress(section, values)), [schema.sections, values]);
  const totals = progress.reduce((acc, p) => ({ done: acc.done + p.done, total: acc.total + p.total }), { done: 0, total: 0 });
  const navSections = navigableSections(schema.sections, longForm);
  const activeSection = useActiveSection(schema.sections, longForm, status.kind);

  if (status.kind === "success") {
    return (
      <div className={cn(surface, "flex flex-col items-center px-6 py-14 text-center sm:px-10")}>
        <span className="grid h-12 w-12 place-items-center rounded-full bg-success-soft text-success">
          <CircleCheck className="h-6 w-6" aria-hidden="true" strokeWidth={1.9} />
        </span>
        <h2 ref={successHeadingRef} tabIndex={-1} className="mt-5 text-2xl font-semibold tracking-tight text-primary outline-none">
          Submission received
        </h2>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted">
          Your form was submitted on <LocalTime iso={status.submittedAt} withOffset />.
        </p>
        <p className="mt-4 rounded-lg border border-line bg-surface-hover px-3 py-1.5 font-mono text-xs text-ink-nav" data-testid="submission-reference">
          Reference: {submissionReference(status.id)}
        </p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <button type="button" onClick={startAgain} className={buttonPrimary}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Submit another response
          </button>
          <Link href={backHref} className={buttonSecondary}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  const errorKeys = Object.keys(errors);
  const errorCount = errorKeys.length;

  const renderField = (field: FormField) => {
    const fieldErrors = errorsByField.get(field.name) ?? NO_ERRORS;
    if (field.type === "table") {
      return <TableInput field={field} value={values[field.name]} errors={fieldErrors} disabled={submitting} onChange={onFieldChange} />;
    }
    const required = isFieldRequired(field, values);
    if (field.type === "repeater") {
      return <RepeaterInput field={field} value={values[field.name]} errors={fieldErrors} required={required} disabled={submitting} onChange={onFieldChange} />;
    }
    return (
      <ScalarField
        field={required === !!field.required ? field : { ...field, required }}
        id={`field-${field.name}`}
        value={values[field.name]}
        error={fieldErrors[field.name]}
        disabled={submitting}
        onChange={onScalarChange}
      />
    );
  };

  const alert = status.kind === "error" && (
    <div
      ref={alertRef}
      tabIndex={-1}
      role="alert"
      className={cn(alertError, "outline-none", longForm ? "mb-6 rounded-xl px-5 py-4" : "rounded-none border-x-0 border-t-0 px-5 py-4 sm:px-8")}
    >
      <CircleAlert className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p>
          {status.message}{" "}
          {status.action === "login" && (
            <a href={`${LOGIN_PATH}?next=${encodeURIComponent(window.location.pathname)}`} className="font-semibold underline underline-offset-2">
              Sign in
            </a>
          )}
        </p>
        {errorCount > 0 && (
          <ul className="mt-2 space-y-1">
            {errorKeys.slice(0, MAX_LISTED_ERRORS).map((key) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => focusErrorTarget(formRef.current, key)}
                  className="text-left font-medium underline decoration-[#e5b3b8] underline-offset-2 hover:decoration-danger-strong"
                >
                  {errors[key]}
                </button>
              </li>
            ))}
            {errorCount > MAX_LISTED_ERRORS && <li className="text-[13px]">…and {errorCount - MAX_LISTED_ERRORS} more.</li>}
          </ul>
        )}
      </div>
    </div>
  );

  const renderSection = (section: FormSection, index: number) => (
    <FormSectionView key={index} section={section} longForm={longForm} progress={progress[index]} renderField={renderField} />
  );

  const submitButton = (className: string) => (
    <button type="submit" disabled={submitting} className={cn(buttonPrimary, className)}>
      {submitting && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {submitting ? "Submitting…" : schema.submitLabel ?? "Submit form"}
    </button>
  );

  if (!longForm) {
    return (
      <form ref={formRef} onSubmit={onSubmit} noValidate className={cn(surface, "overflow-hidden")} aria-busy={submitting}>
        {alert}
        <div className="divide-y divide-line-soft">{schema.sections.map(renderSection)}</div>
        <div className="flex flex-col-reverse gap-3 border-t border-line-soft bg-surface-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className={cn("text-[13px]", errorCount ? "font-medium text-danger" : "text-muted")} aria-live="polite">
            {errorCount ? `${errorCount} ${errorCount === 1 ? "field needs" : "fields need"} attention.` : "Fields marked * are required."}
          </p>
          {submitButton("w-full sm:w-auto sm:min-w-[160px]")}
        </div>
      </form>
    );
  }

  const percent = totals.total ? Math.round((totals.done / totals.total) * 100) : 100;
  const progressBar = (
    <div
      className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-soft"
      role="progressbar"
      aria-label="Required items complete"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div className="h-full rounded-full bg-accent transition-[width] motion-reduce:transition-none" style={{ width: `${percent}%` }} />
    </div>
  );

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_248px] xl:gap-8">
      <form ref={formRef} onSubmit={onSubmit} noValidate aria-busy={submitting} className="min-w-0">
        {draft.restoredAt && (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-accent/15 bg-accent-tint px-5 py-3.5 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between print:hidden">
            <p>Your saved draft from {formatDateTime(draft.restoredAt, timeZone)} has been restored.</p>
            <button type="button" onClick={discardDraft} className={cn(buttonGhost, "min-h-[36px] px-3 text-[13px] text-danger-strong")}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Discard draft and start over
            </button>
          </div>
        )}
        {draft.status.kind === "conflict" && (
          <div role="alert" className="mb-6 rounded-xl border border-warning-border bg-warning-soft px-5 py-4 text-sm text-[#5c4410] print:hidden">
            <p className="font-semibold">This form was saved more recently in another tab or on another device.</p>
            <p className="mt-1">
              {draft.status.serverDraft
                ? `The saved version is from ${formatDateTime(draft.status.serverDraft.updatedAt, timeZone)}.`
                : "The saved draft was discarded or submitted elsewhere."}{" "}
              Autosave is paused until you choose which version to keep.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void draft.resolveConflict("load")} className={cn(buttonSecondary, "min-h-[36px] px-3 text-[13px]")}>
                Load the saved version
              </button>
              <button type="button" onClick={() => void draft.resolveConflict("keep")} className={cn(buttonGhost, "min-h-[36px] px-3 text-[13px]")}>
                Keep the answers on this page
              </button>
            </div>
          </div>
        )}
        {alert}

        <div className={cn(surface, "mb-6 px-5 py-4 xl:hidden print:hidden")}>
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="font-semibold text-primary">Required items</span>
            <span className="text-muted">
              {totals.done} of {totals.total}
            </span>
          </div>
          {progressBar}
          <div className="mt-3">
            <SectionJumpList items={navSections} progress={progress} />
          </div>
        </div>

        <div className="space-y-6">{schema.sections.map(renderSection)}</div>

        <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-5 print:hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className={cn("text-[13px] font-medium", errorCount ? "text-danger" : "text-primary")} aria-live="polite">
                {errorCount
                  ? `${errorCount} ${errorCount === 1 ? "item needs" : "items need"} attention`
                  : `${totals.done} of ${totals.total} required items complete`}
              </span>
              {draft.enabled && <DraftIndicator status={draft.status} />}
            </div>
            <div className="flex flex-wrap gap-2 sm:flex-nowrap">
              <button type="button" onClick={() => window.print()} className={cn(buttonGhost, "hidden min-h-[40px] px-3 sm:inline-flex")}>
                <Printer className="h-4 w-4" aria-hidden="true" />
                Print
              </button>
              {draft.enabled && (
                <button
                  type="button"
                  onClick={() => void draft.save()}
                  disabled={submitting || draft.status.kind === "saving"}
                  className={cn(buttonSecondary, "min-h-[40px] flex-1 whitespace-nowrap px-3.5 sm:flex-none")}
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save draft
                </button>
              )}
              {submitButton("min-h-[40px] flex-1 whitespace-nowrap sm:min-w-[170px] sm:flex-none")}
            </div>
          </div>
        </div>
      </form>

      <aside className="hidden xl:block print:hidden" aria-label="Form sections">
        <div className="sticky top-8">
          <div className={cn(surface, "p-4")}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Progress</p>
            <p className="mt-1 text-sm font-semibold text-primary">
              {totals.done} of {totals.total} required
            </p>
            {progressBar}
            <nav className="mt-4" aria-label="Sections">
              <SectionNavLinks items={navSections} active={activeSection} progress={progress} />
            </nav>
          </div>
        </div>
      </aside>
    </div>
  );
}
