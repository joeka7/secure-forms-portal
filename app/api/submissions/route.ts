import { forbidden, guardApi, jsonResponse, notFound } from "@/lib/server/http";
import { displayTimeZone } from "@/lib/server/settings";
import { listSubmissionsForAdmin } from "@/lib/server/submissions";
import { parseSubmissionFilters } from "@/lib/submissions/filters";

export const dynamic = "force-dynamic";

/**
 * Administrator-only: stored submissions, newest first, without answers. Optional filters (AND):
 * `person` (user id), `category` (slug), `form` (form id), `from` / `to` (YYYY-MM-DD, whole days in
 * the display time zone). Malformed values are ignored; unknown people, categories or forms give 404.
 */
export async function GET(req: Request) {
  const auth = guardApi(req, { administrator: true });
  if (auth.response) return auth.response;
  const params = new URL(req.url).searchParams;
  const result = listSubmissionsForAdmin(auth.user, parseSubmissionFilters((key) => params.get(key)), displayTimeZone());
  if (result.kind === "denied") return forbidden();
  if (result.kind === "not_found") return notFound();
  return jsonResponse({ submissions: result.submissions, total: result.total, filters: result.filters });
}
