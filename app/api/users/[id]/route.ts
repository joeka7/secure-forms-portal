import { errorResponse, guardApi, jsonResponse, notFound, readJsonBody } from "@/lib/server/http";
import { currentSessionToken } from "@/lib/server/session";
import { deleteUser, listUsers, updateUser } from "@/lib/server/users";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function GET(req: Request, { params }: Params) {
  const auth = guardApi(req, { administrator: true });
  if (auth.response) return auth.response;
  const user = listUsers(auth.user).find((u) => u.id === params.id);
  return user ? jsonResponse({ user }) : notFound();
}

/** Update details, role, status, category access or password (see `updateUser` for the safeguards). */
export async function PATCH(req: Request, { params }: Params) {
  const auth = guardApi(req, { administrator: true, mutation: true });
  if (auth.response) return auth.response;
  const parsed = await readJsonBody(req);
  if (!parsed.ok) return parsed.response;

  const result = await updateUser(auth.user, params.id, parsed.body, { currentSessionToken: currentSessionToken() });
  if (result.kind === "not_found") return notFound();
  if (result.kind === "invalid") {
    return errorResponse(422, "validation_failed", result.message ?? "Please correct the highlighted fields.", { fieldErrors: result.errors });
  }
  return jsonResponse({ user: result.user });
}

/** Permanently remove a user (see `deleteUser` for the safeguards). */
export async function DELETE(req: Request, { params }: Params) {
  const auth = guardApi(req, { administrator: true, mutation: true });
  if (auth.response) return auth.response;
  const result = deleteUser(auth.user, params.id);
  if (result.kind === "not_found") return notFound();
  if (result.kind === "blocked") return errorResponse(409, "user_not_removable", result.message);
  return jsonResponse({ ok: true });
}
