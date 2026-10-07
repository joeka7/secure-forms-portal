import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Info, PenLine } from "lucide-react";
import { getFormForUser } from "@/lib/server/catalog";
import { requirePageUser } from "@/lib/server/guards";
import { getSessionUser } from "@/lib/server/session";
import { cn } from "@/lib/utils";
import { FormPageHeader } from "@/components/forms/FormPageHeader";
import { FormReadOnlyView } from "@/components/forms/FormReadOnlyView";
import { buttonPrimary } from "@/components/ui/classes";
import { AccessDenied } from "@/components/ui/States";

type Props = { params: { category: string; form: string } };

export function generateMetadata({ params }: Props): Metadata {
  const user = getSessionUser();
  const result = user ? getFormForUser(user, params.category, params.form) : null;
  return { title: result?.kind === "ok" ? `Preview: ${result.form.name}` : "Forms" };
}

/** Preview: the form's questions, instructions and structure. It shows no answers and saves nothing. */
export default function PreviewFormPage({ params }: Props) {
  const user = requirePageUser(`/forms/${params.category}/${params.form}/view`);
  const result = getFormForUser(user, params.category, params.form);
  if (result.kind === "denied") return <AccessDenied message="You don't have permission to access this category." />;
  if (result.kind === "not_found") notFound();

  const { category, form } = result;
  const fillHref = `/forms/${category.slug}/${form.slug}`;
  return (
    <div className={cn("mx-auto", form.schema.navigation ? "max-w-none" : "max-w-[860px]")}>
      <FormPageHeader
        category={category}
        form={form}
        actions={
          <Link href={fillHref} className={cn(buttonPrimary, "w-full sm:w-auto")}>
            <PenLine className="h-4 w-4" aria-hidden="true" />
            Fill form
          </Link>
        }
      />
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-accent/15 bg-accent-tint px-5 py-3.5 text-sm leading-relaxed text-ink-soft print:hidden">
        <Info className="mt-0.5 h-[18px] w-[18px] shrink-0 text-accent" aria-hidden="true" />
        <p>
          This is a preview of the form. Answers can&apos;t be entered here and nothing is saved. Choose{" "}
          <Link href={fillHref} className="font-semibold text-accent underline underline-offset-2">
            Fill form
          </Link>{" "}
          to complete and submit it.
        </p>
      </div>
      <FormReadOnlyView schema={form.schema} mode="preview" />
    </div>
  );
}
