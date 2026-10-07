import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { canViewSubmissions } from "@/lib/authz";
import type { SubmissionData } from "@/lib/forms/types";
import { schemaFields } from "@/lib/forms/validation";
import { requirePageUser } from "@/lib/server/guards";
import { getSessionUser } from "@/lib/server/session";
import { getSubmissionForAdmin } from "@/lib/server/submissions";
import { submissionReference } from "@/lib/time";
import { cn } from "@/lib/utils";
import { FormReadOnlyView } from "@/components/forms/FormReadOnlyView";
import { buttonSecondary, surface } from "@/components/ui/classes";
import { PageHeader } from "@/components/ui/PageHeader";
import { AccessDenied } from "@/components/ui/States";
import { LocalTime } from "@/components/ui/TimeZone";

type Props = { params: { id: string } };

const DENIED = "You don't have permission to access submissions.";

export function generateMetadata({ params }: Props): Metadata {
  const user = getSessionUser();
  // Only administrators get the form name in the title.
  const result = user && canViewSubmissions(user) ? getSubmissionForAdmin(user, params.id) : null;
  return { title: result?.kind === "ok" ? `Submission: ${result.submission.form.name}` : "Submissions" };
}

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : JSON.stringify(value);
}

/**
 * View submission (administrators only): who submitted which form and when, then every answer,
 * rendered with the exact form version that was submitted.
 */
export default function SubmissionPage({ params }: Props) {
  const user = requirePageUser(`/submissions/${params.id}`);
  // The role is checked before the id is looked up, so other users learn nothing about it.
  if (!canViewSubmissions(user)) return <AccessDenied message={DENIED} />;

  const result = getSubmissionForAdmin(user, params.id);
  if (result.kind === "denied") return <AccessDenied message={DENIED} />;
  if (result.kind === "not_found") notFound();

  const { submission } = result;
  const known = new Set(schemaFields(submission.schema).map((f) => f.name));
  // Defensive: values stored for fields the schema version doesn't define are still shown.
  const otherAnswers = Object.entries(submission.data).filter(([key]) => !known.has(key));

  const facts = [
    {
      label: "Person",
      value: (
        <>
          <span className="block font-semibold">{submission.person.name}</span>
          <span className="block break-all text-[13px] text-muted">{submission.person.email}</span>
        </>
      ),
    },
    { label: "Form", value: submission.form.name },
    { label: "Category", value: submission.category.name },
    { label: "Submitted", value: <LocalTime iso={submission.submittedAt} withOffset /> },
    { label: "Reference", value: <span className="font-mono text-[13px]">{submissionReference(submission.id)}</span> },
    { label: "Form version", value: `Version ${submission.formVersion}${submission.isLatestVersion ? " (current)" : ""}` },
  ];

  return (
    <div className={cn("mx-auto", submission.schema.navigation ? "max-w-none" : "max-w-[860px]")}>
      <PageHeader
        breadcrumbs={[{ label: "Submissions", href: "/submissions" }, { label: submission.form.name }]}
        eyebrow={<span className="text-xs font-semibold uppercase tracking-[0.1em] text-accent">Submission</span>}
        title={submission.form.name}
        actions={
          <Link href="/submissions" className={cn(buttonSecondary, "w-full sm:w-auto")}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to submissions
          </Link>
        }
      />

      <section aria-labelledby="submission-details" className={cn(surface, "mb-6 px-5 py-5 sm:px-8")}>
        <h2 id="submission-details" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          Submission details
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{fact.label}</dt>
              <dd className="mt-1 break-words text-[15px] text-primary">{fact.value}</dd>
            </div>
          ))}
        </dl>
        {!submission.isLatestVersion && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-line bg-surface-subtle px-3.5 py-2.5 text-[13px] text-ink-soft">
            <History className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            The form has changed since this was submitted. Answers are shown with the questions as they were at the time.
          </p>
        )}
      </section>

      <h2 className="mb-4 text-xl font-semibold tracking-tight text-primary">Submitted answers</h2>
      <FormReadOnlyView schema={submission.schema} mode="review" data={submission.data as SubmissionData} />

      {otherAnswers.length > 0 && (
        <section aria-labelledby="other-answers" className={cn(surface, "mt-6 px-5 py-6 sm:px-8")}>
          <h2 id="other-answers" className="text-lg font-semibold tracking-tight text-primary">
            Other recorded answers
          </h2>
          <p className="mt-1 text-sm text-muted">Values stored for fields this form version doesn&apos;t define.</p>
          <dl className="mt-4 space-y-3">
            {otherAnswers.map(([key, value]) => (
              <div key={key}>
                <dt className="font-mono text-[12px] text-muted">{key}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap break-words text-[15px] text-primary">{display(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
