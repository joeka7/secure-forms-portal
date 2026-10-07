import type { Metadata } from "next";
import { canManageUsers } from "@/lib/authz";
import { listAllCategoriesForAdmin } from "@/lib/server/catalog";
import { requirePageUser } from "@/lib/server/guards";
import { listUsers } from "@/lib/server/users";
import { AccessDenied } from "@/components/ui/States";
import { UsersManager } from "@/components/users/UsersManager";

export const metadata: Metadata = { title: "Users" };

export default function UsersPage() {
  const user = requirePageUser("/users");
  if (!canManageUsers(user)) return <AccessDenied message="You don't have permission to manage users." />;
  return <UsersManager initialUsers={listUsers(user)} categories={listAllCategoriesForAdmin(user)} currentUserId={user.id} />;
}
