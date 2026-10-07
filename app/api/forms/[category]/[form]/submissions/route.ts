import { asRecord, errorResponse, forbidden, guardApi, jsonResponse, notFound, readJsonBody, serverError } from "@/lib/server/http";
import { submitForm } from "@/lib/server/submissions";

export const dynamic = "force-dynamic";

/**
 * Submit a form. Body: { data: {...answers} }. Only `data` is read: identity, role, category and
 * timestamp always come from the server.
 */
export async function POST(req: Request, { params }: { params: { category: string; form: string } }) {
  const auth = guardApi(req, { mutation: true });
  if (auth.response) return auth.response;
  const parsed = await readJsonBody(req);
  if (!parsed.ok) return parsed.response;

  try {
    const result = submitForm(auth.user, params.category, params.form, asRecord(parsed.body).data);
    if (result.kind === "denied") return forbidden("You don't have permission to submit this form.");
    if (result.kind === "not_found") return notFound();
    if (result.kind === "invalid") return errorResponse(422, "validation_failed", "Please correct the highlighted fields.", { fieldErrors: result.errors });
    return jsonResponse({ ok: true, id: result.id, submittedAt: result.submittedAt }, 201);
  } catch (error) {
    return serverError("Submission failed", error, "Your submission could not be saved. Please try again.");
  }
}
