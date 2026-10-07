import { errorResponse, guardApi, jsonResponse, readJsonBody } from "@/lib/server/http";
import { createUser, listUsers } from "@/lib/server/users";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = guardApi(req, { administrator: true });
  if (auth.response) return auth.response;
  return jsonResponse({ users: listUsers(auth.user) });
}

/** Create a user. The password arrives once, over this request, and is only ever stored as a scrypt hash. */
export async function POST(req: Request) {
  const auth = guardApi(req, { administrator: true, mutation: true });
  if (auth.response) return auth.response;
  const parsed = await readJsonBody(req);
  if (!parsed.ok) return parsed.response;

  const result = await createUser(auth.user, parsed.body);
  if (result.kind === "invalid") {
    return errorResponse(422, "validation_failed", result.message ?? "Please correct the highlighted fields.", { fieldErrors: result.errors });
  }
  if (result.kind !== "ok") return errorResponse(400, "invalid_request", "The user could not be created.");
  return jsonResponse({ user: result.user }, 201);
}
