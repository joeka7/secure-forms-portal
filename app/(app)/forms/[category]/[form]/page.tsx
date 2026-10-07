import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormForUser } from "@/lib/server/catalog";
import { getDraft } from "@/lib/server/drafts";
import { requirePageUser } from "@/lib/server/guards";
import { getSessionUser } from "@/lib/server/session";
import { cn } from "@/lib/utils";
import { FormPageHeader } from "@/components/forms/FormPageHeader";
import { FormRenderer } from "@/components/forms/FormRenderer";
import { AccessDenied } from "@/components/ui/States";

type Props = { params: { category: string; form: string } };

export function generateMetadata({ params }: Props): Metadata {
  const user = getSessionUser();
  const result = user ? getFormForUser(user, params.category, params.form) : null;
  return { title: result?.kind === "ok" ? result.form.name : "Forms" };
}

export default function FillFormPage({ params }: Props) {
  const user = requirePageUser(`/forms/${params.category}/${params.form}`);
  const result = getFormForUser(user, params.category, params.form);
  if (result.kind === "denied") return <AccessDenied message="You don't have permission to access this category." />;
  if (result.kind === "not_found") notFound();

  const { category, form } = result;
  const apiBase = `/api/forms/${encodeURIComponent(category.slug)}/${encodeURIComponent(form.slug)}`;
  const longForm = !!form.schema.navigation;
  // Long forms can be saved as a server-side draft and completed over several sessions.
  const draft = longForm ? getDraft(user, category.slug, form.slug) : null;

  return (
    <div className={cn("mx-auto", longForm ? "max-w-none" : "max-w-[860px]")}>
      <FormPageHeader category={category} form={form} />
      <FormRenderer
        schema={form.schema}
        submitUrl={`${apiBase}/submissions`}
        draftUrl={longForm ? `${apiBase}/draft` : undefined}
        initialDraft={draft?.kind === "ok" ? draft.draft : null}
        backHref={`/forms/${category.slug}`}
        backLabel={`Back to ${category.name}`}
      />
    </div>
  );
}
