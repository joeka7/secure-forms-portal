import { listAccessibleCategories } from "@/lib/server/catalog";
import { guardApi, jsonResponse } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Categories the caller may access (never the full catalog for non-administrators). */
export async function GET(req: Request) {
  const auth = guardApi(req);
  if (auth.response) return auth.response;
  return jsonResponse({ categories: listAccessibleCategories(auth.user) });
}
