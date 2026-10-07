import { forbidden, guardApi, jsonResponse, notFound } from "@/lib/server/http";
import { getSubmissionForAdmin } from "@/lib/server/submissions";

export const dynamic = "force-dynamic";

/** Administrator-only: one submission with its answers and the form version it was submitted against. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = guardApi(req, { administrator: true });
  if (auth.response) return auth.response;
  const result = getSubmissionForAdmin(auth.user, params.id);
  if (result.kind === "denied") return forbidden();
  if (result.kind === "not_found") return notFound();
  return jsonResponse({ submission: result.submission });
}
