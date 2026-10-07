import { getCategoryForUser } from "@/lib/server/catalog";
import { forbidden, guardApi, jsonResponse, notFound } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { category: string } }) {
  const auth = guardApi(req);
  if (auth.response) return auth.response;
  const result = getCategoryForUser(auth.user, params.category);
  if (result.kind === "denied") return forbidden("You don't have permission to access this category.");
  if (result.kind === "not_found") return notFound();
  return jsonResponse({ category: result.category, forms: result.forms });
}
