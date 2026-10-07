import type { FormSchema } from "@/lib/forms/types";
import type { RecordStatus } from "@/lib/types";

/**
 * The catalog is the version-controlled source of categories and forms. On startup it is synced
 * into SQLite by slug (see `syncCatalog`). User ↔ category assignments, drafts and submissions live
 * only in the database.
 */
export type CatalogForm = {
  slug: string;
  name: string;
  description: string;
  /** Retire a form with "inactive"; entries are never deleted, so past submissions keep their form. */
  status?: RecordStatus;
  schema: FormSchema;
};

export type CatalogCategory = {
  slug: string;
  name: string;
  description: string;
  /** Icon key, see `components/catalog/CategoryIcon.tsx`. Unknown keys fall back to a generic icon. */
  icon: string;
  status?: RecordStatus;
  forms: CatalogForm[];
};
