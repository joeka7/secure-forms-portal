import type { Metadata } from "next";
import { isAdministrator } from "@/lib/authz";
import { listAccessibleCategories, listAccessibleFormIndex } from "@/lib/server/catalog";
import { requirePageUser } from "@/lib/server/guards";
import { FormsHome } from "@/components/catalog/FormsHome";

export const metadata: Metadata = { title: "Forms" };

export default function FormsPage() {
  const user = requirePageUser("/forms");
  return <FormsHome categories={listAccessibleCategories(user)} forms={listAccessibleFormIndex(user)} isAdministrator={isAdministrator(user)} />;
}
