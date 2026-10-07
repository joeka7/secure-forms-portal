import type { Category, FormDefinition } from "@/lib/types";
import { CategoryIcon } from "@/components/catalog/CategoryIcon";
import { PageHeader } from "@/components/ui/PageHeader";

/** Header shared by the fill and preview pages of a form. */
export function FormPageHeader({ category, form, actions }: { category: Category; form: FormDefinition; actions?: React.ReactNode }) {
  return (
    <PageHeader
      breadcrumbs={[
        { label: "Forms", href: "/forms" },
        { label: category.name, href: `/forms/${category.slug}` },
        { label: form.name },
      ]}
      eyebrow={
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-accent">
          <CategoryIcon icon={category.icon} className="h-3.5 w-3.5" />
          {category.name}
        </span>
      }
      title={form.name}
      description={form.description}
      actions={actions}
    />
  );
}
