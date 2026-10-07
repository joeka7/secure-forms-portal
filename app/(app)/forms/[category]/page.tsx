import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { canViewSubmissions } from "@/lib/authz";
import { getCategoryForUser } from "@/lib/server/catalog";
import { requirePageUser } from "@/lib/server/guards";
import { getSessionUser } from "@/lib/server/session";
import { CategoryFormsView } from "@/components/catalog/CategoryFormsView";
import { AccessDenied } from "@/components/ui/States";

type Props = { params: { category: string } };

export function generateMetadata({ params }: Props): Metadata {
  const user = getSessionUser();
  const result = user ? getCategoryForUser(user, params.category) : null;
  // The category is only named in the title when the user may see it.
  return { title: result?.kind === "ok" ? result.category.name : "Forms" };
}

export default function CategoryPage({ params }: Props) {
  const user = requirePageUser(`/forms/${params.category}`);
  const result = getCategoryForUser(user, params.category);
  if (result.kind === "denied") return <AccessDenied message="You don't have permission to access this category." />;
  if (result.kind === "not_found") notFound();
  return <CategoryFormsView category={result.category} forms={result.forms} canViewSubmissions={canViewSubmissions(user)} />;
}
