import { errorResponse, isSameOriginRequest, jsonResponse } from "@/lib/server/http";
import { endCurrentSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Revokes the server-side session (not just the cookie). */
export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return errorResponse(403, "csrf", "Cross-site request rejected.");
  endCurrentSession();
  return jsonResponse({ ok: true });
}
