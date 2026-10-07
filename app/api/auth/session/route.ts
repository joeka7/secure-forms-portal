import { jsonResponse, unauthorized } from "@/lib/server/http";
import { getSessionUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** The signed-in user, re-read from the database. */
export async function GET() {
  const user = getSessionUser();
  if (!user) return unauthorized();
  return jsonResponse({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
