import { redirect } from "next/navigation";
import { canManageUsers, canViewSubmissions } from "@/lib/authz";
import { LOGIN_PATH } from "@/lib/config";
import { getSessionUser } from "@/lib/server/session";
import { displayTimeZone } from "@/lib/server/settings";
import { PortalShell } from "@/components/shell/PortalShell";

/**
 * Authenticated layout for /forms, /submissions and /users. Each page also performs its own session
 * and permission checks, because a layout is not re-rendered on every client-side navigation.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const user = getSessionUser();
  if (!user) redirect(LOGIN_PATH);
  return (
    <PortalShell
      user={{ name: user.name, email: user.email, role: user.role }}
      canManageUsers={canManageUsers(user)}
      canViewSubmissions={canViewSubmissions(user)}
      timeZone={displayTimeZone()}
    >
      {children}
    </PortalShell>
  );
}
