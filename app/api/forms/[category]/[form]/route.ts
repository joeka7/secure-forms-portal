import { getFormForUser } from "@/lib/server/catalog";
import { forbidden, guardApi, jsonResponse, notFound } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** One form with its current schema. */
export async function GET(req: Request, { params }: { params: { category: string; form: string } }) {
  const auth = guardApi(req);
  if (auth.response) return auth.response;
  const result = getFormForUser(auth.user, params.category, params.form);
  if (result.kind === "denied") return forbidden("You don't have permission to access this category.");
  if (result.kind === "not_found") return notFound();
  return jsonResponse({ category: result.category, form: result.form });
}
