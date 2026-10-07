import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { canViewSubmissions } from "@/lib/authz";
import { requirePageUser } from "@/lib/server/guards";
import { displayTimeZone } from "@/lib/server/settings";
import { listSubmissionsForAdmin } from "@/lib/server/submissions";
import { filtersToQuery, parseSubmissionFilters } from "@/lib/submissions/filters";
import { describeTimeZone } from "@/lib/time";
import { AccessDenied } from "@/components/ui/States";
import { SubmissionsTable } from "@/components/submissions/SubmissionsTable";

export const metadata: Metadata = { title: "Submissions" };

const DENIED = "You don't have permission to access submissions.";

type Props = { searchParams: Record<string, string | string[] | undefined> };

/** Administrator-only list of stored submissions; filters come from the URL and run in the database query. */
export default function SubmissionsPage({ searchParams }: Props) {
  const filters = parseSubmissionFilters((key) => searchParams[key]);
  const user = requirePageUser(`/submissions${filtersToQuery(filters)}`);
  // The role is checked before any filter is resolved, so other users learn nothing from them.
  if (!canViewSubmissions(user)) return <AccessDenied message={DENIED} />;

  const timeZone = displayTimeZone();
  const result = listSubmissionsForAdmin(user, filters, timeZone);
  if (result.kind === "denied") return <AccessDenied message={DENIED} />;
  if (result.kind === "not_found") notFound();
  return (
    <SubmissionsTable
      submissions={result.submissions}
      total={result.total}
      filters={result.filters}
      options={result.options}
      timeZoneLabel={describeTimeZone(timeZone)}
    />
  );
}
