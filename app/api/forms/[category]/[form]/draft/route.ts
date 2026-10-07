import { deleteDraft, getDraft, saveDraft, type DraftResult } from "@/lib/server/drafts";
import { asRecord, errorResponse, forbidden, guardApi, jsonResponse, notFound, readJsonBody, serverError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

type Params = { params: { category: string; form: string } };

function respond(result: DraftResult) {
  if (result.kind === "denied") return forbidden("You don't have permission to access this form.");
  if (result.kind === "not_found") return notFound();
  if (result.kind === "conflict") return errorResponse(409, "draft_conflict", "This form was changed in another tab or on another device.", { draft: result.draft });
  return jsonResponse({ draft: result.draft });
}

/** The caller's saved draft of this form, or null. */
export async function GET(req: Request, { params }: Params) {
  const auth = guardApi(req);
  if (auth.response) return auth.response;
  return respond(getDraft(auth.user, params.category, params.form));
}

/**
 * Save the caller's draft. Body: { data: {...}, baseUpdatedAt: string | null }. `data` may hold any
 * subset of the form's fields. `baseUpdatedAt` is the draft version the client edited (409 when it
 * is stale); omitting it overwrites unconditionally.
 */
export async function PUT(req: Request, { params }: Params) {
  const auth = guardApi(req, { mutation: true });
  if (auth.response) return auth.response;
  const parsed = await readJsonBody(req);
  if (!parsed.ok) return parsed.response;
  const body = asRecord(parsed.body);
  const base = typeof body.baseUpdatedAt === "string" || body.baseUpdatedAt === null ? body.baseUpdatedAt : undefined;
  try {
    return respond(saveDraft(auth.user, params.category, params.form, body.data, base));
  } catch (error) {
    return serverError("Draft save failed", error, "Your draft could not be saved. Please try again.");
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = guardApi(req, { mutation: true });
  if (auth.response) return auth.response;
  return respond(deleteDraft(auth.user, params.category, params.form));
}
